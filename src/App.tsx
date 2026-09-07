import { useMemo, useReducer, useState } from "react";
import { Box, CheckCircle2, Download, Layers3, Palette, PanelTop, Upload } from "lucide-react";

import { createSwirlSphere } from "@/benchmarks/swirlSphere";
import { processBrowserPanelAssetSource } from "@/assets/assetProcessing";
import { VoxelViewer, type VoxelViewerData } from "@/components/VoxelViewer";
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
import {
  summarizeActiveProject,
  type ActiveProjectLifecycleStatus,
  type ActiveProjectState,
  type ConstructorOutputStatus,
} from "@/core/activeProjectState";
import {
  createPanelReadinessDiagnosticReport,
  type ConstructorDiagnosticSourceOwner,
  type ConstructorDiagnosticReport,
} from "@/core/constructorDiagnostics";
import { semanticPlaneSlots, type SemanticPlaneSlot } from "@/core/panelContracts";
import { projectVolumeToSurfacePanels } from "@/core/projection";
import {
  createUploadRequest,
  createUploadState,
  uploadReducer,
  type UploadSlotState,
} from "@/core/uploadState";
import {
  downloadGridTemplatePng,
  getTemplateImageMetrics,
  gridTemplateSizes,
  type GridTemplateSize,
} from "@/templates/templateImage";
import { validateVoxelCandidate, type ValidationReport } from "@/validation/voxelValidation";

const workflow = [
  { step: "01", label: "Parse uploaded grids", icon: PanelTop },
  { step: "02", label: "Reconstruct occupancy", icon: Box },
  { step: "03", label: "Validate material coherence", icon: Palette },
] as const;

const benchmarkVolume = createSwirlSphere({ x: 16, y: 16, z: 16 });
const benchmarkPanels = projectVolumeToSurfacePanels(benchmarkVolume);
const benchmarkReport = validateVoxelCandidate(benchmarkVolume, benchmarkPanels);
const benchmarkViewerData: VoxelViewerData = {
  volume: benchmarkVolume,
  panels: benchmarkPanels,
  conflictMarkers: [],
  ambiguityMarkers: [],
  title: "Swirl sphere inspection",
  detail: "Explicit benchmark fallback with six signed projected surfaces",
  source: "benchmark-fallback",
};

const assetTabs = ["templates", "uploads"] as const;
type AssetTab = (typeof assetTabs)[number];

const faceSlots = semanticPlaneSlots;
type FaceSlot = SemanticPlaneSlot;

function App() {
  const [activeAssetTab, setActiveAssetTab] = useState<AssetTab>("templates");
  const [uploads, dispatchUpload] = useReducer(uploadReducer, undefined, createUploadState);
  const { resolution: uploadResolution, slots: uploadSlots, project } = uploads;
  const activeConstructorOutput = project.constructorOutput && !project.constructorOutput.stale
    ? project.constructorOutput
    : null;
  const viewerData: VoxelViewerData = activeConstructorOutput
    ? {
        ...activeConstructorOutput.candidate,
        title: "Upload project candidate",
        detail: `${activeConstructorOutput.activatedPanelSet.preset} voxel preset constructed from six active project panels`,
        source: "project",
      }
    : benchmarkViewerData;
  const validationReport = activeConstructorOutput?.candidate.validationReport ?? benchmarkReport;
  const validationLanes = useMemo(() => createValidationLanes(validationReport), [validationReport]);
  const readinessReport = useMemo(
    () => createPanelReadinessDiagnosticReport({ readiness: project.readiness }),
    [project.readiness],
  );
  const visibleDiagnosticReport = activeConstructorOutput?.diagnosticReport ?? readinessReport;

  const handleResolutionChange = (resolution: GridTemplateSize) => {
    dispatchUpload({ type: "resolutionChanged", resolution });
  };

  const handleSlotFileChange = async (slot: FaceSlot, file: File | null) => {
    if (!file) {
      return;
    }

    const request = createUploadRequest(uploads, slot, file.name);
    dispatchUpload({ type: "uploadStarted", request });

    const result = await processBrowserPanelAssetSource({
      preset: request.preset,
      source: file,
      sourceLabel: request.fileName,
      origin: { uploadSlotHint: request.slot, sourceName: request.fileName },
      retryIntent: request.retryIntent,
    });

    dispatchUpload({ type: "uploadFinished", request, result });
  };

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
              <p className="text-xs text-muted-foreground">browser-first voxel reconstruction experiment</p>
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
            Upload face images
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
                  {activeConstructorOutput
                    ? "The viewer is rendering the candidate attached to the active upload project."
                    : "The viewer shows the swirl benchmark while the upload project waits for six compatible panels."}
                </p>
              </div>
              <Badge variant="outline" className="font-normal">
                preset {activeConstructorOutput?.activatedPanelSet.preset ?? 16}
              </Badge>
            </div>

            <VoxelViewer data={viewerData} />
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
                    slots={uploadSlots}
                    onResolutionChange={handleResolutionChange}
                    onSlotFileChange={handleSlotFileChange}
                  />
                ) : null}
              </CardContent>
            </Card>

            <ProjectStatus project={project} report={visibleDiagnosticReport} />

            <Card>
              <CardHeader>
                <CardTitle>Project pipeline</CardTitle>
                <CardDescription>One project-owned path from processed panels to viewer data</CardDescription>
                <CardAction>
                  <Badge variant="outline" className="font-normal">
                    {activeConstructorOutput ? "project output" : "waiting for panels"}
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
                <CardAction>
                  <Badge variant="outline" className="font-normal">
                    {activeConstructorOutput ? "project" : "benchmark fallback"}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-3">
                {validationLanes.map((item, index) => (
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
                    {index < validationLanes.length - 1 ? <Separator className="mt-3" /> : null}
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
      <p className="text-xs text-muted-foreground">
        PNG templates use white gridlines on a transparent background. Paint occupied cells edge to edge, including the gridlines.
      </p>
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
  slots,
  onResolutionChange,
  onSlotFileChange,
}: {
  resolution: GridTemplateSize;
  slots: Readonly<Record<FaceSlot, UploadSlotState>>;
  onResolutionChange: (resolution: GridTemplateSize) => void;
  onSlotFileChange: (slot: FaceSlot, file: File | null) => void;
}) {
  return (
    <div className="grid gap-4" data-testid="upload-slots-tab">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Panel grid size</span>
        <div className="flex gap-1" role="group" aria-label="Panel grid size">
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
            state={slots[slot]}
            onFileChange={(file) => onSlotFileChange(slot, file)}
          />
        ))}
      </div>
    </div>
  );
}

function FileSlotPicker({
  slot,
  resolution,
  state,
  onFileChange,
}: {
  slot: FaceSlot;
  resolution: GridTemplateSize;
  state: UploadSlotState;
  onFileChange: (file: File | null) => void;
}) {
  const displayName = state.fileName || "Choose Image";
  const stateLabel = uploadSlotStateLabel(state, resolution);

  return (
    <label className="group/file-slot grid min-w-0 cursor-pointer gap-2 rounded-md border bg-background p-3 transition-colors hover:bg-muted/40 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium capitalize">{slot}</span>
        <Badge variant={state.phase === "rejected" ? "destructive" : "outline"} className="font-normal">
          {state.phase === "empty" ? `${resolution} x ${resolution}` : state.phase}
        </Badge>
      </div>
      <input
        className="sr-only"
        type="file"
        name={`${slot}-face-image`}
        accept="image/png,image/webp,image/jpeg"
        aria-label={`${slot} face image`}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          event.currentTarget.value = "";
          onFileChange(file);
        }}
      />
      <span
        className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border bg-muted px-2 text-xs font-medium"
        title={displayName}
      >
        <Upload className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">{displayName}</span>
      </span>
      <span
        className="text-pretty text-xs text-muted-foreground"
        data-testid={`upload-slot-status-${slot}`}
        aria-live="polite"
      >
        {stateLabel}
      </span>
    </label>
  );
}

function ProjectStatus({
  project,
  report,
}: {
  project: ActiveProjectState;
  report: ConstructorDiagnosticReport;
}) {
  const summary = summarizeActiveProject(project);
  const acceptedPanelCount = Object.keys(project.readiness.acceptedPanels).length;

  return (
    <Card data-testid="project-readiness">
      <CardHeader>
        <CardTitle>Active project</CardTitle>
        <CardDescription>{acceptedPanelCount} of 6 compatible panels assigned</CardDescription>
        <CardAction>
          <Badge variant={project.readiness.status === "ready" ? "secondary" : "outline"} className="font-normal">
            {projectStatusLabel(summary.status)}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{project.savedPanelAssets.length} saved assets</span>
          <span>·</span>
          <span>{project.activeAssignments.length} active assignments</span>
          <span>·</span>
          <span>constructor: {constructorStatusLabel(summary.constructorStatus)}</span>
        </div>
        {report.findings.length > 0 ? (
          <ul className="grid gap-2" data-testid="project-diagnostics">
            {report.findings.map((finding) => (
              <li key={finding.id} className="rounded-md border bg-background p-2 text-xs">
                <span className="font-medium">{finding.message}</span>
                <span className="mt-1 block text-muted-foreground">
                  Repair in: {diagnosticOwnerLabel(finding.sourceOwner)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground" data-testid="project-diagnostics">
            Constructor diagnostics report no findings. Candidate status: {report.status}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function projectStatusLabel(status: ActiveProjectLifecycleStatus): string {
  switch (status) {
    case "empty":
      return "empty";
    case "assets-present":
      return "assets saved";
    case "assignments-incomplete":
      return "panels incomplete";
    case "constructor-ready":
      return "ready to construct";
    case "constructor-stale":
      return "output stale";
    case "constructor-attached":
      return "output attached";
  }
}

function constructorStatusLabel(status: ConstructorOutputStatus | "not-run"): string {
  return status === "not-run" ? "not run" : status;
}

function diagnosticOwnerLabel(owner: ConstructorDiagnosticSourceOwner): string {
  switch (owner) {
    case "activeProjectState":
      return "active project";
    case "panelContracts":
      return "panel assignments";
    case "assetProcessing":
      return "image processing";
    case "modelConstruction":
      return "voxel construction";
    case "candidateResolver":
      return "candidate resolution";
    case "voxelViewer":
      return "voxel viewer";
    case "projectSaveLoad":
      return "project save/load";
  }
}

function uploadSlotStateLabel(state: UploadSlotState, configuredPreset: GridTemplateSize): string {
  switch (state.phase) {
    case "empty":
      return "No source selected.";
    case "pending":
      return `Processing ${state.fileName} at ${configuredPreset} x ${configuredPreset}.`;
    case "replacing":
      return `Replacing the active panel with ${state.fileName}. Constructor output is stale.`;
    case "accepted":
      return `${state.fileName} accepted at ${state.processedPreset} x ${state.processedPreset}.`;
    case "rejected":
      return state.diagnostics[0]?.message ?? `${state.fileName} was rejected.`;
  }
}

function createValidationLanes(report: ValidationReport) {
  return [
    {
      label: "Silhouette consistency",
      passed: report.geometry.silhouetteMismatches.length === 0,
      detail: `${report.geometry.silhouetteMismatches.length} silhouette mismatches`,
    },
    {
      label: "Connected watertight volume",
      passed: report.geometry.connected && report.geometry.watertight,
      detail: report.geometry.connected && report.geometry.watertight
        ? "connected and watertight"
        : "geometry needs review",
    },
    {
      label: "Surface color agreement",
      passed: report.color.coherent,
      detail: report.color.coherent
        ? "surface colors match projected panels"
        : `${report.color.mismatches.length} surface color mismatches`,
    },
  ] as const;
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
