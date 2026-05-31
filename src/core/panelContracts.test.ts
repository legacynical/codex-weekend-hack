import { describe, expect, it } from "vitest";

import {
  deriveActivatedPanelSet,
  semanticPlaneSlots,
  type PanelAsset,
  type PanelAssignment,
  type SemanticPlaneSlot,
} from "@/core/panelContracts";
import type { CellClassification } from "@/assets/assetProcessing";
import type { SixSurfaceTemplatePresetSize } from "@/schemas/template";

describe("deriveActivatedPanelSet", () => {
  it("returns a constructor-ready activated panel set for six compatible panels", () => {
    const panelAssets = makePanelAssets();
    const assignments = makeAssignments(panelAssets);

    const result = deriveActivatedPanelSet({ panelAssets, assignments });

    expect(result.status).toBe("ready");

    if (result.status !== "ready") {
      throw new Error("Expected ready panel set");
    }

    expect(result.activatedPanelSet.preset).toBe(16);
    expect(Object.keys(result.activatedPanelSet.panels).sort()).toEqual([...semanticPlaneSlots].sort());
    expect(result.activatedPanelSet.panels.front.panelAssetId).toBe("asset-front");
    expect(result.activatedPanelSet.panels.bottom.cells.some((cell) => cell.occupied && cell.color)).toBe(true);
  });

  it("blocks construction when a required slot is missing", () => {
    const panelAssets = makePanelAssets();
    const assignments = makeAssignments(panelAssets).filter((assignment) => assignment.slot !== "bottom");

    const result = deriveActivatedPanelSet({ panelAssets, assignments });

    expect(result.status).toBe("blocked");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missingRequiredSlot",
        slot: "bottom",
        repairOwner: "activeProjectState",
      }),
    );
  });

  it("blocks dangling assignment references before constructor input is created", () => {
    const panelAssets = makePanelAssets();
    const assignments = makeAssignments(panelAssets).map((assignment) =>
      assignment.slot === "front" ? { ...assignment, panelAssetId: "missing-asset" } : assignment,
    );

    const result = deriveActivatedPanelSet({ panelAssets, assignments });

    expect(result.status).toBe("blocked");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missingPanelAsset",
        slot: "front",
        assignmentId: "assign-front",
        panelAssetId: "missing-asset",
      }),
    );
  });

  it("blocks duplicate slot assignments", () => {
    const panelAssets = makePanelAssets();
    const assignments = [
      ...makeAssignments(panelAssets),
      { id: "assign-front-duplicate", slot: "front", panelAssetId: "asset-back" },
    ];

    const result = deriveActivatedPanelSet({ panelAssets, assignments });

    expect(result.status).toBe("blocked");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "duplicateSlotAssignment",
        slot: "front",
        actual: "2",
      }),
    );
  });

  it("blocks unsupported semantic slots", () => {
    const panelAssets = makePanelAssets();
    const assignments = [
      ...makeAssignments(panelAssets),
      { id: "assign-diagonal", slot: "diagonal", panelAssetId: "asset-front" },
    ];

    const result = deriveActivatedPanelSet({ panelAssets, assignments });

    expect(result.status).toBe("blocked");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "invalidSlot",
        slot: "diagonal",
        expected: "front, back, left, right, top, bottom",
      }),
    );
  });

  it("blocks incompatible grid presets", () => {
    const panelAssets = makePanelAssets({
      bottom: { preset: 32 },
    });
    const assignments = makeAssignments(panelAssets);

    const result = deriveActivatedPanelSet({ panelAssets, assignments });

    expect(result.status).toBe("blocked");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "incompatiblePreset",
        slot: "bottom",
        expected: "16",
        actual: "32",
      }),
    );
  });

  it("blocks invalid pixel-grid shapes", () => {
    const panelAssets = makePanelAssets({
      left: { cells: makeCells(16).slice(1) },
    });
    const assignments = makeAssignments(panelAssets);

    const result = deriveActivatedPanelSet({ panelAssets, assignments });

    expect(result.status).toBe("blocked");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "invalidPixelGridShape",
        slot: "left",
        expected: "256",
        actual: "255",
      }),
    );
  });

  it("blocks empty panels", () => {
    const panelAssets = makePanelAssets({
      top: { cells: makeCells(16, { occupied: false }) },
    });
    const assignments = makeAssignments(panelAssets);

    const result = deriveActivatedPanelSet({ panelAssets, assignments });

    expect(result.status).toBe("blocked");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "emptyPanel",
        slot: "top",
        repairOwner: "assetProcessing",
      }),
    );
  });

  it("blocks occupied cells without source color evidence", () => {
    const panelAssets = makePanelAssets({
      right: { cells: makeCells(16, { color: null }) },
    });
    const assignments = makeAssignments(panelAssets);

    const result = deriveActivatedPanelSet({ panelAssets, assignments });

    expect(result.status).toBe("blocked");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missingColorEvidence",
        slot: "right",
        actual: "missing color",
      }),
    );
  });

  it("blocks malformed cell classifications", () => {
    const panelAssets = makePanelAssets({
      back: { cells: makeCells(16, { classification: "malformed" }) },
    });
    const assignments = makeAssignments(panelAssets);

    const result = deriveActivatedPanelSet({ panelAssets, assignments });

    expect(result.status).toBe("blocked");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "malformedCellEvidence",
        slot: "back",
        actual: "malformed",
      }),
    );
  });
});

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

function makeAssignments(panelAssets: readonly PanelAsset[]): PanelAssignment[] {
  return panelAssets.map((panelAsset) => {
    const slot = panelAsset.id.replace("asset-", "");

    return {
      id: `assign-${slot}`,
      slot,
      panelAssetId: panelAsset.id,
    };
  });
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
