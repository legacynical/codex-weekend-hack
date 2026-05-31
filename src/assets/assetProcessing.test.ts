import { describe, expect, it } from "vitest";

import {
  processBrowserPanelAssetSource,
  processDecodedPanelAsset,
  type DecodedImageData,
} from "@/assets/assetProcessing";

const SOURCE_SIZE = 1024;

describe("processDecodedPanelAsset", () => {
  it("accepts a strict 16 preset source with occupied color evidence", () => {
    const image = makeTransparentSource();
    paintCell(image, 16, 2, 3, [12, 34, 56, 255]);

    const result = processDecodedPanelAsset({
      preset: 16,
      sourceKind: "upload",
      sourceLabel: "front.png",
      origin: { uploadSlotHint: "front", sourceName: "front.png" },
      image,
    });

    expect(result.status).toBe("accepted");

    if (result.status === "rejected") {
      throw new Error("Expected accepted result");
    }

    expect(result.candidate.parserPolicy).toBe("strict-v1");
    expect(result.candidate.cellSize).toEqual({ width: 64, height: 64 });
    expect(result.candidate.occupiedCellCount).toBe(1);
    expect(result.candidate.origin?.uploadSlotHint).toBe("front");
    expect(result.candidate.cells.find((cell) => cell.x === 2 && cell.y === 3)).toMatchObject({
      classification: "occupied",
      occupied: true,
      color: "#0c2238",
    });
  });

  it("accepts a strict 32 preset source with 32px cells", () => {
    const image = makeTransparentSource();
    paintCell(image, 32, 4, 5, [90, 120, 150, 255]);

    const result = processDecodedPanelAsset({
      preset: 32,
      sourceKind: "upload",
      sourceLabel: "right.png",
      image,
    });

    expect(result.status).toBe("accepted");

    if (result.status === "rejected") {
      throw new Error("Expected accepted result");
    }

    expect(result.candidate.cellSize).toEqual({ width: 32, height: 32 });
    expect(result.candidate.occupiedCellCount).toBe(1);
    expect(result.candidate.cells.find((cell) => cell.x === 4 && cell.y === 5)).toMatchObject({
      classification: "occupied",
      occupied: true,
      color: "#5a7896",
    });
  });

  it("accepts a strict 64 preset source with 16px cells", () => {
    const image = makeTransparentSource();
    paintCell(image, 64, 61, 2, [200, 10, 40, 255]);

    const result = processDecodedPanelAsset({
      preset: 64,
      sourceKind: "upload",
      sourceLabel: "top.png",
      image,
    });

    expect(result.status).toBe("accepted");

    if (result.status === "rejected") {
      throw new Error("Expected accepted result");
    }

    expect(result.candidate.cellSize).toEqual({ width: 16, height: 16 });
    expect(result.candidate.occupiedCellCount).toBe(1);
    expect(result.candidate.cells.find((cell) => cell.x === 61 && cell.y === 2)).toMatchObject({
      classification: "occupied",
      occupied: true,
      color: "#c80a28",
    });
  });

  it("rejects wrong source dimensions before creating panel data", () => {
    const result = processDecodedPanelAsset({
      preset: 16,
      sourceKind: "upload",
      sourceLabel: "small.png",
      image: {
        width: 512,
        height: 1024,
        data: new Uint8ClampedArray(512 * 1024 * 4),
      },
    });

    expect(result.status).toBe("rejected");
    expect(result).not.toHaveProperty("candidate");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "wrongDimensions",
        expected: "1024 x 1024",
        actual: "512 x 1024",
        repairOwner: "presetChoice",
      }),
    );
  });

  it("rejects mixed occupied and background pixels inside a strict cell", () => {
    const image = makeTransparentSource();
    paintCell(image, 16, 0, 0, [20, 40, 60, 255]);
    clearPixel(image, 1, 1);

    const result = processDecodedPanelAsset({
      preset: 16,
      sourceKind: "editor",
      sourceLabel: "edited-front.png",
      image,
    });

    expect(result.status).toBe("rejected");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "malformedCell",
        cell: { x: 0, y: 0 },
        parserPolicy: "strict-v1",
        repairOwner: "editorRepair",
      }),
    );
  });

  it("rejects empty panels under the strict bootstrap policy", () => {
    const result = processDecodedPanelAsset({
      preset: 16,
      sourceKind: "bundled",
      sourceLabel: "empty-front.png",
      image: makeTransparentSource(),
    });

    expect(result.status).toBe("rejected");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "emptyPanel",
        repairOwner: "sourceSelection",
      }),
    );
  });

  it("processes browser image sources through an injected decode boundary", async () => {
    const image = makeTransparentSource();
    paintCell(image, 16, 3, 7, [80, 90, 100, 255]);

    const result = await processBrowserPanelAssetSource({
      preset: 16,
      source: new Blob(["fake png bytes"], { type: "image/png" }),
      sourceKind: "upload",
      sourceLabel: "front.png",
      origin: { uploadSlotHint: "front" },
      decodeImageData: async () => image,
    });

    expect(result.status).toBe("accepted");

    if (result.status === "rejected") {
      throw new Error("Expected accepted result");
    }

    expect(result.candidate.sourceLabel).toBe("front.png");
    expect(result.candidate.origin?.uploadSlotHint).toBe("front");
    expect(result.candidate.cells.find((cell) => cell.x === 3 && cell.y === 7)).toMatchObject({
      classification: "occupied",
      color: "#505a64",
    });
  });

  it("rejects browser sources that cannot be decoded", async () => {
    const result = await processBrowserPanelAssetSource({
      preset: 16,
      source: new Blob(["not an image"], { type: "image/png" }),
      sourceKind: "upload",
      sourceLabel: "broken.png",
      decodeImageData: async () => {
        throw new Error("Image decode failed");
      },
    });

    expect(result.status).toBe("rejected");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "decodeFailure",
        message: "Image decode failed",
        repairOwner: "sourceSelection",
      }),
    );
  });

  it("rejects unsupported browser source MIME types before decode", async () => {
    const result = await processBrowserPanelAssetSource({
      preset: 16,
      source: new Blob(["plain text"], { type: "text/plain" }),
      sourceKind: "upload",
      sourceLabel: "notes.txt",
      decodeImageData: async () => {
        throw new Error("Decode should not run");
      },
    });

    expect(result.status).toBe("rejected");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "unsupportedSourceType",
        actual: "text/plain",
        repairOwner: "sourceSelection",
      }),
    );
  });
});

function makeTransparentSource(): DecodedImageData {
  return {
    width: SOURCE_SIZE,
    height: SOURCE_SIZE,
    data: new Uint8ClampedArray(SOURCE_SIZE * SOURCE_SIZE * 4),
  };
}

function paintCell(
  image: DecodedImageData,
  preset: number,
  cellX: number,
  cellY: number,
  color: readonly [number, number, number, number],
) {
  const cellSize = SOURCE_SIZE / preset;
  const startX = cellX * cellSize;
  const startY = cellY * cellSize;

  for (let y = startY; y < startY + cellSize; y += 1) {
    for (let x = startX; x < startX + cellSize; x += 1) {
      const index = (y * image.width + x) * 4;
      image.data[index] = color[0];
      image.data[index + 1] = color[1];
      image.data[index + 2] = color[2];
      image.data[index + 3] = color[3];
    }
  }
}

function clearPixel(image: DecodedImageData, x: number, y: number) {
  const index = (y * image.width + x) * 4;
  image.data[index] = 0;
  image.data[index + 1] = 0;
  image.data[index + 2] = 0;
  image.data[index + 3] = 0;
}
