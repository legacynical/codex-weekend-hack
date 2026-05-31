import type { PanelAssetCandidate, ProcessedCellEvidence } from "@/assets/assetProcessing";
import type { SurfaceId } from "@/core/panels";
import type { SixSurfaceTemplatePresetSize } from "@/schemas/template";

export const semanticPlaneSlots = ["front", "back", "left", "right", "top", "bottom"] as const satisfies readonly SurfaceId[];

export type SemanticPlaneSlot = (typeof semanticPlaneSlots)[number];

export type PanelAsset = PanelAssetCandidate &
  Readonly<{
    id: string;
  }>;

export type PanelAssignment = Readonly<{
  id: string;
  panelAssetId: string;
  slot: string;
}>;

export type ActivatedPanel = Readonly<{
  slot: SemanticPlaneSlot;
  assignmentId: string;
  panelAssetId: string;
  preset: SixSurfaceTemplatePresetSize;
  cells: readonly ProcessedCellEvidence[];
  sourceLabel?: string;
}>;

export type ActivatedPanelSet = Readonly<{
  preset: SixSurfaceTemplatePresetSize;
  panels: Record<SemanticPlaneSlot, ActivatedPanel>;
}>;

export type PanelReadinessDiagnosticCode =
  | "missingRequiredSlot"
  | "duplicateSlotAssignment"
  | "invalidSlot"
  | "missingPanelAsset"
  | "incompatiblePreset"
  | "invalidPixelGridShape"
  | "emptyPanel"
  | "missingColorEvidence"
  | "malformedCellEvidence";

export type PanelReadinessRepairOwner = "activeProjectState" | "panelContracts" | "assetProcessing";

export type PanelReadinessDiagnostic = Readonly<{
  severity: "error";
  code: PanelReadinessDiagnosticCode;
  message: string;
  repairOwner: PanelReadinessRepairOwner;
  slot?: string;
  assignmentId?: string;
  panelAssetId?: string;
  expected?: string;
  actual?: string;
}>;

export type PanelReadinessInput = Readonly<{
  panelAssets: readonly PanelAsset[];
  assignments: readonly PanelAssignment[];
}>;

export type BlockedPanelReadinessResult = Readonly<{
  status: "blocked";
  diagnostics: readonly PanelReadinessDiagnostic[];
  acceptedPanels: Partial<Record<SemanticPlaneSlot, ActivatedPanel>>;
}>;

export type ReadyPanelReadinessResult = Readonly<{
  status: "ready";
  diagnostics: readonly PanelReadinessDiagnostic[];
  acceptedPanels: Record<SemanticPlaneSlot, ActivatedPanel>;
  activatedPanelSet: ActivatedPanelSet;
}>;

export type PanelReadinessResult = BlockedPanelReadinessResult | ReadyPanelReadinessResult;

const semanticPlaneSlotSet = new Set<string>(semanticPlaneSlots);

export function deriveActivatedPanelSet(input: PanelReadinessInput): PanelReadinessResult {
  const panelAssetsById = new Map(input.panelAssets.map((panelAsset) => [panelAsset.id, panelAsset]));
  const assignmentsBySlot = new Map<SemanticPlaneSlot, PanelAssignment[]>();
  const diagnostics: PanelReadinessDiagnostic[] = [];
  const acceptedPanels: Partial<Record<SemanticPlaneSlot, ActivatedPanel>> = {};

  for (const assignment of input.assignments) {
    if (!isSemanticPlaneSlot(assignment.slot)) {
      diagnostics.push({
        severity: "error",
        code: "invalidSlot",
        message: `Assignment ${assignment.id} uses unsupported slot "${assignment.slot}".`,
        repairOwner: "panelContracts",
        slot: assignment.slot,
        assignmentId: assignment.id,
        panelAssetId: assignment.panelAssetId,
        expected: semanticPlaneSlots.join(", "),
        actual: assignment.slot,
      });
      continue;
    }

    const slotAssignments = assignmentsBySlot.get(assignment.slot) ?? [];
    slotAssignments.push(assignment);
    assignmentsBySlot.set(assignment.slot, slotAssignments);
  }

  for (const slot of semanticPlaneSlots) {
    const slotAssignments = assignmentsBySlot.get(slot) ?? [];

    if (slotAssignments.length === 0) {
      diagnostics.push({
        severity: "error",
        code: "missingRequiredSlot",
        message: `Required slot "${slot}" has no active panel assignment.`,
        repairOwner: "activeProjectState",
        slot,
        expected: "one active assignment",
        actual: "none",
      });
      continue;
    }

    if (slotAssignments.length > 1) {
      diagnostics.push({
        severity: "error",
        code: "duplicateSlotAssignment",
        message: `Slot "${slot}" has ${slotAssignments.length} active assignments.`,
        repairOwner: "activeProjectState",
        slot,
        expected: "one active assignment",
        actual: `${slotAssignments.length}`,
      });
    }
  }

  const expectedPreset = firstResolvedPreset(input.assignments, panelAssetsById);

  for (const [slot, slotAssignments] of assignmentsBySlot) {
    for (const assignment of slotAssignments) {
      const panelAsset = panelAssetsById.get(assignment.panelAssetId);

      if (!panelAsset) {
        diagnostics.push({
          severity: "error",
          code: "missingPanelAsset",
          message: `Assignment ${assignment.id} references missing panel asset "${assignment.panelAssetId}".`,
          repairOwner: "activeProjectState",
          slot,
          assignmentId: assignment.id,
          panelAssetId: assignment.panelAssetId,
          expected: "saved project-local panel asset",
          actual: "missing",
        });
        continue;
      }

      const previousDiagnosticCount = diagnostics.length;
      validatePanelAssetEvidence({
        assignment,
        panelAsset,
        slot,
        expectedPreset,
        diagnostics,
      });

      if (diagnostics.length === previousDiagnosticCount && slotAssignments.length === 1) {
        acceptedPanels[slot] = {
          slot,
          assignmentId: assignment.id,
          panelAssetId: panelAsset.id,
          preset: panelAsset.preset,
          cells: panelAsset.cells,
          sourceLabel: panelAsset.sourceLabel,
        };
      }
    }
  }

  if (diagnostics.length > 0 || !hasEveryRequiredSlot(acceptedPanels)) {
    return {
      status: "blocked",
      diagnostics,
      acceptedPanels,
    };
  }

  const activatedPanelSet = {
    preset: expectedPreset,
    panels: acceptedPanels as Record<SemanticPlaneSlot, ActivatedPanel>,
  };

  return {
    status: "ready",
    diagnostics,
    acceptedPanels: activatedPanelSet.panels,
    activatedPanelSet,
  };
}

export function validatePanelContracts(input: PanelReadinessInput): readonly PanelReadinessDiagnostic[] {
  return deriveActivatedPanelSet(input).diagnostics;
}

function validatePanelAssetEvidence({
  assignment,
  panelAsset,
  slot,
  expectedPreset,
  diagnostics,
}: {
  assignment: PanelAssignment;
  panelAsset: PanelAsset;
  slot: SemanticPlaneSlot;
  expectedPreset: SixSurfaceTemplatePresetSize;
  diagnostics: PanelReadinessDiagnostic[];
}): void {
  if (panelAsset.preset !== expectedPreset) {
    diagnostics.push({
      severity: "error",
      code: "incompatiblePreset",
      message: `Panel asset "${panelAsset.id}" uses preset ${panelAsset.preset}, expected ${expectedPreset}.`,
      repairOwner: "panelContracts",
      slot,
      assignmentId: assignment.id,
      panelAssetId: panelAsset.id,
      expected: `${expectedPreset}`,
      actual: `${panelAsset.preset}`,
    });
  }

  const expectedCellCount = panelAsset.preset * panelAsset.preset;

  if (panelAsset.cells.length !== expectedCellCount) {
    diagnostics.push({
      severity: "error",
      code: "invalidPixelGridShape",
      message: `Panel asset "${panelAsset.id}" has ${panelAsset.cells.length} cells, expected ${expectedCellCount}.`,
      repairOwner: "assetProcessing",
      slot,
      assignmentId: assignment.id,
      panelAssetId: panelAsset.id,
      expected: `${expectedCellCount}`,
      actual: `${panelAsset.cells.length}`,
    });
  }

  const malformedCell = panelAsset.cells.find(
    (cell) => cell.classification === "malformed" || cell.classification === "ambiguous",
  );

  if (malformedCell) {
    diagnostics.push({
      severity: "error",
      code: "malformedCellEvidence",
      message: `Panel asset "${panelAsset.id}" contains malformed cell evidence at ${malformedCell.x},${malformedCell.y}.`,
      repairOwner: "assetProcessing",
      slot,
      assignmentId: assignment.id,
      panelAssetId: panelAsset.id,
      expected: "occupied or empty cell evidence",
      actual: malformedCell.classification,
    });
  }

  const occupiedCells = panelAsset.cells.filter((cell) => cell.occupied);

  if (occupiedCells.length === 0) {
    diagnostics.push({
      severity: "error",
      code: "emptyPanel",
      message: `Panel asset "${panelAsset.id}" has no occupied cells.`,
      repairOwner: "assetProcessing",
      slot,
      assignmentId: assignment.id,
      panelAssetId: panelAsset.id,
      expected: "at least one occupied cell",
      actual: "0",
    });
  }

  const missingColorCell = occupiedCells.find((cell) => cell.color === null);

  if (missingColorCell) {
    diagnostics.push({
      severity: "error",
      code: "missingColorEvidence",
      message: `Panel asset "${panelAsset.id}" has occupied cell ${missingColorCell.x},${missingColorCell.y} without source color evidence.`,
      repairOwner: "assetProcessing",
      slot,
      assignmentId: assignment.id,
      panelAssetId: panelAsset.id,
      expected: "source color for every occupied cell",
      actual: "missing color",
    });
  }
}

function firstResolvedPreset(
  assignments: readonly PanelAssignment[],
  panelAssetsById: ReadonlyMap<string, PanelAsset>,
): SixSurfaceTemplatePresetSize {
  for (const assignment of assignments) {
    const panelAsset = panelAssetsById.get(assignment.panelAssetId);

    if (panelAsset) {
      return panelAsset.preset;
    }
  }

  return 16;
}

function hasEveryRequiredSlot(
  acceptedPanels: Partial<Record<SemanticPlaneSlot, ActivatedPanel>>,
): acceptedPanels is Record<SemanticPlaneSlot, ActivatedPanel> {
  return semanticPlaneSlots.every((slot) => Boolean(acceptedPanels[slot]));
}

function isSemanticPlaneSlot(value: string): value is SemanticPlaneSlot {
  return semanticPlaneSlotSet.has(value);
}
