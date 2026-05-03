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
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawCellGrid(context, 0, 0, size, size, metrics.cellPixels);
  context.strokeStyle = "#0f766e";
  context.lineWidth = 2;
  context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

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
  context.strokeStyle = "rgba(15, 23, 42, 0.18)";
  context.lineWidth = 1;
  context.beginPath();

  for (let column = 0; column <= columns; column += 1) {
    const lineX = x + column * cellPixels + (column === 0 || column === columns ? 0 : 0.5);
    context.moveTo(lineX, y);
    context.lineTo(lineX, y + rows * cellPixels);
  }

  for (let row = 0; row <= rows; row += 1) {
    const lineY = y + row * cellPixels + (row === 0 || row === rows ? 0 : 0.5);
    context.moveTo(x, lineY);
    context.lineTo(x + columns * cellPixels, lineY);
  }

  context.stroke();
}
