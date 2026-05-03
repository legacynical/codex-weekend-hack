import { describe, expect, it } from "vitest";

import { getPanelOrientation } from "@/rendering/voxelScene";

describe("getPanelOrientation", () => {
  it("keeps the projected panel basis aligned with panel coordinates", () => {
    expect(getPanelOrientation({ axis: "x", surface: "left" })).toEqual({
      xAxis: [0, 1, 0],
      yAxis: [0, 0, -1],
      zAxis: [-1, 0, 0],
      flipV: true,
    });
    expect(getPanelOrientation({ axis: "x", surface: "right" })).toEqual({
      xAxis: [0, 1, 0],
      yAxis: [0, 0, 1],
      zAxis: [1, 0, 0],
      flipV: false,
    });
    expect(getPanelOrientation({ axis: "y", surface: "front" })).toEqual({
      xAxis: [1, 0, 0],
      yAxis: [0, 0, 1],
      zAxis: [0, -1, 0],
      flipV: false,
    });
    expect(getPanelOrientation({ axis: "y", surface: "back" })).toEqual({
      xAxis: [1, 0, 0],
      yAxis: [0, 0, -1],
      zAxis: [0, 1, 0],
      flipV: true,
    });
    expect(getPanelOrientation({ axis: "z", surface: "top" })).toEqual({
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
      zAxis: [0, 0, 1],
      flipV: false,
    });
    expect(getPanelOrientation({ axis: "z", surface: "bottom" })).toEqual({
      xAxis: [1, 0, 0],
      yAxis: [0, -1, 0],
      zAxis: [0, 0, -1],
      flipV: true,
    });
  });

  it("keeps unsigned axis panels on the existing right/front/top orientations", () => {
    expect(getPanelOrientation({ axis: "x" })).toEqual({
      xAxis: [0, 1, 0],
      yAxis: [0, 0, 1],
      zAxis: [1, 0, 0],
      flipV: false,
    });
    expect(getPanelOrientation({ axis: "y" })).toEqual({
      xAxis: [1, 0, 0],
      yAxis: [0, 0, 1],
      zAxis: [0, -1, 0],
      flipV: false,
    });
    expect(getPanelOrientation({ axis: "z" })).toEqual({
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
      zAxis: [0, 0, 1],
      flipV: false,
    });
  });
});
