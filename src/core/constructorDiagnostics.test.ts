import { describe, expect, it } from "vitest";

import type { CellClassification } from "@/assets/assetProcessing";
import {
  createConstructorDiagnosticReport,
  createPanelReadinessDiagnosticReport,
  markConstructorDiagnosticReportStale,
} from "@/core/constructorDiagnostics";
import type { ValidationReport } from "@/validation/voxelValidation";
import {
  deriveActivatedPanelSet,
  semanticPlaneSlots,
  type PanelAsset,
  type PanelAssignment,
  type SemanticPlaneSlot,
} from "@/core/panelContracts";
import type { SixSurfaceTemplatePresetSize } from "@/schemas/template";

describe("constructor diagnostics", () => {
  it("creates a ready panel-readiness report without findings", () => {
    const readiness = deriveActivatedPanelSet({
      panelAssets: makePanelAssets(),
      assignments: makeAssignments(),
    });

    const report = createPanelReadinessDiagnosticReport({
      readiness,
      projectRevisionId: "rev-1",
    });

    expect(report).toMatchObject({
      status: "ready",
      stale: false,
      findings: [],
      counts: {
        errors: 0,
        warnings: 0,
        conflicts: 0,
        ambiguityMarkers: 0,
        affectedPanels: 0,
        affectedAssignments: 0,
      },
      runContext: {
        source: "panel-readiness",
        preset: 16,
        schemaVersion: "constructor-diagnostics-v1",
        projectRevisionId: "rev-1",
      },
    });
  });

  it("maps panel readiness blockers into structured diagnostic findings", () => {
    const readiness = deriveActivatedPanelSet({
      panelAssets: makePanelAssets({
        right: { cells: makeCells(16, { color: null }) },
      }),
      assignments: makeAssignments().filter((assignment) => assignment.slot !== "bottom"),
    });

    const report = createPanelReadinessDiagnosticReport({ readiness });

    expect(report.status).toBe("blocked");
    expect(report.stale).toBe(false);
    expect(report.counts).toMatchObject({
      errors: 2,
      warnings: 0,
      conflicts: 0,
      ambiguityMarkers: 0,
      affectedPanels: 1,
      affectedAssignments: 1,
    });
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        id: "readiness-missingRequiredSlot-1",
        family: "readiness",
        severity: "error",
        code: "missingRequiredSlot",
        sourceOwner: "activeProjectState",
        slots: ["bottom"],
        assignmentIds: [],
        panelAssetIds: [],
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        family: "readiness",
        severity: "error",
        code: "missingColorEvidence",
        sourceOwner: "assetProcessing",
        slots: ["right"],
        assignmentIds: ["assign-right"],
        panelAssetIds: ["asset-right"],
        expected: "source color for every occupied cell",
        actual: "missing color",
      }),
    );
  });

  it("omits unsupported slots from semantic slot routing while preserving the message", () => {
    const readiness = deriveActivatedPanelSet({
      panelAssets: makePanelAssets(),
      assignments: [
        ...makeAssignments(),
        {
          id: "assign-diagonal",
          panelAssetId: "asset-front",
          slot: "diagonal",
        },
      ],
    });

    const report = createPanelReadinessDiagnosticReport({ readiness });

    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "invalidSlot",
        sourceOwner: "panelContracts",
        assignmentIds: ["assign-diagonal"],
        panelAssetIds: ["asset-front"],
        slots: [],
        actual: "diagonal",
      }),
    );
  });

  it("marks stored reports stale without discarding diagnostic evidence", () => {
    const readiness = deriveActivatedPanelSet({
      panelAssets: makePanelAssets(),
      assignments: makeAssignments().filter((assignment) => assignment.slot !== "bottom"),
    });
    const report = createPanelReadinessDiagnosticReport({ readiness });

    const staleReport = markConstructorDiagnosticReportStale(report);

    expect(staleReport.status).toBe("stale");
    expect(staleReport.stale).toBe(true);
    expect(staleReport.findings).toBe(report.findings);
    expect(staleReport.counts).toBe(report.counts);
  });

  it("routes construction validation and marker findings to their owning subsystems", () => {
    const report = createConstructorDiagnosticReport({
      preset: 16,
      validationReport: makeValidationReport({
        connected: false,
        silhouetteMismatches: ["front:0,0"],
        colorMismatches: ["back:0,0"],
      }),
      conflictMarkers: [{ x: 0, y: 0, z: 0, label: "x", color: "#ef4444" }],
      ambiguityMarkers: [{ x: 1, y: 1, z: 1, label: "?", color: "#facc15" }],
    });

    expect(report.status).toBe("conflicted");
    expect(report.counts).toMatchObject({
      errors: 4,
      warnings: 1,
      conflicts: 1,
      ambiguityMarkers: 1,
    });
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "disconnectedVolume", sourceOwner: "modelConstruction" }),
      expect.objectContaining({ code: "silhouetteMismatch", sourceOwner: "modelConstruction" }),
      expect.objectContaining({ code: "surfaceColorMismatch", sourceOwner: "candidateResolver" }),
      expect.objectContaining({ code: "surfaceColorConflict", sourceOwner: "candidateResolver" }),
      expect.objectContaining({ code: "underSpecifiedCandidate", sourceOwner: "candidateResolver" }),
    ]));
  });
});

function makeValidationReport({
  connected = true,
  silhouetteMismatches = [],
  colorMismatches = [],
}: Partial<{
  connected: boolean;
  silhouetteMismatches: readonly string[];
  colorMismatches: readonly string[];
}> = {}): ValidationReport {
  const failureReasons = [
    !connected ? "Volume is disconnected" : null,
    silhouetteMismatches.length > 0 ? "Volume does not match input silhouettes" : null,
    colorMismatches.length > 0 ? "Surface colors conflict with projected panels" : null,
  ].filter((reason): reason is string => reason !== null);

  return {
    status: failureReasons.length > 0 ? "invalid" : "valid",
    geometry: {
      connected,
      watertight: true,
      unsupportedFloatingVoxels: [],
      silhouetteMismatches,
    },
    color: {
      coherent: colorMismatches.length === 0,
      mismatches: colorMismatches,
    },
    failureReasons,
  };
}

function makePanelAssets(
  overrides: Partial<Record<SemanticPlaneSlot, Partial<PanelAsset>>> = {},
): PanelAsset[] {
  return semanticPlaneSlots.map((slot) => {
    const preset = overrides[slot]?.preset ?? 16;

    return {
      id: `asset-${slot}`,
      preset,
      sourceDimensions: { width: 1024, height: 1024 },
      cellSize: { width: 1024 / preset, height: 1024 / preset },
      parserPolicy: "strict-v1",
      sourceKind: "upload",
      sourceLabel: `${slot}.png`,
      origin: { uploadSlotHint: slot, sourceName: `${slot}.png` },
      cells: makeCells(preset),
      occupiedCellCount: 1,
      ...overrides[slot],
    };
  });
}

function makeAssignments(): PanelAssignment[] {
  return semanticPlaneSlots.map((slot) => ({
    id: `assign-${slot}`,
    slot,
    panelAssetId: `asset-${slot}`,
  }));
}

function makeCells(
  preset: SixSurfaceTemplatePresetSize,
  firstCell: Partial<{
    occupied: boolean;
    color: string | null;
    classification: CellClassification;
  }> = {},
): PanelAsset["cells"] {
  return Array.from({ length: preset * preset }, (_, index) => {
    const occupied = index === 0 ? (firstCell.occupied ?? true) : false;
    const classification = index === 0 ? (firstCell.classification ?? (occupied ? "occupied" : "empty")) : "empty";

    return {
      x: index % preset,
      y: Math.floor(index / preset),
      classification,
      occupied,
      color: occupied ? ("color" in firstCell ? firstCell.color ?? null : "#ff00aa") : null,
    };
  });
}
