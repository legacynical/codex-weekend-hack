import { describe, expect, it } from "vitest";

import {
  addSavedPanelAsset,
  assignPanelToSlot,
  attachConstructorOutput,
  clearPanelAssignment,
  createActiveProject,
  createProjectPanelAsset,
  removeSavedPanelAsset,
  savePanelAssetCandidate,
  summarizeActiveProject,
} from "@/core/activeProjectState";
import { constructActivatedPanelSet } from "@/core/activatedPanelConstruction";
import { createPanelReadinessDiagnosticReport } from "@/core/constructorDiagnostics";
import { semanticPlaneSlots, type PanelAsset, type SemanticPlaneSlot } from "@/core/panelContracts";
import type { PanelAssetCandidate } from "@/assets/assetProcessing";
import type { SixSurfaceTemplatePresetSize } from "@/schemas/template";

describe("active project state", () => {
  it("starts empty with missing-assignment readiness diagnostics", () => {
    const project = createActiveProject({ id: "project-1" });

    expect(summarizeActiveProject(project)).toMatchObject({
      status: "empty",
      savedAssetCount: 0,
      readinessStatus: "blocked",
      constructorStatus: "not-run",
      diagnosticCount: 6,
    });
  });

  it("adds saved panel assets without making them constructor input", () => {
    const project = addSavedPanelAsset(createActiveProject({ id: "project-1" }), makePanelAsset("front"));

    expect(project.savedPanelAssets).toHaveLength(1);
    expect(project.activeAssignments).toHaveLength(0);
    expect(summarizeActiveProject(project)).toMatchObject({
      status: "assets-present",
      savedAssetCount: 1,
      readinessStatus: "blocked",
    });
  });

  it("turns a processed candidate into a project-local saved panel asset", () => {
    const candidate = makePanelAssetCandidate("front");
    const panelAsset = createProjectPanelAsset({
      id: " asset-front ",
      candidate,
    });

    expect(panelAsset).toEqual({
      ...candidate,
      id: "asset-front",
    });
  });

  it("rejects blank saved panel asset ids at the project membership boundary", () => {
    expect(() =>
      createProjectPanelAsset({
        id: "  ",
        candidate: makePanelAssetCandidate("front"),
      }),
    ).toThrow("Saved panel asset id is required.");
  });

  it("saves processed candidates without creating active assignments", () => {
    const project = savePanelAssetCandidate(createActiveProject({ id: "project-1" }), {
      id: "asset-front",
      candidate: makePanelAssetCandidate("front"),
    });

    expect(project.savedPanelAssets).toHaveLength(1);
    expect(project.savedPanelAssets[0]).toMatchObject({
      id: "asset-front",
      sourceLabel: "front.png",
    });
    expect(project.activeAssignments).toHaveLength(0);
    expect(summarizeActiveProject(project)).toMatchObject({
      status: "assets-present",
      savedAssetCount: 1,
      readinessStatus: "blocked",
    });
  });

  it("derives constructor-ready state from six saved assets and assignments", () => {
    const project = makeReadyProject();
    const summary = summarizeActiveProject(project);

    expect(project.readiness.status).toBe("ready");
    expect(summary.status).toBe("constructor-ready");
    expect(summary.assignmentCoverage).toEqual({
      front: true,
      back: true,
      left: true,
      right: true,
      top: true,
      bottom: true,
    });

    if (project.readiness.status !== "ready") {
      throw new Error("Expected ready project");
    }

    expect(project.readiness.activatedPanelSet.panels.front.panelAssetId).toBe("asset-front");
  });

  it("replaces a slot assignment through active project state instead of creating duplicates", () => {
    const project = addSavedPanelAsset(makeReadyProject(), makePanelAsset("front-replacement"));
    const replaced = assignPanelToSlot(project, {
      id: "assign-front-replacement",
      panelAssetId: "asset-front-replacement",
      slot: "front",
    });

    expect(replaced.activeAssignments.filter((assignment) => assignment.slot === "front")).toEqual([
      {
        id: "assign-front-replacement",
        panelAssetId: "asset-front-replacement",
        slot: "front",
      },
    ]);
    expect(replaced.readiness.status).toBe("ready");
  });

  it("clears assignments that reference removed saved assets", () => {
    const project = removeSavedPanelAsset(makeReadyProject(), "asset-front");

    expect(project.savedPanelAssets.some((panelAsset) => panelAsset.id === "asset-front")).toBe(false);
    expect(project.activeAssignments.some((assignment) => assignment.panelAssetId === "asset-front")).toBe(false);
    expect(project.readiness.status).toBe("blocked");
    expect(project.readiness.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missingRequiredSlot",
        slot: "front",
      }),
    );
  });

  it("marks constructor output stale after assignment changes", () => {
    const readyProject = makeReadyProject();
    const construction = constructionFor(readyProject);
    const attached = attachConstructorOutput(readyProject, {
      ...construction,
      diagnosticReport: {
        ...construction.diagnosticReport,
        runContext: {
          ...construction.diagnosticReport.runContext,
          projectRevisionId: "rev-ready",
        },
      },
    });
    const cleared = clearPanelAssignment(attached, "bottom");

    expect(summarizeActiveProject(attached)).toMatchObject({
      status: "constructor-attached",
      constructorStatus: "succeeded",
      staleConstructorOutput: false,
    });
    expect(summarizeActiveProject(cleared)).toMatchObject({
      status: "constructor-stale",
      constructorStatus: "succeeded",
      staleConstructorOutput: true,
      readinessStatus: "blocked",
    });
    expect(cleared.constructorOutput?.diagnosticReport).toMatchObject({
      status: "stale",
      stale: true,
      runContext: {
        projectRevisionId: "rev-ready",
      },
    });
  });

  it("does not attach constructor output while readiness is blocked", () => {
    const project = createActiveProject({ id: "project-1" });
    const construction = constructionFor(makeReadyProject());

    expect(() =>
      attachConstructorOutput(project, {
        ...construction,
        diagnosticReport: createPanelReadinessDiagnosticReport({
          readiness: project.readiness,
        }),
      }),
    ).toThrow(
      "Cannot attach constructor output until active panel assignments are constructor-ready.",
    );
  });
});

function makeReadyProject() {
  return semanticPlaneSlots.reduce((project, slot) => {
    const withAsset = addSavedPanelAsset(project, makePanelAsset(slot));

    return assignPanelToSlot(withAsset, {
      id: `assign-${slot}`,
      panelAssetId: `asset-${slot}`,
      slot,
    });
  }, createActiveProject({ id: "project-1", name: "Test project" }));
}

function constructionFor(project: ReturnType<typeof makeReadyProject>) {
  if (project.readiness.status !== "ready") {
    throw new Error("Expected a constructor-ready test project");
  }

  return constructActivatedPanelSet(project.readiness.activatedPanelSet);
}

function makePanelAsset(slot: SemanticPlaneSlot | "front-replacement", preset: SixSurfaceTemplatePresetSize = 16): PanelAsset {
  return {
    ...makePanelAssetCandidate(slot, preset),
    id: `asset-${slot}`,
  };
}

function makePanelAssetCandidate(
  slot: SemanticPlaneSlot | "front-replacement",
  preset: SixSurfaceTemplatePresetSize = 16,
): PanelAssetCandidate {
  return {
    preset,
    sourceDimensions: { width: 1024, height: 1024 },
    cellSize: { width: 1024 / preset, height: 1024 / preset },
    parserPolicy: "strict-v1",
    sourceKind: "upload",
    sourceLabel: `${slot}.png`,
    origin: { uploadSlotHint: slot, sourceName: `${slot}.png` },
    cells: Array.from({ length: preset * preset }, (_, index) => ({
      x: index % preset,
      y: Math.floor(index / preset),
      classification: index === 0 ? "occupied" : "empty",
      occupied: index === 0,
      color: index === 0 ? "#123456" : null,
    })),
    occupiedCellCount: 1,
  };
}
