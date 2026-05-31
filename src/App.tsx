import { useMemo, useState } from "react";
import { Box, CheckCircle2, Download, Layers3, Palette, PanelTop, Upload } from "lucide-react";

import { createSwirlSphere } from "@/benchmarks/swirlSphere";
import { VoxelViewer } from "@/components/VoxelViewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { projectVolumeToAxisPanels, reconstructVisualHull } from "@/core/projection";
import {
  downloadGridTemplatePng,
  getTemplateImageMetrics,
  gridTemplateSizes,
  type GridTemplateSize,
} from "@/templates/templateImage";
import { validateVoxelCandidate } from "@/validation/voxelValidation";

const workflow = [
  { step: "01", label: "Parse uploaded grids", icon: PanelTop },
  { step: "02", label: "Reconstruct occupancy", icon: Box },
  { step: "03", label: "Validate material coherence", icon: Palette },
] as const;

const benchmarkVolume = createSwirlSphere({ x: 16, y: 16, z: 16 });
const benchmarkPanels = projectVolumeToAxisPanels(benchmarkVolume);
const benchmarkCandidate = reconstructVisualHull(benchmarkVolume.size, benchmarkPanels);
const benchmarkReport = validateVoxelCandidate(benchmarkCandidate, benchmarkPanels);

const lanes = [
  {
    label: "Silhouette consistency",
    passed: benchmarkReport.geometry.silhouetteMismatches.length === 0,
    detail: `${benchmarkReport.geometry.silhouetteMismatches.length} silhouette mismatches`,
  },
  {
    label: "Connected watertight volume",
    passed: benchmarkReport.geometry.connected && benchmarkReport.geometry.watertight,
    detail: benchmarkReport.geometry.connected && benchmarkReport.geometry.watertight ? "connected and watertight" : "geometry needs review",
  },
  {
    label: "Surface color agreement",
    passed: benchmarkReport.color.coherent,
    detail: benchmarkReport.color.coherent
      ? "surface colors match projected panels"
      : `${benchmarkReport.color.mismatches.length} hidden-surface color conflicts from axis-only visual hull`,
  },
] as const;

const assetTabs = ["templates", "uploads"] as const;
type AssetTab = (typeof assetTabs)[number];

const faceSlots = ["front", "back", "left", "right", "top", "bottom"] as const;
type FaceSlot = (typeof faceSlots)[number];

function App() {
  const [activeAssetTab, setActiveAssetTab] = useState<AssetTab>("templates");
  const [uploadResolution, setUploadResolution] = useState<GridTemplateSize>(16);
  const [uploadedSlotNames, setUploadedSlotNames] = useState<Partial<Record<FaceSlot, string>>>({});

  return (
    <main className="min-h-svh bg-background text-foreground">
      <section className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Layers3 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold">Voxel Grid Workbench</p>
              <p className="text-xs text-muted-foreground">browser-first experiment scaffold</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-controls="assets-panel"
            onClick={() => setActiveAssetTab("uploads")}
          >
            <Upload className="size-4" aria-hidden="true" />
            Upload Grid
          </Button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <section className="grid gap-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-3xl space-y-3">
                <Badge variant="secondary" className="w-fit">
                  Multi-view voxel reconstruction
                </Badge>
                <h1 className="text-3xl font-semibold tracking-normal text-balance md:text-5xl">
                  Inspect constrained voxel candidates in 3D.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  The first benchmark viewer renders the swirl sphere candidate with
                  six projected surface panels, free orbit rotation, and gizmo-driven surface views.
                </p>
              </div>
              <Badge variant="outline" className="font-normal">
                preset 16
              </Badge>
            </div>

            <VoxelViewer />
          </section>

          <aside className="grid content-start gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Assets</CardTitle>
                <CardDescription>Grid templates and face image slots</CardDescription>
                <CardAction>
                  <Badge variant="outline" className="font-normal">
                    {activeAssetTab}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent id="assets-panel" className="grid gap-4" data-testid="assets-card">
                <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1" role="group" aria-label="Asset tabs">
                  {assetTabs.map((tab) => (
                    <Button
                      key={tab}
                      type="button"
                      variant={activeAssetTab === tab ? "default" : "ghost"}
                      size="sm"
                      aria-pressed={activeAssetTab === tab}
                      onClick={() => setActiveAssetTab(tab)}
                    >
                      {tab === "templates" ? "Templates" : "Uploads"}
                    </Button>
                  ))}
                </div>
                {activeAssetTab === "templates" ? <TemplateDownloads /> : null}
                {activeAssetTab === "uploads" ? (
                  <UploadSlots
                    resolution={uploadResolution}
                    uploadedSlotNames={uploadedSlotNames}
                    onResolutionChange={setUploadResolution}
                    onSlotFileChange={(slot, fileName) =>
                      setUploadedSlotNames((current) => ({ ...current, [slot]: fileName }))
                    }
                  />
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Benchmark pipeline</CardTitle>
                <CardDescription>Deterministic fixture through reconstruction</CardDescription>
                <CardAction>
                  <Badge variant="outline" className="font-normal">
                    benchmark
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {workflow.map(({ step, label, icon: Icon }) => (
                    <div key={step} className="rounded-md border bg-background p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-muted-foreground">{step}</div>
                        <Icon className="size-4 text-primary" aria-hidden="true" />
                      </div>
                      <div className="mt-3 text-sm font-medium">{label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Validation lanes</CardTitle>
                <CardDescription>Geometry and appearance checks stay separate.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {lanes.map((item, index) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="grid gap-1">
                        <span className="text-sm">{item.label}</span>
                        <span className="text-xs text-muted-foreground">{item.detail}</span>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        {item.passed ? "pass" : "review"}
                      </span>
                    </div>
                    {index < lanes.length - 1 ? <Separator className="mt-3" /> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default App;

function TemplateDownloads() {
  return (
    <div className="grid gap-3" data-testid="template-downloads-tab">
      {gridTemplateSizes.map((size) => (
        <TemplateDownloadItem key={size} size={size} />
      ))}
    </div>
  );
}

function TemplateDownloadItem({ size }: { size: GridTemplateSize }) {
  const metrics = useMemo(() => getTemplateImageMetrics(size), [size]);

  return (
    <div className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center">
      <SquareGridPreview size={size} />
      <div className="grid min-w-0 gap-1">
        <span className="text-sm font-medium">{size} x {size} grid</span>
        <span className="truncate text-xs text-muted-foreground">
          {metrics.width} x {metrics.height} PNG, {metrics.cellPixels}px cells
        </span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Download ${size} x ${size} PNG template`}
        data-testid={`template-download-${size}`}
        onClick={() => downloadGridTemplatePng(size)}
      >
        <Download className="size-4" aria-hidden="true" />
        PNG
      </Button>
    </div>
  );
}

function UploadSlots({
  resolution,
  uploadedSlotNames,
  onResolutionChange,
  onSlotFileChange,
}: {
  resolution: GridTemplateSize;
  uploadedSlotNames: Partial<Record<FaceSlot, string>>;
  onResolutionChange: (resolution: GridTemplateSize) => void;
  onSlotFileChange: (slot: FaceSlot, fileName: string) => void;
}) {
  return (
    <div className="grid gap-4" data-testid="upload-slots-tab">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Configured resolution</span>
        <div className="flex gap-1" role="group" aria-label="Upload slot resolution">
          {gridTemplateSizes.map((size) => (
            <Button
              key={size}
              type="button"
              variant={resolution === size ? "default" : "outline"}
              size="xs"
              aria-pressed={resolution === size}
              onClick={() => onResolutionChange(size)}
            >
              {size}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {faceSlots.map((slot) => (
          <FileSlotPicker
            key={slot}
            slot={slot}
            resolution={resolution}
            fileName={uploadedSlotNames[slot]}
            onFileNameChange={(fileName) => onSlotFileChange(slot, fileName)}
          />
        ))}
      </div>
    </div>
  );
}

function FileSlotPicker({
  slot,
  resolution,
  fileName,
  onFileNameChange,
}: {
  slot: FaceSlot;
  resolution: GridTemplateSize;
  fileName?: string;
  onFileNameChange: (fileName: string) => void;
}) {
  const displayName = fileName || "Choose Image";

  return (
    <label className="group/file-slot grid min-w-0 cursor-pointer gap-2 rounded-md border bg-background p-3 transition-colors hover:bg-muted/40 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium capitalize">{slot}</span>
        <Badge variant="outline" className="font-normal">
          {resolution} x {resolution}
        </Badge>
      </div>
      <input
        className="sr-only"
        type="file"
        name={`${slot}-face-image`}
        accept="image/png,image/webp,image/jpeg"
        aria-label={`${slot} face image`}
        onChange={(event) => onFileNameChange(event.currentTarget.files?.[0]?.name ?? "")}
      />
      <span
        className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border bg-muted px-2 text-xs font-medium"
        title={displayName}
      >
        <Upload className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">{displayName}</span>
      </span>
    </label>
  );
}

function SquareGridPreview({ size }: { size: GridTemplateSize }) {
  const gridLine = "rgba(15, 118, 110, 0.28)";

  return (
    <div
      className="aspect-square overflow-hidden rounded-sm border bg-background"
      data-testid={`template-grid-preview-${size}`}
      style={{
        backgroundImage: [
          `linear-gradient(to right, ${gridLine} 1px, transparent 1px)`,
          `linear-gradient(to bottom, ${gridLine} 1px, transparent 1px)`,
        ].join(", "),
        backgroundSize: `calc(100% / ${size}) calc(100% / ${size})`,
      }}
      role="img"
      aria-label={`${size} square grid preview`}
    />
  );
}
