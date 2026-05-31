import type { SixSurfaceTemplatePresetSize } from "@/schemas/template";

export type AssetSourceKind = "upload" | "bundled" | "editor";

export type AssetProcessingOrigin = Readonly<{
  uploadSlotHint?: string;
  bundledAssetSetId?: string;
  bundledSourceId?: string;
  editorSourceAssetId?: string;
  sourceName?: string;
}>;

export type DecodedImageData = Readonly<{
  width: number;
  height: number;
  data: Uint8ClampedArray;
}>;

export type StrictParserPolicy = Readonly<{
  id: "strict-v1";
  background: "transparent-or-white";
  rejectMixedCells: true;
  rejectEmptyPanel: true;
}>;

export type AssetParserPolicy = StrictParserPolicy;

export const strictParserPolicy: StrictParserPolicy = {
  id: "strict-v1",
  background: "transparent-or-white",
  rejectMixedCells: true,
  rejectEmptyPanel: true,
};

export type AssetProcessingRequest = Readonly<{
  preset: SixSurfaceTemplatePresetSize;
  sourceKind: AssetSourceKind;
  sourceLabel?: string;
  origin?: AssetProcessingOrigin;
  retryIntent?: "firstAttempt" | "retrySameSource" | "retryWithPolicy" | "replacementSource";
  parserPolicy?: AssetParserPolicy;
  image: DecodedImageData;
}>;

export type CellClassification = "occupied" | "empty" | "malformed" | "ambiguous";

export type ProcessingDiagnosticSeverity = "error" | "warning";

export type ProcessingDiagnosticCode =
  | "decodeFailure"
  | "wrongDimensions"
  | "invalidPixelBuffer"
  | "malformedCell"
  | "unsupportedSourceType"
  | "emptyPanel";

export type ProcessingDiagnostic = Readonly<{
  severity: ProcessingDiagnosticSeverity;
  code: ProcessingDiagnosticCode;
  message: string;
  sourceKind: AssetSourceKind;
  sourceLabel?: string;
  parserPolicy: AssetParserPolicy["id"];
  cell?: Readonly<{ x: number; y: number }>;
  expected?: string;
  actual?: string;
  repairOwner: "sourceSelection" | "presetChoice" | "assetProcessingPolicy" | "editorRepair";
}>;

export type ProcessedCellEvidence = Readonly<{
  x: number;
  y: number;
  classification: CellClassification;
  occupied: boolean;
  color: string | null;
}>;

export type PanelAssetCandidate = Readonly<{
  preset: SixSurfaceTemplatePresetSize;
  sourceDimensions: Readonly<{ width: number; height: number }>;
  cellSize: Readonly<{ width: number; height: number }>;
  parserPolicy: AssetParserPolicy["id"];
  sourceKind: AssetSourceKind;
  sourceLabel?: string;
  origin?: AssetProcessingOrigin;
  cells: readonly ProcessedCellEvidence[];
  occupiedCellCount: number;
}>;

export type AcceptedAssetProcessingResult = Readonly<{
  status: "accepted" | "acceptedWithWarnings";
  candidate: PanelAssetCandidate;
  diagnostics: readonly ProcessingDiagnostic[];
}>;

export type RejectedAssetProcessingResult = Readonly<{
  status: "rejected";
  diagnostics: readonly ProcessingDiagnostic[];
}>;

export type AssetProcessingResult = AcceptedAssetProcessingResult | RejectedAssetProcessingResult;

export type BrowserPanelAssetSource = Blob & Readonly<{
  name?: string;
  type?: string;
}>;

export type BrowserPanelProcessingRequest = Readonly<{
  preset: SixSurfaceTemplatePresetSize;
  source: BrowserPanelAssetSource;
  sourceKind?: AssetSourceKind;
  sourceLabel?: string;
  origin?: AssetProcessingOrigin;
  retryIntent?: AssetProcessingRequest["retryIntent"];
  parserPolicy?: AssetParserPolicy;
  decodeImageData?: (source: BrowserPanelAssetSource) => Promise<DecodedImageData>;
}>;

const EXPECTED_SOURCE_SIZE = 1024;
const SUPPORTED_BROWSER_IMAGE_TYPES = new Set(["image/png", "image/webp", "image/jpeg"]);

export async function processBrowserPanelAssetSource(
  request: BrowserPanelProcessingRequest,
): Promise<AssetProcessingResult> {
  const parserPolicy = request.parserPolicy ?? strictParserPolicy;
  const sourceKind = request.sourceKind ?? "upload";
  const sourceLabel = request.sourceLabel ?? request.source.name;
  const diagnosticBase = {
    sourceKind,
    sourceLabel,
    parserPolicy: parserPolicy.id,
  };

  if (request.source.type && !SUPPORTED_BROWSER_IMAGE_TYPES.has(request.source.type)) {
    return {
      status: "rejected",
      diagnostics: [
        {
          ...diagnosticBase,
          severity: "error",
          code: "unsupportedSourceType",
          message: `Unsupported image type "${request.source.type}". Use PNG, WebP, or JPEG.`,
          actual: request.source.type,
          expected: "image/png, image/webp, or image/jpeg",
          repairOwner: "sourceSelection",
        },
      ],
    };
  }

  try {
    const image = await (request.decodeImageData ?? decodeBrowserImageData)(request.source);

    return processDecodedPanelAsset({
      preset: request.preset,
      sourceKind,
      sourceLabel,
      origin: request.origin,
      retryIntent: request.retryIntent,
      parserPolicy,
      image,
    });
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [
        {
          ...diagnosticBase,
          severity: "error",
          code: "decodeFailure",
          message: error instanceof Error ? error.message : "The selected source could not be decoded.",
          repairOwner: "sourceSelection",
        },
      ],
    };
  }
}

export async function decodeBrowserImageData(source: Blob): Promise<DecodedImageData> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    throw new Error("Browser image decoding requires createImageBitmap and document canvas APIs.");
  }

  const bitmap = await createImageBitmap(source);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas 2D context is unavailable for image decoding.");
    }

    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);

    return {
      width: imageData.width,
      height: imageData.height,
      data: imageData.data,
    };
  } finally {
    bitmap.close();
  }
}

export function processDecodedPanelAsset(request: AssetProcessingRequest): AssetProcessingResult {
  const policy = request.parserPolicy ?? strictParserPolicy;
  const context = diagnosticContext(request, policy);
  const expectedDimensions = `${EXPECTED_SOURCE_SIZE} x ${EXPECTED_SOURCE_SIZE}`;
  const actualDimensions = `${request.image.width} x ${request.image.height}`;

  if (request.image.width !== EXPECTED_SOURCE_SIZE || request.image.height !== EXPECTED_SOURCE_SIZE) {
    return {
      status: "rejected",
      diagnostics: [
        {
          ...context,
          severity: "error",
          code: "wrongDimensions",
          message: `Expected a ${expectedDimensions} source for preset ${request.preset}, received ${actualDimensions}.`,
          expected: expectedDimensions,
          actual: actualDimensions,
          repairOwner: "presetChoice",
        },
      ],
    };
  }

  const expectedBufferLength = request.image.width * request.image.height * 4;

  if (request.image.data.length !== expectedBufferLength) {
    return {
      status: "rejected",
      diagnostics: [
        {
          ...context,
          severity: "error",
          code: "invalidPixelBuffer",
          message: `Expected ${expectedBufferLength} RGBA values, received ${request.image.data.length}.`,
          expected: `${expectedBufferLength}`,
          actual: `${request.image.data.length}`,
          repairOwner: "assetProcessingPolicy",
        },
      ],
    };
  }

  const cellSize = EXPECTED_SOURCE_SIZE / request.preset;
  const cells: ProcessedCellEvidence[] = [];
  const diagnostics: ProcessingDiagnostic[] = [];
  let occupiedCellCount = 0;

  for (let y = 0; y < request.preset; y += 1) {
    for (let x = 0; x < request.preset; x += 1) {
      const cell = classifyStrictCell(request.image, x, y, cellSize);
      cells.push(cell);

      if (cell.occupied) {
        occupiedCellCount += 1;
      }

      if (cell.classification === "malformed") {
        diagnostics.push({
          ...context,
          severity: "error",
          code: "malformedCell",
          message: `Cell ${x},${y} mixes occupied and background pixels under strict-v1.`,
          cell: { x, y },
          repairOwner: "editorRepair",
        });
      }
    }
  }

  if (occupiedCellCount === 0) {
    diagnostics.push({
      ...context,
      severity: "error",
      code: "emptyPanel",
      message: "The source contains no occupied cells under strict-v1.",
      repairOwner: "sourceSelection",
    });
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return {
      status: "rejected",
      diagnostics,
    };
  }

  return {
    status: diagnostics.length > 0 ? "acceptedWithWarnings" : "accepted",
    candidate: {
      preset: request.preset,
      sourceDimensions: { width: request.image.width, height: request.image.height },
      cellSize: { width: cellSize, height: cellSize },
      parserPolicy: policy.id,
      sourceKind: request.sourceKind,
      sourceLabel: request.sourceLabel,
      origin: request.origin,
      cells,
      occupiedCellCount,
    },
    diagnostics,
  };
}

function diagnosticContext(request: AssetProcessingRequest, policy: AssetParserPolicy) {
  return {
    sourceKind: request.sourceKind,
    sourceLabel: request.sourceLabel,
    parserPolicy: policy.id,
  };
}

function classifyStrictCell(
  image: DecodedImageData,
  cellX: number,
  cellY: number,
  cellSize: number,
): ProcessedCellEvidence {
  let backgroundCount = 0;
  let occupiedCount = 0;
  let redTotal = 0;
  let greenTotal = 0;
  let blueTotal = 0;

  const startX = cellX * cellSize;
  const startY = cellY * cellSize;

  for (let y = startY; y < startY + cellSize; y += 1) {
    for (let x = startX; x < startX + cellSize; x += 1) {
      const index = (y * image.width + x) * 4;
      const red = image.data[index] ?? 0;
      const green = image.data[index + 1] ?? 0;
      const blue = image.data[index + 2] ?? 0;
      const alpha = image.data[index + 3] ?? 0;

      if (isStrictBackground(red, green, blue, alpha)) {
        backgroundCount += 1;
      } else {
        occupiedCount += 1;
        redTotal += red;
        greenTotal += green;
        blueTotal += blue;
      }
    }
  }

  if (occupiedCount === 0) {
    return {
      x: cellX,
      y: cellY,
      classification: "empty",
      occupied: false,
      color: null,
    };
  }

  if (backgroundCount > 0) {
    return {
      x: cellX,
      y: cellY,
      classification: "malformed",
      occupied: false,
      color: null,
    };
  }

  return {
    x: cellX,
    y: cellY,
    classification: "occupied",
    occupied: true,
    color: toHexColor(
      Math.round(redTotal / occupiedCount),
      Math.round(greenTotal / occupiedCount),
      Math.round(blueTotal / occupiedCount),
    ),
  };
}

function isStrictBackground(red: number, green: number, blue: number, alpha: number): boolean {
  return alpha === 0 || (alpha === 255 && red === 255 && green === 255 && blue === 255);
}

function toHexColor(red: number, green: number, blue: number): string {
  return `#${toHexPair(red)}${toHexPair(green)}${toHexPair(blue)}`;
}

function toHexPair(value: number): string {
  return value.toString(16).padStart(2, "0");
}
