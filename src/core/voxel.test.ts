import { describe, expect, it } from "vitest";

import { createSwirlSphere, swirlPalette, swirlSphereColor } from "@/benchmarks/swirlSphere";
import { getPanelPixel, makeEmptyPanel, type ProjectionView, type ViewPanel } from "@/core/panels";
import {
  axisViews,
  projectVolumeToAxisPanels,
  projectVolumeToSurfacePanels,
  reconstructProjectedInspectionHull,
  reconstructProjectedHull,
  reconstructVisualHull,
  surfaceViews,
} from "@/core/projection";
import { isInsideSphere, type VoxelVolume } from "@/core/voxel";
import {
  axisPlusDiagonalTemplate,
  createSixSurfaceTemplate,
  gridTemplateSchema,
  sixSurfaceTemplatePresets,
  sixSurfaceTemplatePresetSizes,
} from "@/schemas/template";
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

  it("creates visible-panel hollow shell voxels from currently enabled panels", () => {
    const volume = createSolidCube(3);
    const [front] = projectVolumeToSurfacePanels(volume);
    const result = reconstructProjectedInspectionHull(volume.size, [front as ViewPanel], {
      hollow: true,
      hollowSource: "visible-panel-hollow",
      visibleSurfaces: new Set(["front"]),
    });

    expect(result.volume.voxels).toHaveLength(9);
    expect(result.volume.voxels.every((voxel) => voxel.y === 0)).toBe(true);
    expect(result.ambiguityMarkers).toHaveLength(9);
  });

  it("filters the full projected hull to currently enabled hollow surfaces", () => {
    const volume = createSolidCube(3);
    const panels = projectVolumeToSurfacePanels(volume);
    const result = reconstructProjectedInspectionHull(volume.size, panels, {
      hollow: true,
      hollowSource: "full-hull-surface-filter",
      visibleSurfaces: new Set(["front"]),
    });

    expect(result.volume.voxels).toHaveLength(9);
    expect(result.volume.voxels.every((voxel) => voxel.y === 0)).toBe(true);
  });

  it("shrinks visible-panel hollow shell when another projection constrains the footprint", () => {
    const size = { x: 3, y: 3, z: 3 };
    const front = occupiedPanel({ id: "front", axis: "y", surface: "front", direction: -1 }, 3, 3, [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
    const top = occupiedPanel({ id: "top", axis: "z", surface: "top", direction: 1 }, 3, 3, [
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
    const frontOnly = reconstructProjectedInspectionHull(size, [front], {
      hollow: true,
      hollowSource: "visible-panel-hollow",
      visibleSurfaces: new Set(["front"]),
    });
    const constrained = reconstructProjectedInspectionHull(size, [front, top], {
      hollow: true,
      hollowSource: "visible-panel-hollow",
      visibleSurfaces: new Set(["front", "top"]),
    });

    expect(frontOnly.volume.voxels).toHaveLength(9);
    expect(constrained.volume.voxels.length).toBeLessThan(frontOnly.volume.voxels.length);
    expect(constrained.volume.voxels.every((voxel) => voxel.x === 1)).toBe(true);
  });

  it("keeps empty projected hollow hulls empty", () => {
    const size = { x: 3, y: 3, z: 3 };
    const front = makeEmptyPanel({ id: "front", axis: "y", surface: "front", direction: -1 }, 3, 3);
    const result = reconstructProjectedInspectionHull(size, [front], {
      hollow: true,
      hollowSource: "visible-panel-hollow",
      visibleSurfaces: new Set(["front"]),
    });

    expect(result.volume.voxels).toEqual([]);
    expect(result.ambiguityMarkers).toEqual([]);
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
  it("defines schema-backed six-surface MVP presets for 16, 32, and 64 grids", () => {
    expect(sixSurfaceTemplatePresetSizes).toEqual([16, 32, 64]);

    for (const size of sixSurfaceTemplatePresetSizes) {
      const template = gridTemplateSchema.parse(sixSurfaceTemplatePresets[size]);

      expect(template.id).toBe(`six-surface-${size}-v1`);
      expect(template.gridSize).toEqual({ x: size, y: size, z: size });
      expect(template.panels.map((panel) => panel.id)).toEqual([
        "front",
        "back",
        "left",
        "right",
        "top",
        "bottom",
      ]);
      expect(template.validation.requiredViews).toEqual([
        "front",
        "back",
        "left",
        "right",
        "top",
        "bottom",
      ]);
      expect(template.panels.every((panel) => panel.panelRect.width === size && panel.panelRect.height === size)).toBe(
        true,
      );
    }
  });

  it("keeps the six-surface template layout inside a 3-by-2 combined image grid", () => {
    const size = 16;
    const template = createSixSurfaceTemplate(size);
    const expectedRects = [
      ["front", { x: 0, y: 0, width: size, height: size }],
      ["back", { x: size, y: 0, width: size, height: size }],
      ["left", { x: size * 2, y: 0, width: size, height: size }],
      ["right", { x: 0, y: size, width: size, height: size }],
      ["top", { x: size, y: size, width: size, height: size }],
      ["bottom", { x: size * 2, y: size, width: size, height: size }],
    ];

    expect(template.panels.map((panel) => [panel.id, panel.panelRect])).toEqual(expectedRects);
    expect(
      template.panels.every(
        (panel) =>
          panel.panelRect.x + panel.panelRect.width <= size * 3 &&
          panel.panelRect.y + panel.panelRect.height <= size * 2,
      ),
    ).toBe(true);
  });

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

function createSolidCube(edge: number): VoxelVolume {
  const size = { x: edge, y: edge, z: edge };
  const voxels = [];

  for (let z = 0; z < edge; z += 1) {
    for (let y = 0; y < edge; y += 1) {
      for (let x = 0; x < edge; x += 1) {
        voxels.push({ x, y, z, color: "#ffffff" });
      }
    }
  }

  return { size, voxels };
}

function occupiedPanel(
  view: ProjectionView,
  width: number,
  height: number,
  occupiedCoordinates: readonly (readonly [number, number])[],
): ViewPanel {
  const occupied = new Set(occupiedCoordinates.map(([x, y]) => `${x},${y}`));

  return {
    ...view,
    width,
    height,
    pixels: Array.from({ length: width * height }, (_, index) => {
      const x = index % width;
      const y = Math.floor(index / width);

      return occupied.has(`${x},${y}`) ? { occupied: true, color: "#ffffff" } : { occupied: false, color: null };
    }),
  };
}
