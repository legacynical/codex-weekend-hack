import { describe, expect, it } from "vitest";

import {
  constructActivatedPanelSet,
  constructAndAttachActiveProject,
  viewPanelsFromActivatedPanelSet,
} from "@/core/activatedPanelConstruction";
import {
  addSavedPanelAsset,
  assignPanelToSlot,
  clearPanelAssignment,
  createActiveProject,
} from "@/core/activeProjectState";
import {
  semanticPlaneSlots,
  type ActivatedPanelSet,
  type PanelAsset,
  type SemanticPlaneSlot,
} from "@/core/panelContracts";
import { getPanelPixel } from "@/core/panels";
import { surfaceViews } from "@/core/projection";
import type { SixSurfaceTemplatePresetSize } from "@/schemas/template";

describe("activated panel construction", () => {
  it("converts every semantic slot to the matching signed view without hidden coordinate transforms", () => {
    const panelSet = makeActivatedPanelSet((slot) => {
      const occupiedIndex = semanticPlaneSlots.indexOf(slot);

      return makeCells(16, occupiedIndex);
    });
    const panels = viewPanelsFromActivatedPanelSet(panelSet);

    expect(panels).toHaveLength(6);
    for (const [index, slot] of semanticPlaneSlots.entries()) {
      const panel = panels[index];
      const view = surfaceViews.find((candidate) => candidate.surface === slot);

      expect(panel).toMatchObject(view ?? {});
      expect(panel?.id).toBe(slot);
      expect(getPanelPixel(panel!, index, 0)).toEqual({ occupied: true, color: "#336699" });
      expect(getPanelPixel(panel!, 15 - index, 15)).toEqual({ occupied: false, color: null });
    }
  });

  it("constructs and validates a deterministic candidate from a ready six-panel set", () => {
    const construction = constructActivatedPanelSet(makeActivatedPanelSet(() => makeCells(16, 0)));

    expect(construction.status).toBe("succeeded");
    expect(construction.candidate.volume.voxels).toEqual([{ x: 0, y: 0, z: 0, color: "#336699" }]);
    expect(construction.candidate.validationReport).toMatchObject({
      status: "valid",
      geometry: {
        connected: true,
        watertight: true,
        silhouetteMismatches: [],
      },
      color: { coherent: true, mismatches: [] },
    });
    expect(construction.diagnosticReport).toMatchObject({
      status: "usable",
      stale: false,
      findings: [],
    });
  });

  it("attaches candidate data through active project state and marks it stale after replacement intent", () => {
    const readyProject = makeReadyProject();
    const attached = constructAndAttachActiveProject(readyProject);
    const stale = clearPanelAssignment(attached, "front");

    expect(attached.constructorOutput).toMatchObject({
      status: "succeeded",
      stale: false,
      candidate: {
        validationReport: { status: "valid" },
      },
    });
    expect(attached.constructorOutput?.candidate.volume.voxels).toHaveLength(1);
    expect(stale.readiness.status).toBe("blocked");
    expect(stale.constructorOutput).toMatchObject({ stale: true });
    expect(stale.constructorOutput?.candidate).toBe(attached.constructorOutput?.candidate);
  });

  it("fails closed when orchestration receives a partial project", () => {
    const project = createActiveProject({ id: "project-1" });

    expect(() => constructAndAttachActiveProject(project)).toThrow(
      "Cannot construct an active project until all six panel assignments are ready.",
    );
  });
});

function makeReadyProject() {
  return semanticPlaneSlots.reduce((project, slot) => {
    const withAsset = addSavedPanelAsset(project, makePanelAsset(slot));

    return assignPanelToSlot(withAsset, {
      id: `assignment-${slot}`,
      panelAssetId: `panel-${slot}`,
      slot,
    });
  }, createActiveProject({ id: "project-1", name: "Upload project" }));
}

function makePanelAsset(slot: SemanticPlaneSlot): PanelAsset {
  return {
    id: `panel-${slot}`,
    preset: 16,
    sourceDimensions: { width: 1024, height: 1024 },
    cellSize: { width: 64, height: 64 },
    parserPolicy: "strict-v1",
    sourceKind: "upload",
    sourceLabel: `${slot}.png`,
    origin: { uploadSlotHint: slot, sourceName: `${slot}.png` },
    cells: makeCells(16, 0),
    occupiedCellCount: 1,
  };
}

function makeActivatedPanelSet(
  cellsForSlot: (slot: SemanticPlaneSlot) => ReturnType<typeof makeCells>,
  preset: SixSurfaceTemplatePresetSize = 16,
): ActivatedPanelSet {
  const panelFor = (slot: SemanticPlaneSlot) => ({
    slot,
    assignmentId: `assignment-${slot}`,
    panelAssetId: `panel-${slot}`,
    preset,
    sourceLabel: `${slot}.png`,
    cells: cellsForSlot(slot),
  });

  return {
    preset,
    panels: {
      front: panelFor("front"),
      back: panelFor("back"),
      left: panelFor("left"),
      right: panelFor("right"),
      top: panelFor("top"),
      bottom: panelFor("bottom"),
    },
  };
}

function makeCells(preset: SixSurfaceTemplatePresetSize, occupiedIndex: number | "all") {
  return Array.from({ length: preset * preset }, (_, index) => {
    const occupied = occupiedIndex === "all" || index === occupiedIndex;

    return {
      x: index % preset,
      y: Math.floor(index / preset),
      classification: occupied ? "occupied" as const : "empty" as const,
      occupied,
      color: occupied ? "#336699" : null,
    };
  });
}
