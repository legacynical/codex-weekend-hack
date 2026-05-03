import { describe, expect, it } from "vitest";

import { isInsideSphere } from "./voxel";

describe("isInsideSphere", () => {
  it("keeps center voxels and rejects corners", () => {
    expect(isInsideSphere({ x: 3, y: 3, z: 3 }, 8)).toBe(true);
    expect(isInsideSphere({ x: 0, y: 0, z: 0 }, 8)).toBe(false);
  });
});
