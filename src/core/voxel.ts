export type VoxelPoint = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export function isInsideSphere(point: VoxelPoint, radius: number): boolean {
  const center = (radius - 1) / 2;
  const dx = point.x - center;
  const dy = point.y - center;
  const dz = point.z - center;

  return dx * dx + dy * dy + dz * dz <= center * center;
}
