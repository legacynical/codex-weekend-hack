import type { ViewPanel } from "@/core/panels";
import { findSilhouetteMismatches, projectionRayBoundaryPoint, visibleSurfaceColor } from "@/core/projection";
import { makeVoxelMap, voxelKey, type VoxelPoint, type VoxelVolume } from "@/core/voxel";

export type ValidationStatus = "valid" | "invalid" | "ambiguous";

export type ValidationReport = Readonly<{
  status: ValidationStatus;
  geometry: {
    connected: boolean;
    watertight: boolean;
    unsupportedFloatingVoxels: readonly string[];
    silhouetteMismatches: readonly string[];
  };
  color: {
    coherent: boolean;
    mismatches: readonly string[];
  };
  failureReasons: readonly string[];
}>;

export function validateVoxelCandidate(volume: VoxelVolume, panels: readonly ViewPanel[]): ValidationReport {
  const connected = isConnected(volume);
  const watertight = hasNoEnclosedVoids(volume);
  const unsupportedFloatingVoxels = findUnsupportedFloatingVoxels(volume);
  const silhouetteMismatches = findSilhouetteMismatches(volume, panels);
  const colorMismatches = findColorMismatches(volume, panels);
  const failureReasons = [
    !connected ? "Volume is disconnected" : null,
    !watertight ? "Volume contains enclosed voids" : null,
    unsupportedFloatingVoxels.length > 0 ? "Volume contains unsupported floating voxels" : null,
    silhouetteMismatches.length > 0 ? "Volume does not match input silhouettes" : null,
    colorMismatches.length > 0 ? "Surface colors conflict with projected panels" : null,
  ].filter((reason): reason is string => reason !== null);

  return {
    status: failureReasons.length === 0 ? "valid" : "invalid",
    geometry: {
      connected,
      watertight,
      unsupportedFloatingVoxels,
      silhouetteMismatches,
    },
    color: {
      coherent: colorMismatches.length === 0,
      mismatches: colorMismatches,
    },
    failureReasons,
  };
}

export function isConnected(volume: VoxelVolume): boolean {
  if (volume.voxels.length === 0) {
    return false;
  }

  const voxelMap = makeVoxelMap(volume.voxels);
  const visited = new Set<string>();
  const queue = [volume.voxels[0] as VoxelPoint];
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    queueIndex += 1;
    const currentKey = voxelKey(current);

    if (visited.has(currentKey)) {
      continue;
    }

    visited.add(currentKey);

    for (const neighbor of neighbors(current)) {
      const neighborKey = voxelKey(neighbor);

      if (voxelMap.has(neighborKey) && !visited.has(neighborKey)) {
        queue.push(neighbor);
      }
    }
  }

  return visited.size === volume.voxels.length;
}

export function findUnsupportedFloatingVoxels(volume: VoxelVolume): string[] {
  const voxelMap = makeVoxelMap(volume.voxels);

  return volume.voxels
    .filter(
      (voxel) =>
        voxel.z > 0 &&
        !neighbors(voxel).some((neighbor) => voxelMap.has(voxelKey(neighbor))),
    )
    .map(voxelKey);
}

export function hasNoEnclosedVoids(volume: VoxelVolume): boolean {
  const occupied = makeVoxelMap(volume.voxels);
  const exterior = new Set<string>();
  const queue: VoxelPoint[] = [];
  let queueIndex = 0;

  for (let z = 0; z < volume.size.z; z += 1) {
    for (let y = 0; y < volume.size.y; y += 1) {
      for (let x = 0; x < volume.size.x; x += 1) {
        const point = { x, y, z };

        if (isBoundaryPoint(point, volume) && !occupied.has(voxelKey(point))) {
          queue.push(point);
        }
      }
    }
  }

  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    queueIndex += 1;
    const currentKey = voxelKey(current);

    if (exterior.has(currentKey) || occupied.has(currentKey)) {
      continue;
    }

    exterior.add(currentKey);

    for (const neighbor of neighbors(current)) {
      if (isInsideGrid(neighbor, volume) && !occupied.has(voxelKey(neighbor)) && !exterior.has(voxelKey(neighbor))) {
        queue.push(neighbor);
      }
    }
  }

  for (let z = 0; z < volume.size.z; z += 1) {
    for (let y = 0; y < volume.size.y; y += 1) {
      for (let x = 0; x < volume.size.x; x += 1) {
        const point = { x, y, z };
        const key = voxelKey(point);

        if (!occupied.has(key) && !exterior.has(key)) {
          return false;
        }
      }
    }
  }

  return true;
}

export function findColorMismatches(volume: VoxelVolume, panels: readonly ViewPanel[]): string[] {
  return panels.flatMap((panel) => {
    const mismatches: string[] = [];

    for (let index = 0; index < panel.pixels.length; index += 1) {
      const panelPixel = panel.pixels[index];

      if (!panelPixel?.occupied || panelPixel.color === null) {
        continue;
      }

      const x = index % panel.width;
      const y = Math.floor(index / panel.width);
      const rayPoint = projectionRayBoundaryPoint(volume.size, panel, x, y);
      const visibleColor = visibleSurfaceColor(volume, rayPoint, panel.axis, panel.direction);

      if (visibleColor !== null && panelPixel.color !== visibleColor) {
        mismatches.push(`${panel.id}:${x},${y}:expected-${panelPixel.color}:actual-${visibleColor}`);
      }
    }

    return mismatches;
  });
}

function neighbors(point: VoxelPoint): VoxelPoint[] {
  return [
    { x: point.x + 1, y: point.y, z: point.z },
    { x: point.x - 1, y: point.y, z: point.z },
    { x: point.x, y: point.y + 1, z: point.z },
    { x: point.x, y: point.y - 1, z: point.z },
    { x: point.x, y: point.y, z: point.z + 1 },
    { x: point.x, y: point.y, z: point.z - 1 },
  ];
}

function isBoundaryPoint(point: VoxelPoint, volume: VoxelVolume): boolean {
  return (
    point.x === 0 ||
    point.y === 0 ||
    point.z === 0 ||
    point.x === volume.size.x - 1 ||
    point.y === volume.size.y - 1 ||
    point.z === volume.size.z - 1
  );
}

function isInsideGrid(point: VoxelPoint, volume: VoxelVolume): boolean {
  return (
    point.x >= 0 &&
    point.y >= 0 &&
    point.z >= 0 &&
    point.x < volume.size.x &&
    point.y < volume.size.y &&
    point.z < volume.size.z
  );
}
