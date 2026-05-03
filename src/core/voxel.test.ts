import { describe, expect, it } from "vitest";

import { createSwirlSphere, swirlPalette, swirlSphereColor } from "@/benchmarks/swirlSphere";
import { getPanelPixel, type ViewPanel } from "@/core/panels";
import {
  axisViews,
  projectVolumeToAxisPanels,
  projectVolumeToSurfacePanels,
  reconstructProjectedHull,
  reconstructVisualHull,
  surfaceViews,
} from "@/core/projection";
import { isInsideSphere, type VoxelVolume } from "@/core/voxel";
import { axisPlusDiagonalTemplate, gridTemplateSchema } from "@/schemas/template";
import { hasNoEnclosedVoids, validateVoxelCandidate } from "@/validation/voxelValidation";

describe("isInsideSphere", () => {
  it("keeps center voxels and rejects corners", () => {
    const size = { x: 8, y: 8, z: 8 };

    expect(isInsideSphere({ x: 3, y: 3, z: 3 }, size)).toBe(true);
    expect(isInsideSphere({ x: 0, y: 0, z: 0 }, size)).toBe(false);
  });
});

describe("swirl sphere benchmark", () => {
  it("generates occupied voxels with deterministic palette colors", () => {
    const size = { x: 8, y: 8, z: 8 };
    const sphere = createSwirlSphere(size);
    const centerColor = swirlSphereColor({ x: 3, y: 3, z: 3 }, size);

    expect(sphere.size).toEqual(size);
    expect(sphere.voxels.length).toBeGreaterThan(0);
    expect(sphere.voxels.every((voxel) => (swirlPalette as readonly string[]).includes(voxel.color))).toBe(true);
    expect(sphere.voxels).toContainEqual({ x: 3, y: 3, z: 3, color: centerColor });
  });

  it("projects the fixture into x, y, and z panels", () => {
    const sphere = createSwirlSphere({ x: 8, y: 8, z: 8 });
    const panels = projectVolumeToAxisPanels(sphere);

    expect(panels.map((panel) => panel.id)).toEqual(axisViews.map((view) => view.id));
    expect(panels).toHaveLength(3);
    expect(panels.every((panel) => panel.width === 8 && panel.height === 8)).toBe(true);
    expect(getPanelPixel(panels[0] as ViewPanel, 3, 3).occupied).toBe(true);
    expect(getPanelPixel(panels[0] as ViewPanel, 0, 0).occupied).toBe(false);
  });

  it("keeps the 16 preset projected panels stable for inspection", () => {
    const sphere = createSwirlSphere({ x: 16, y: 16, z: 16 });
    const panels = projectVolumeToSurfacePanels(sphere);

    expect(panels.map((panel) => [panel.id, panel.width, panel.height])).toEqual([
      ["front", 16, 16],
      ["back", 16, 16],
      ["left", 16, 16],
      ["right", 16, 16],
      ["top", 16, 16],
      ["bottom", 16, 16],
    ]);
    expect(panels.map((panel) => panel.surface)).toEqual(surfaceViews.map((view) => view.surface));
    expect(panels.every((panel) => panel.pixels.some((pixel) => pixel.occupied && pixel.color))).toBe(true);
    expect(panels.every((panel) => panel.pixels.some((pixel) => !pixel.occupied))).toBe(true);
  });

  it("reports projected color conflicts from visible panel pixels", () => {
    const sphere = createSwirlSphere({ x: 8, y: 8, z: 8 });
    const panels = projectVolumeToSurfacePanels(sphere);
    const corruptedPanel = corruptFirstResolvedColor([panels[0] as ViewPanel])[0] as ViewPanel;
    const result = reconstructProjectedHull(sphere.size, [panels[0] as ViewPanel, corruptedPanel]);

    expect(result.volume.voxels.length).toBeGreaterThan(0);
    expect(result.colorConflicts.length).toBeGreaterThan(0);
  });

  it("does not treat cross-surface color differences as projected conflicts", () => {
    const sphere = createSwirlSphere({ x: 8, y: 8, z: 8 });
    const panels = projectVolumeToSurfacePanels(sphere);
    const result = reconstructProjectedHull(sphere.size, panels);

    expect(result.volume.voxels.length).toBeGreaterThan(0);
    expect(result.colorConflicts).toEqual([]);
  });

  it("reconstructs a visual-hull candidate that matches source silhouettes", () => {
    const sphere = createSwirlSphere({ x: 8, y: 8, z: 8 });
    const panels = projectVolumeToAxisPanels(sphere);
    const reconstructed = reconstructVisualHull(sphere.size, panels);
    const report = validateVoxelCandidate(reconstructed, panels);

    expect(reconstructed.voxels.length).toBeGreaterThanOrEqual(sphere.voxels.length);
    expect(report.geometry.connected).toBe(true);
    expect(report.geometry.watertight).toBe(true);
    expect(report.geometry.silhouetteMismatches).toEqual([]);
  });

  it("keeps color coherence separate from geometry validity", () => {
    const sphere = createSwirlSphere({ x: 8, y: 8, z: 8 });
    const panels = projectVolumeToAxisPanels(sphere);
    const validReport = validateVoxelCandidate(sphere, panels);
    const corruptedPanels = corruptFirstResolvedColor(panels);
    const corruptedReport = validateVoxelCandidate(sphere, corruptedPanels);

    expect(validReport.status).toBe("valid");
    expect(validReport.color.coherent).toBe(true);
    expect(corruptedReport.geometry.connected).toBe(true);
    expect(corruptedReport.geometry.silhouetteMismatches).toEqual([]);
    expect(corruptedReport.color.coherent).toBe(false);
    expect(corruptedReport.failureReasons).toContain("Surface colors conflict with projected panels");
  });

  it("keeps the benchmark validation lanes aligned with current UI labels", () => {
    const sphere = createSwirlSphere({ x: 16, y: 16, z: 16 });
    const panels = projectVolumeToAxisPanels(sphere);
    const reconstructed = reconstructVisualHull(sphere.size, panels);
    const report = validateVoxelCandidate(reconstructed, panels);

    expect(report.geometry.silhouetteMismatches).toEqual([]);
    expect(report.geometry.connected).toBe(true);
    expect(report.geometry.watertight).toBe(true);
    expect(report.color.coherent).toBe(false);
    expect(report.color.mismatches.length).toBeGreaterThan(0);
  });

  it("detects enclosed voids as a watertightness failure", () => {
    const hollowCube = createHollowCube();

    expect(hasNoEnclosedVoids(hollowCube)).toBe(false);
  });
});

describe("grid template schema", () => {
  it("accepts the first axis-plus-diagonal contract", () => {
    expect(axisPlusDiagonalTemplate.panels.map((panel) => panel.id)).toEqual([
      "side-x",
      "front-y",
      "top-z",
      "diag-z-45",
    ]);
    expect(gridTemplateSchema.parse(axisPlusDiagonalTemplate).validation.requiredViews).toEqual([
      "side-x",
      "front-y",
      "top-z",
    ]);
  });

  it("rejects malformed panel dimensions before reconstruction", () => {
    const malformed = {
      ...axisPlusDiagonalTemplate,
      panels: [
        {
          ...axisPlusDiagonalTemplate.panels[0],
          panelRect: { x: 0, y: 0, width: 0, height: 16 },
        },
      ],
    };

    expect(() => gridTemplateSchema.parse(malformed)).toThrow();
  });
});

function corruptFirstResolvedColor(panels: readonly ViewPanel[]): ViewPanel[] {
  return panels.map((panel, panelIndex) => {
    if (panelIndex > 0) {
      return panel;
    }

    const pixelIndex = panel.pixels.findIndex((pixel) => pixel.occupied);

    if (pixelIndex < 0) {
      throw new Error("Expected at least one resolved color pixel");
    }

    return {
      ...panel,
      pixels: panel.pixels.map((pixel, index) => (index === pixelIndex ? { ...pixel, color: "#000000" } : pixel)),
    };
  });
}

function createHollowCube(): VoxelVolume {
  const size = { x: 3, y: 3, z: 3 };
  const voxels = [];

  for (let z = 0; z < size.z; z += 1) {
    for (let y = 0; y < size.y; y += 1) {
      for (let x = 0; x < size.x; x += 1) {
        if (x !== 1 || y !== 1 || z !== 1) {
          voxels.push({ x, y, z, color: "#ffffff" });
        }
      }
    }
  }

  return { size, voxels };
}
