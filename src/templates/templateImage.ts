export const gridTemplateSizes = [16, 32, 64] as const;

export type GridTemplateSize = (typeof gridTemplateSizes)[number];

export type TemplateImageMetrics = Readonly<{
  cellPixels: number;
  height: number;
  cells: GridTemplateSize;
  width: number;
}>;

export const gridTemplateImagePixels = 1024;

export function getTemplateImageMetrics(size: GridTemplateSize): TemplateImageMetrics {
  const cellPixels = gridTemplateImagePixels / size;

  return {
    cellPixels,
    cells: size,
    height: gridTemplateImagePixels,
    width: gridTemplateImagePixels,
  };
}

export function createGridTemplatePngDataUrl(size: GridTemplateSize): string {
  const metrics = getTemplateImageMetrics(size);
  const canvas = document.createElement("canvas");
  canvas.width = metrics.width;
  canvas.height = metrics.height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(`Could not create ${size} grid template canvas`);
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  drawCellGrid(context, 0, 0, size, size, metrics.cellPixels);

  return canvas.toDataURL("image/png");
}

export function downloadGridTemplatePng(size: GridTemplateSize): void {
  const link = document.createElement("a");
  link.href = createGridTemplatePngDataUrl(size);
  link.download = `pixel-grid-${size}.png`;
  link.rel = "noopener";
  link.click();
}

function drawCellGrid(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  columns: number,
  rows: number,
  cellPixels: number,
): void {
  context.fillStyle = "#ffffff";
  const width = columns * cellPixels;
  const height = rows * cellPixels;

  for (let column = 0; column <= columns; column += 1) {
    const lineX = x + Math.min(column * cellPixels, width - 1);
    context.fillRect(lineX, y, 1, height);
  }

  for (let row = 0; row <= rows; row += 1) {
    const lineY = y + Math.min(row * cellPixels, height - 1);
    context.fillRect(x, lineY, width, 1);
  }
}
