import { enumerateGrid, isInsideSphere, type GridSize, type VoxelPoint, type VoxelVolume } from "@/core/voxel";

export const swirlPalette = ["#e63946", "#f77f00", "#fcbf49", "#2a9d8f", "#457b9d", "#6d597a"] as const;

export function swirlSphereColor(point: VoxelPoint, size: GridSize): string {
  const centerX = (size.x - 1) / 2;
  const centerY = (size.y - 1) / 2;
  const theta = Math.atan2(point.y - centerY, point.x - centerX);
  const height = size.z <= 1 ? 0 : point.z / (size.z - 1);
  const turns = 2;
  const normalized = wrap01((theta + turns * Math.PI * 2 * height) / (Math.PI * 2));
  const index = Math.floor(normalized * swirlPalette.length) % swirlPalette.length;

  return swirlPalette[index];
}

export function createSwirlSphere(size: GridSize): VoxelVolume {
  return {
    size,
    voxels: enumerateGrid(size)
      .filter((point) => isInsideSphere(point, size))
      .map((point) => ({
        ...point,
        color: swirlSphereColor(point, size),
      })),
  };
}

function wrap01(value: number): number {
  return value - Math.floor(value);
}
