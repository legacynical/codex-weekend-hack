export type VoxelPoint = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export type GridSize = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export type Voxel = VoxelPoint &
  Readonly<{
    color: string;
  }>;

export type VoxelVolume = Readonly<{
  size: GridSize;
  voxels: readonly Voxel[];
}>;

export function voxelKey(point: VoxelPoint): string {
  return `${point.x},${point.y},${point.z}`;
}

export function makeVoxelMap(voxels: readonly Voxel[]): Map<string, Voxel> {
  return new Map(voxels.map((voxel) => [voxelKey(voxel), voxel]));
}

export function isSameGridSize(left: GridSize, right: GridSize): boolean {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

export function isInsideSphere(point: VoxelPoint, size: GridSize): boolean {
  const center = {
    x: (size.x - 1) / 2,
    y: (size.y - 1) / 2,
    z: (size.z - 1) / 2,
  };
  const radius = Math.min(size.x, size.y, size.z) / 2 - 0.5;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const dz = point.z - center.z;

  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

export function enumerateGrid(size: GridSize): VoxelPoint[] {
  const points: VoxelPoint[] = [];

  for (let z = 0; z < size.z; z += 1) {
    for (let y = 0; y < size.y; y += 1) {
      for (let x = 0; x < size.x; x += 1) {
        points.push({ x, y, z });
      }
    }
  }

  return points;
}
