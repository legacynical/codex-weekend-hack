import { deflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const IMAGE_EDGE = 1024;

export function createPanelPng({
  preset,
  occupiedCells,
  color = "#336699",
}: {
  preset: 16 | 32 | 64;
  occupiedCells: readonly (readonly [number, number])[];
  color?: `#${string}`;
}): Buffer {
  const bytesPerRow = IMAGE_EDGE * 4 + 1;
  const raw = Buffer.alloc(bytesPerRow * IMAGE_EDGE);
  const [red, green, blue] = hexColor(color);

  for (let y = 0; y < IMAGE_EDGE; y += 1) {
    const rowStart = y * bytesPerRow;
    raw[rowStart] = 0;

    for (let x = 0; x < IMAGE_EDGE; x += 1) {
      const pixel = rowStart + 1 + x * 4;
      raw[pixel] = 255;
      raw[pixel + 1] = 255;
      raw[pixel + 2] = 255;
      raw[pixel + 3] = 255;
    }
  }

  const cellPixels = IMAGE_EDGE / preset;
  for (const [cellX, cellY] of occupiedCells) {
    for (let y = cellY * cellPixels; y < (cellY + 1) * cellPixels; y += 1) {
      const rowStart = y * bytesPerRow;

      for (let x = cellX * cellPixels; x < (cellX + 1) * cellPixels; x += 1) {
        const pixel = rowStart + 1 + x * 4;
        raw[pixel] = red;
        raw[pixel + 1] = green;
        raw[pixel + 2] = blue;
        raw[pixel + 3] = 255;
      }
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(IMAGE_EDGE, 0);
  header.writeUInt32BE(IMAGE_EDGE, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), data.length + 8);
  return chunk;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function hexColor(color: `#${string}`): readonly [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    throw new Error(`Expected a six-digit RGB color, received ${color}.`);
  }

  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
}
