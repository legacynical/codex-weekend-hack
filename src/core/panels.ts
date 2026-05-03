export type PanelPixel = Readonly<{
  occupied: boolean;
  color: string | null;
}>;

export type ViewAxis = "x" | "y" | "z";

export type ProjectionView = Readonly<{
  id: string;
  axis: ViewAxis;
}>;

export type ViewPanel = ProjectionView &
  Readonly<{
    width: number;
    height: number;
    pixels: readonly PanelPixel[];
  }>;

export function getPanelPixel(panel: ViewPanel, x: number, y: number): PanelPixel {
  const pixel = panel.pixels[y * panel.width + x];

  if (!pixel) {
    throw new RangeError(`Panel coordinate ${x},${y} is outside ${panel.id}`);
  }

  return pixel;
}

export function makeEmptyPanel(view: ProjectionView, width: number, height: number): ViewPanel {
  return {
    ...view,
    width,
    height,
    pixels: Array.from({ length: width * height }, () => ({ occupied: false, color: null })),
  };
}
