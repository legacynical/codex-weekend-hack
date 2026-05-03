import { getPanelPixel, type ProjectionView, type ViewPanel } from "@/core/panels";
import { makeVoxelMap, type GridSize, type VoxelPoint, type VoxelVolume } from "@/core/voxel";

export const axisViews = [
  { id: "side-x", axis: "x" },
  { id: "front-y", axis: "y" },
  { id: "top-z", axis: "z" },
] as const satisfies readonly ProjectionView[];

export const surfaceViews = [
  { id: "front", axis: "y", surface: "front", direction: -1 },
  { id: "back", axis: "y", surface: "back", direction: 1 },
  { id: "left", axis: "x", surface: "left", direction: -1 },
  { id: "right", axis: "x", surface: "right", direction: 1 },
  { id: "top", axis: "z", surface: "top", direction: 1 },
  { id: "bottom", axis: "z", surface: "bottom", direction: -1 },
] as const satisfies readonly ProjectionView[];

export type ProjectedHullResult = Readonly<{
  volume: VoxelVolume;
  colorConflicts: readonly string[];
}>;

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
  const visibleDepth = Array.from({ length: width * height }, () => Number.NEGATIVE_INFINITY);

  for (const voxel of volume.voxels) {
    const projected = projectPoint(voxel, view.axis);
    const pixelIndex = projected.y * width + projected.x;
    const pixel = pixels[pixelIndex];

    if (!pixel) {
      throw new RangeError(`Projected voxel ${voxel.x},${voxel.y},${voxel.z} outside ${view.id}`);
    }

    const depth = view.direction ? surfaceDepth(voxel, view.axis, view.direction, volume.size) : 0;

    if (!pixel.occupied || depth > visibleDepth[pixelIndex]) {
      pixels[pixelIndex] = { occupied: true, color: voxel.color };
      visibleDepth[pixelIndex] = depth;
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

export function projectVolumeToSurfacePanels(volume: VoxelVolume): ViewPanel[] {
  return surfaceViews.map((view) => projectVolumeToPanel(volume, view));
}

export function reconstructVisualHull(size: GridSize, panels: readonly ViewPanel[]): VoxelVolume {
  return reconstructProjectedHull(size, panels).volume;
}

export function reconstructProjectedHull(size: GridSize, panels: readonly ViewPanel[]): ProjectedHullResult {
  const candidatePoints = [];
  const colorConflicts = findDirectPanelColorConflicts(panels);

  for (let z = 0; z < size.z; z += 1) {
    for (let y = 0; y < size.y; y += 1) {
      for (let x = 0; x < size.x; x += 1) {
        const point = { x, y, z };
        const projectedPixels = panels.map((panel) => getProjectedPixel(panel, point));

        if (projectedPixels.every((pixel) => pixel.occupied)) {
          candidatePoints.push(point);
        }
      }
    }
  }

  const occupied = new Set(candidatePoints.map((point) => pointKey(point)));
  const voxels = candidatePoints.map((point) => {
    const visiblePixels = panels
      .filter((panel) => isVisibleFromPanel(point, panel, occupied, size))
      .map((panel) => getProjectedPixel(panel, point));
    const colorEvidence = visiblePixels.length > 0 ? visiblePixels : panels.map((panel) => getProjectedPixel(panel, point));
    const colors = [...new Set(colorEvidence.map((pixel) => pixel.color).filter((color): color is string => color !== null))];
    const color = colors[0] ?? "#ffffff";

    return { ...point, color };
  });

  return { volume: { size, voxels }, colorConflicts };
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

function surfaceDepth(point: VoxelPoint, axis: ProjectionView["axis"], direction: -1 | 1, size: GridSize): number {
  const value = point[axis];
  const max = size[axis] - 1;

  return direction > 0 ? value : max - value;
}

function getProjectedPixel(panel: ViewPanel, point: VoxelPoint) {
  const projected = projectPoint(point, panel.axis);

  return getPanelPixel(panel, projected.x, projected.y);
}

function isVisibleFromPanel(
  point: VoxelPoint,
  panel: ViewPanel,
  occupied: ReadonlySet<string>,
  size: GridSize,
): boolean {
  if (!panel.direction) {
    return true;
  }

  const next = { ...point };
  const axis = panel.axis;
  next[axis] += panel.direction;

  while (next[axis] >= 0 && next[axis] < size[axis]) {
    if (occupied.has(pointKey(next))) {
      return false;
    }

    next[axis] += panel.direction;
  }

  return true;
}

function pointKey(point: VoxelPoint): string {
  return `${point.x},${point.y},${point.z}`;
}

function findDirectPanelColorConflicts(panels: readonly ViewPanel[]): string[] {
  const colorsByRay = new Map<string, Set<string>>();

  for (const panel of panels) {
    const rayId = `${panel.surface ?? panel.id}:${panel.axis}:${panel.direction ?? 0}`;

    panel.pixels.forEach((pixel, index) => {
      if (!pixel.occupied || !pixel.color) {
        return;
      }

      const x = index % panel.width;
      const y = Math.floor(index / panel.width);
      const key = `${rayId}:${x},${y}`;
      const colors = colorsByRay.get(key) ?? new Set<string>();
      colors.add(pixel.color);
      colorsByRay.set(key, colors);
    });
  }

  return [...colorsByRay.entries()]
    .filter(([, colors]) => colors.size > 1)
    .map(([key, colors]) => `${key}:${[...colors].join("|")}`);
}
