import { z } from "zod";

export const panelRectSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const orthographicPanelSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("orthographic"),
  axis: z.enum(["x", "y", "z"]),
  direction: z.enum(["positive", "negative"]),
  surface: z.enum(["front", "back", "left", "right", "top", "bottom"]).optional(),
  panelRect: panelRectSchema,
  channels: z.array(z.enum(["silhouette", "color"])).min(1),
});

export const diagonalPanelSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("diagonal"),
  axis: z.enum(["x", "y", "z"]),
  projection: z.enum(["x_plus_y", "x_minus_y"]),
  panelRect: panelRectSchema,
  channels: z.array(z.enum(["silhouette", "color"])).min(1),
});

export const crossSectionPanelSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("cross-section"),
  plane: z.string().min(1),
  panelRect: panelRectSchema,
  channels: z.array(z.enum(["occupancy", "material"])).min(1),
});

export const templatePanelSchema = z.discriminatedUnion("kind", [
  orthographicPanelSchema,
  diagonalPanelSchema,
  crossSectionPanelSchema,
]);

export const gridTemplateSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  gridSize: z.object({
    x: z.number().int().positive(),
    y: z.number().int().positive(),
    z: z.number().int().positive(),
  }),
  panels: z.array(templatePanelSchema).min(1),
  validation: z.object({
    requiredViews: z.array(z.string().min(1)).min(1),
    optionalViews: z.array(z.string().min(1)).default([]),
    requireConnected: z.boolean(),
    requireWatertight: z.boolean(),
    colorTolerance: z.enum(["exact-palette"]),
  }),
});

export type GridTemplate = z.infer<typeof gridTemplateSchema>;

export const sixSurfaceTemplatePresetSizes = [16, 32, 64] as const;

export type SixSurfaceTemplatePresetSize = (typeof sixSurfaceTemplatePresetSizes)[number];

export function createSixSurfaceTemplate(size: SixSurfaceTemplatePresetSize): GridTemplate {
  return gridTemplateSchema.parse({
    schemaVersion: 1,
    id: `six-surface-${size}-v1`,
    name: `Six signed surfaces ${size}`,
    gridSize: { x: size, y: size, z: size },
    panels: [
      {
        id: "front",
        kind: "orthographic",
        axis: "y",
        direction: "negative",
        surface: "front",
        panelRect: { x: 0, y: 0, width: size, height: size },
        channels: ["silhouette", "color"],
      },
      {
        id: "back",
        kind: "orthographic",
        axis: "y",
        direction: "positive",
        surface: "back",
        panelRect: { x: size, y: 0, width: size, height: size },
        channels: ["silhouette", "color"],
      },
      {
        id: "left",
        kind: "orthographic",
        axis: "x",
        direction: "negative",
        surface: "left",
        panelRect: { x: size * 2, y: 0, width: size, height: size },
        channels: ["silhouette", "color"],
      },
      {
        id: "right",
        kind: "orthographic",
        axis: "x",
        direction: "positive",
        surface: "right",
        panelRect: { x: 0, y: size, width: size, height: size },
        channels: ["silhouette", "color"],
      },
      {
        id: "top",
        kind: "orthographic",
        axis: "z",
        direction: "positive",
        surface: "top",
        panelRect: { x: size, y: size, width: size, height: size },
        channels: ["silhouette", "color"],
      },
      {
        id: "bottom",
        kind: "orthographic",
        axis: "z",
        direction: "negative",
        surface: "bottom",
        panelRect: { x: size * 2, y: size, width: size, height: size },
        channels: ["silhouette", "color"],
      },
    ],
    validation: {
      requiredViews: ["front", "back", "left", "right", "top", "bottom"],
      optionalViews: [],
      requireConnected: true,
      requireWatertight: true,
      colorTolerance: "exact-palette",
    },
  });
}

export const sixSurfaceTemplatePresets = Object.fromEntries(
  sixSurfaceTemplatePresetSizes.map((size) => [size, createSixSurfaceTemplate(size)]),
) as Record<SixSurfaceTemplatePresetSize, GridTemplate>;

export const axisPlusDiagonalTemplate = gridTemplateSchema.parse({
  schemaVersion: 1,
  id: "axis-plus-diagonal-v1",
  name: "Axis views plus z diagonal",
  gridSize: { x: 16, y: 16, z: 16 },
  panels: [
    {
      id: "side-x",
      kind: "orthographic",
      axis: "x",
      direction: "positive",
      panelRect: { x: 0, y: 0, width: 16, height: 16 },
      channels: ["silhouette", "color"],
    },
    {
      id: "front-y",
      kind: "orthographic",
      axis: "y",
      direction: "positive",
      panelRect: { x: 16, y: 0, width: 16, height: 16 },
      channels: ["silhouette", "color"],
    },
    {
      id: "top-z",
      kind: "orthographic",
      axis: "z",
      direction: "positive",
      panelRect: { x: 32, y: 0, width: 16, height: 16 },
      channels: ["silhouette", "color"],
    },
    {
      id: "diag-z-45",
      kind: "diagonal",
      axis: "z",
      projection: "x_plus_y",
      panelRect: { x: 0, y: 16, width: 31, height: 16 },
      channels: ["silhouette", "color"],
    },
  ],
  validation: {
    requiredViews: ["side-x", "front-y", "top-z"],
    optionalViews: ["diag-z-45"],
    requireConnected: true,
    requireWatertight: true,
    colorTolerance: "exact-palette",
  },
});
