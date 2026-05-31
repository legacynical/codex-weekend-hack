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
  conflictMarkers: readonly ProjectionMarker[];
  ambiguityMarkers: readonly ProjectionMarker[];
}>;

export type ProjectionMarker = VoxelPoint &
  Readonly<{
    label: "x" | "?";
    color: string;
    surface?: ProjectionView["surface"];
  }>;

export type ProjectedInspectionSourceMode = "visible-panel-hollow" | "full-hull-surface-filter";

export type ProjectedInspectionOptions = Readonly<{
  hollow?: boolean;
  hollowSource?: ProjectedInspectionSourceMode;
  visibleSurfaces?: ReadonlySet<NonNullable<ProjectionView["surface"]>>;
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
  const colorConflictDetails = findDirectPanelColorConflictDetails(panels);
  const colorConflicts = colorConflictDetails.map(
    (conflict) => `${conflict.key}:${conflict.colors.join("|")}`,
  );
  const conflictMarkers = colorConflictDetails.map((conflict) =>
    markerFromPanelPixel(size, conflict.panel, conflict.x, conflict.y, "x", "#ef4444"),
  );

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

  return { volume: { size, voxels }, colorConflicts, conflictMarkers, ambiguityMarkers: [] };
}

export function reconstructProjectedInspectionHull(
  size: GridSize,
  panels: readonly ViewPanel[],
  options: ProjectedInspectionOptions = {},
): ProjectedHullResult {
  const visiblePanels = filterVisiblePanels(panels, options.visibleSurfaces);

  if (!options.hollow) {
    return reconstructProjectedHull(size, visiblePanels);
  }

  const sourcePanels = options.hollowSource === "full-hull-surface-filter" ? panels : visiblePanels;
  const base = reconstructProjectedHull(size, sourcePanels);
  const visiblePanelSet = visiblePanels.length > 0 ? visiblePanels : sourcePanels;
  const occupied = new Set(base.volume.voxels.map((voxel) => pointKey(voxel)));
  const shellVoxels = base.volume.voxels.filter((voxel) =>
    visiblePanelSet.some((panel) => isVisibleFromPanel(voxel, panel, occupied, size)),
  );
  const ambiguityMarkers = shellVoxels
    .filter((voxel) => {
      const evidenceCount = visiblePanelSet.filter((panel) => isVisibleFromPanel(voxel, panel, occupied, size)).length;

      return visiblePanelSet.length < 3 || evidenceCount < 2;
    })
    .map((voxel) => ({ ...voxel, label: "?" as const, color: "#facc15" }));

  return {
    colorConflicts: base.colorConflicts,
    conflictMarkers: base.conflictMarkers,
    ambiguityMarkers,
    volume: {
      size,
      voxels: shellVoxels,
    },
  };
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

export function visibleSurfaceColor(
  volume: VoxelVolume,
  point: VoxelPoint,
  axis: ProjectionView["axis"],
  direction: ProjectionView["direction"] = -1,
): string | null {
  const voxelMap = makeVoxelMap(volume.voxels);

  switch (axis) {
    case "x":
      return direction < 0
        ? findFirstVisibleColor(voxelMap, { ...point, x: 0 }, { ...point, x: volume.size.x })
        : findFirstVisibleColor(voxelMap, { ...point, x: volume.size.x - 1 }, { ...point, x: -1 });
    case "y":
      return direction < 0
        ? findFirstVisibleColor(voxelMap, { ...point, y: 0 }, { ...point, y: volume.size.y })
        : findFirstVisibleColor(voxelMap, { ...point, y: volume.size.y - 1 }, { ...point, y: -1 });
    case "z":
      return direction < 0
        ? findFirstVisibleColor(voxelMap, { ...point, z: 0 }, { ...point, z: volume.size.z })
        : findFirstVisibleColor(voxelMap, { ...point, z: volume.size.z - 1 }, { ...point, z: -1 });
  }
}

export function projectionRayBoundaryPoint(
  size: GridSize,
  panel: Pick<ViewPanel, "axis" | "direction">,
  x: number,
  y: number,
): VoxelPoint {
  switch (panel.axis) {
    case "x":
      return { x: panel.direction && panel.direction > 0 ? size.x - 1 : 0, y: x, z: y };
    case "y":
      return { x, y: panel.direction && panel.direction > 0 ? size.y - 1 : 0, z: y };
    case "z":
      return { x, y, z: panel.direction && panel.direction > 0 ? size.z - 1 : 0 };
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

function filterVisiblePanels(
  panels: readonly ViewPanel[],
  visibleSurfaces?: ReadonlySet<NonNullable<ProjectionView["surface"]>>,
): ViewPanel[] {
  if (!visibleSurfaces) {
    return [...panels];
  }

  return panels.filter((panel) => !panel.surface || visibleSurfaces.has(panel.surface));
}

type DirectPanelColorConflict = Readonly<{
  key: string;
  colors: readonly string[];
  panel: ViewPanel;
  x: number;
  y: number;
}>;

function findDirectPanelColorConflictDetails(panels: readonly ViewPanel[]): DirectPanelColorConflict[] {
  const evidenceByRay = new Map<
    string,
    {
      colors: Set<string>;
      panel: ViewPanel;
      x: number;
      y: number;
    }
  >();

  for (const panel of panels) {
    const rayId = `${panel.surface ?? panel.id}:${panel.axis}:${panel.direction ?? 0}`;

    panel.pixels.forEach((pixel, index) => {
      if (!pixel.occupied || !pixel.color) {
        return;
      }

      const x = index % panel.width;
      const y = Math.floor(index / panel.width);
      const key = `${rayId}:${x},${y}`;
      const evidence = evidenceByRay.get(key) ?? { colors: new Set<string>(), panel, x, y };
      evidence.colors.add(pixel.color);
      evidenceByRay.set(key, evidence);
    });
  }

  return [...evidenceByRay.entries()]
    .filter(([, evidence]) => evidence.colors.size > 1)
    .map(([key, evidence]) => ({ key, colors: [...evidence.colors], panel: evidence.panel, x: evidence.x, y: evidence.y }));
}

function markerFromPanelPixel(
  size: GridSize,
  panel: ViewPanel,
  x: number,
  y: number,
  label: ProjectionMarker["label"],
  color: string,
): ProjectionMarker {
  return {
    ...projectionRayBoundaryPoint(size, panel, x, y),
    label,
    color,
    surface: panel.surface,
  };
}
