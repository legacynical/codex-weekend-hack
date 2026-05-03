import { getPanelPixel, type ProjectionView, type ViewPanel } from "@/core/panels";
import { makeVoxelMap, type GridSize, type VoxelPoint, type VoxelVolume } from "@/core/voxel";

export const axisViews = [
  { id: "side-x", axis: "x" },
  { id: "front-y", axis: "y" },
  { id: "top-z", axis: "z" },
] as const satisfies readonly ProjectionView[];

export function projectPoint(point: VoxelPoint, axis: ProjectionView["axis"]): { x: number; y: number } {
  switch (axis) {
    case "x":
      return { x: point.y, y: point.z };
    case "y":
      return { x: point.x, y: point.z };
    case "z":
      return { x: point.x, y: point.y };
  }
}

export function panelDimensions(size: GridSize, axis: ProjectionView["axis"]): { width: number; height: number } {
  switch (axis) {
    case "x":
      return { width: size.y, height: size.z };
    case "y":
      return { width: size.x, height: size.z };
    case "z":
      return { width: size.x, height: size.y };
  }
}

export function projectVolumeToPanel(volume: VoxelVolume, view: ProjectionView): ViewPanel {
  const { width, height } = panelDimensions(volume.size, view.axis);
  const pixels = Array.from({ length: width * height }, () => ({ occupied: false, color: null as string | null }));

  for (const voxel of volume.voxels) {
    const projected = projectPoint(voxel, view.axis);
    const pixelIndex = projected.y * width + projected.x;
    const pixel = pixels[pixelIndex];

    if (!pixel) {
      throw new RangeError(`Projected voxel ${voxel.x},${voxel.y},${voxel.z} outside ${view.id}`);
    }

    if (!pixel.occupied) {
      pixels[pixelIndex] = { occupied: true, color: voxel.color };
    }
  }

  return {
    ...view,
    width,
    height,
    pixels,
  };
}

export function projectVolumeToAxisPanels(volume: VoxelVolume): ViewPanel[] {
  return axisViews.map((view) => projectVolumeToPanel(volume, view));
}

export function reconstructVisualHull(size: GridSize, panels: readonly ViewPanel[]): VoxelVolume {
  const voxels = [];

  for (let z = 0; z < size.z; z += 1) {
    for (let y = 0; y < size.y; y += 1) {
      for (let x = 0; x < size.x; x += 1) {
        const point = { x, y, z };
        const projectedPixels = panels.map((panel) => getPanelPixel(panel, projectPoint(point, panel.axis).x, projectPoint(point, panel.axis).y));

        if (projectedPixels.every((pixel) => pixel.occupied)) {
          const color = projectedPixels.find((pixel) => pixel.color)?.color ?? "#ffffff";
          voxels.push({ ...point, color });
        }
      }
    }
  }

  return { size, voxels };
}

export function findSilhouetteMismatches(volume: VoxelVolume, panels: readonly ViewPanel[]): string[] {
  return panels.flatMap((panel) => {
    const projected = projectVolumeToPanel(volume, panel);
    const mismatches: string[] = [];

    for (let index = 0; index < panel.pixels.length; index += 1) {
      if (panel.pixels[index]?.occupied !== projected.pixels[index]?.occupied) {
        const x = index % panel.width;
        const y = Math.floor(index / panel.width);
        mismatches.push(`${panel.id}:${x},${y}`);
      }
    }

    return mismatches;
  });
}

export function visibleSurfaceColor(volume: VoxelVolume, point: VoxelPoint, axis: ProjectionView["axis"]): string | null {
  const voxelMap = makeVoxelMap(volume.voxels);

  switch (axis) {
    case "x":
      return findFirstVisibleColor(voxelMap, { ...point, x: 0 }, { ...point, x: volume.size.x });
    case "y":
      return findFirstVisibleColor(voxelMap, { ...point, y: 0 }, { ...point, y: volume.size.y });
    case "z":
      return findFirstVisibleColor(voxelMap, { ...point, z: 0 }, { ...point, z: volume.size.z });
  }
}

function findFirstVisibleColor(
  voxelMap: Map<string, { color: string }>,
  start: VoxelPoint,
  endExclusive: VoxelPoint,
): string | null {
  const step = {
    x: Math.sign(endExclusive.x - start.x),
    y: Math.sign(endExclusive.y - start.y),
    z: Math.sign(endExclusive.z - start.z),
  };
  let point = { ...start };

  while (point.x !== endExclusive.x || point.y !== endExclusive.y || point.z !== endExclusive.z) {
    const voxel = voxelMap.get(`${point.x},${point.y},${point.z}`);

    if (voxel) {
      return voxel.color;
    }

    point = {
      x: point.x + step.x,
      y: point.y + step.y,
      z: point.z + step.z,
    };
  }

  return null;
}
