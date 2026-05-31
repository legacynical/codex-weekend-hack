import { useEffect, useMemo, useRef, useState } from "react";
import { Box, CircleQuestionMark, Eye, Grid2X2, Layers, Shell, TriangleAlert } from "lucide-react";

import { createSwirlSphere } from "@/benchmarks/swirlSphere";
import { Button } from "@/components/ui/button";
import type { ViewPanel } from "@/core/panels";
import {
  projectVolumeToSurfacePanels,
  reconstructProjectedInspectionHull,
  type ProjectedInspectionSourceMode,
  type ProjectionMarker,
} from "@/core/projection";
import type { VoxelVolume } from "@/core/voxel";
import { cn } from "@/lib/utils";
import { VoxelScene } from "@/rendering/voxelScene";

const surfaceViews = [
  { label: "Front", value: "front" },
  { label: "Back", value: "back" },
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "Top", value: "top" },
  { label: "Bottom", value: "bottom" },
] as const;

type SurfaceView = (typeof surfaceViews)[number]["value"];
type PanelVisibility = Record<SurfaceView, boolean>;

const initialPanelVisibility: PanelVisibility = {
  back: true,
  bottom: true,
  front: true,
  left: true,
  right: true,
  top: true,
};

const surfaceShortLabels: Record<SurfaceView, string> = {
  back: "B",
  bottom: "Bt",
  front: "F",
  left: "L",
  right: "R",
  top: "T",
};

export function VoxelViewer() {
  const [activeSurface, setActiveSurface] = useState<SurfaceView>("front");
  const [showVoxels, setShowVoxels] = useState(true);
  const [showPanels, setShowPanels] = useState(true);
  const [showOutlines, setShowOutlines] = useState(false);
  const [showProjected, setShowProjected] = useState(false);
  const [showHollow, setShowHollow] = useState(false);
  const [showConflictMarkers, setShowConflictMarkers] = useState(true);
  const [showAmbiguityMarkers, setShowAmbiguityMarkers] = useState(true);
  const [hollowSource, setHollowSource] = useState<ProjectedInspectionSourceMode>("visible-panel-hollow");
  const [visiblePanels, setVisiblePanels] = useState<PanelVisibility>(initialPanelVisibility);
  const benchmark = useMemo(() => {
    const volume = createSwirlSphere({ x: 16, y: 16, z: 16 });

    return {
      volume,
      panels: projectVolumeToSurfacePanels(volume),
    };
  }, []);
  const visiblePanelList = useMemo(
    () => benchmark.panels.filter((panel) => panel.surface && visiblePanels[panel.surface]),
    [benchmark.panels, visiblePanels],
  );
  const visibleSurfaces = useMemo(
    () => new Set(visiblePanelList.map((panel) => panel.surface).filter((surface): surface is SurfaceView => Boolean(surface))),
    [visiblePanelList],
  );
  const projected = useMemo(
    () =>
      reconstructProjectedInspectionHull(benchmark.volume.size, benchmark.panels, {
        hollow: showHollow,
        hollowSource,
        visibleSurfaces,
      }),
    [benchmark.panels, benchmark.volume.size, hollowSource, showHollow, visibleSurfaces],
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-md border bg-card shadow-sm">
      <VoxelCanvas
        volume={benchmark.volume}
        panels={benchmark.panels}
        projectedVolume={projected.volume}
        conflictMarkers={projected.conflictMarkers}
        ambiguityMarkers={projected.ambiguityMarkers}
        activeSurface={activeSurface}
        showVoxels={showVoxels}
        showPanels={showPanels}
        showOutlines={showOutlines}
        showProjected={showProjected}
        showHollow={showHollow}
        showConflictMarkers={showConflictMarkers}
        showAmbiguityMarkers={showAmbiguityMarkers}
        hollowSource={hollowSource}
        visiblePanels={visiblePanels}
        projectedConflictCount={projected.colorConflicts.length}
        projectedAmbiguityCount={projected.ambiguityMarkers.length}
        onActiveSurfaceChange={setActiveSurface}
        onShowVoxelsChange={setShowVoxels}
        onShowPanelsChange={setShowPanels}
        onShowOutlinesChange={setShowOutlines}
        onShowProjectedChange={setShowProjected}
        onShowHollowChange={setShowHollow}
        onShowConflictMarkersChange={setShowConflictMarkers}
        onShowAmbiguityMarkersChange={setShowAmbiguityMarkers}
        onHollowSourceChange={setHollowSource}
        onVisiblePanelsChange={setVisiblePanels}
      />
      <div className="border-t bg-muted" data-testid="voxel-viewer">
        <SliceWorkspacePreview panels={benchmark.panels} visiblePanels={visiblePanels} />
      </div>
      <div className="grid gap-3 border-t bg-card px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
        {benchmark.panels.map((panel) => (
          <PanelPreview key={panel.id} panel={panel} />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-background/90 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Swirl sphere inspection</p>
          <p className="text-xs text-muted-foreground">16 voxel preset with six signed projected surfaces</p>
        </div>
      </div>
    </div>
  );
}

function VoxelCanvas({
  volume,
  panels,
  projectedVolume,
  conflictMarkers,
  ambiguityMarkers,
  activeSurface,
  showVoxels,
  showPanels,
  showOutlines,
  showProjected,
  showHollow,
  showConflictMarkers,
  showAmbiguityMarkers,
  hollowSource,
  visiblePanels,
  projectedConflictCount,
  projectedAmbiguityCount,
  onActiveSurfaceChange,
  onShowVoxelsChange,
  onShowPanelsChange,
  onShowOutlinesChange,
  onShowProjectedChange,
  onShowHollowChange,
  onShowConflictMarkersChange,
  onShowAmbiguityMarkersChange,
  onHollowSourceChange,
  onVisiblePanelsChange,
}: {
  volume: VoxelVolume;
  panels: readonly ViewPanel[];
  projectedVolume: VoxelVolume;
  conflictMarkers: readonly ProjectionMarker[];
  ambiguityMarkers: readonly ProjectionMarker[];
  activeSurface: SurfaceView;
  showVoxels: boolean;
  showPanels: boolean;
  showOutlines: boolean;
  showProjected: boolean;
  showHollow: boolean;
  showConflictMarkers: boolean;
  showAmbiguityMarkers: boolean;
  hollowSource: ProjectedInspectionSourceMode;
  visiblePanels: PanelVisibility;
  projectedConflictCount: number;
  projectedAmbiguityCount: number;
  onActiveSurfaceChange: (view: SurfaceView) => void;
  onShowVoxelsChange: (updater: (current: boolean) => boolean) => void;
  onShowPanelsChange: (updater: (current: boolean) => boolean) => void;
  onShowOutlinesChange: (updater: (current: boolean) => boolean) => void;
  onShowProjectedChange: (updater: (current: boolean) => boolean) => void;
  onShowHollowChange: (updater: (current: boolean) => boolean) => void;
  onShowConflictMarkersChange: (updater: (current: boolean) => boolean) => void;
  onShowAmbiguityMarkersChange: (updater: (current: boolean) => boolean) => void;
  onHollowSourceChange: (mode: ProjectedInspectionSourceMode) => void;
  onVisiblePanelsChange: (updater: (current: PanelVisibility) => PanelVisibility) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<VoxelScene | null>(null);
  const initialViewRef = useRef(activeSurface);
  const [status, setStatus] = useState<"initializing" | "ready" | "unavailable">("initializing");

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    let scene: VoxelScene | null = null;
    let mounted = true;
    let readyFrame: number | null = null;

    setStatus("initializing");

    try {
      scene = new VoxelScene(host, {
        volume,
        panels,
        initialView: initialViewRef.current,
        onSurfaceChange: onActiveSurfaceChange,
      });
      sceneRef.current = scene;
      readyFrame = window.requestAnimationFrame(() => {
        readyFrame = window.requestAnimationFrame(() => {
          if (mounted) {
            setStatus("ready");
          }
        });
      });

      return () => {
        mounted = false;
        if (readyFrame !== null) {
          window.cancelAnimationFrame(readyFrame);
        }
        scene?.dispose();
        sceneRef.current = null;
      };
    } catch {
      scene?.dispose();
      sceneRef.current = null;
      readyFrame = window.requestAnimationFrame(() => {
        if (mounted) {
          setStatus("unavailable");
        }
      });

      return () => {
        mounted = false;
        if (readyFrame !== null) {
          window.cancelAnimationFrame(readyFrame);
        }
        scene?.dispose();
      };
    }
  }, [volume, panels, onActiveSurfaceChange]);

  useEffect(() => {
    sceneRef.current?.setProjectedVolume(projectedVolume);
  }, [projectedVolume]);

  useEffect(() => {
    sceneRef.current?.setInspectionMarkers({ ambiguityMarkers, conflictMarkers });
  }, [ambiguityMarkers, conflictMarkers]);

  useEffect(() => {
    const scene = sceneRef.current;

    if (!scene) {
      return;
    }

    if (typeof scene.setDisplayOptions === "function") {
      scene.setDisplayOptions({
        showAmbiguityMarkers,
        showConflictMarkers,
        showOutlines,
        showPanels,
        showProjected,
        showVoxels,
        visiblePanels,
      });
    } else {
      scene.setVisibility({ showPanels, showVoxels });
    }
  }, [showAmbiguityMarkers, showConflictMarkers, showOutlines, showPanels, showProjected, showVoxels, visiblePanels]);

  const setPanelVisible = (surface: SurfaceView) => {
    onVisiblePanelsChange((current) => ({ ...current, [surface]: !current[surface] }));
  };

  return (
    <section className="grid gap-0 bg-card" aria-label="3D voxel view">
      <div
        ref={hostRef}
        className="relative h-[340px] overflow-hidden bg-[#172022] sm:h-[420px]"
        data-testid="voxel-canvas-host"
      >
        <div
          className="absolute left-3 top-3 z-10 grid max-w-[min(520px,calc(100%-7.5rem))] gap-1 rounded-md border border-white/15 bg-background/90 p-1.5 shadow-sm backdrop-blur"
          data-testid="voxel-scene-controls"
          aria-label="Scene inspection controls"
        >
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant={showVoxels ? "default" : "outline"}
              size="icon-xs"
              aria-pressed={showVoxels}
              aria-label="Voxels"
              title="Voxels"
              onClick={() => onShowVoxelsChange((current) => !current)}
            >
              <Box aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant={showPanels ? "default" : "outline"}
              size="icon-xs"
              aria-pressed={showPanels}
              aria-label="Panels"
              title="Panels"
              onClick={() => onShowPanelsChange((current) => !current)}
            >
              <Layers aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant={showProjected ? "default" : "outline"}
              size="icon-xs"
              aria-pressed={showProjected}
              aria-label="Projected"
              title="Projected"
              data-testid="voxel-projected-toggle"
              onClick={() => onShowProjectedChange((current) => !current)}
            >
              <Eye aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant={showHollow ? "default" : "outline"}
              size="icon-xs"
              aria-pressed={showHollow}
              aria-label="Hollow"
              title="Hollow"
              data-testid="voxel-hollow-toggle"
              onClick={() => onShowHollowChange((current) => !current)}
            >
              <Shell aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant={showOutlines ? "default" : "outline"}
              size="icon-xs"
              aria-pressed={showOutlines}
              aria-label="Cube outlines"
              title="Cube outlines"
              data-testid="voxel-outline-toggle"
              onClick={() => onShowOutlinesChange((current) => !current)}
            >
              <Grid2X2 aria-hidden="true" />
            </Button>
            {surfaceViews.map(({ label, value }) => (
              <Button
                key={value}
                type="button"
                variant={visiblePanels[value] ? "default" : "outline"}
                size="xs"
                aria-pressed={visiblePanels[value]}
                aria-label={label}
                title={label}
                onClick={() => setPanelVisible(value)}
              >
                {surfaceShortLabels[value]}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant={hollowSource === "visible-panel-hollow" ? "default" : "outline"}
              size="xs"
              aria-pressed={hollowSource === "visible-panel-hollow"}
              aria-label="Visible-panel hollow"
              title="Visible-panel hollow"
              data-testid="voxel-hollow-visible-source"
              onClick={() => onHollowSourceChange("visible-panel-hollow")}
            >
              VH
            </Button>
            <Button
              type="button"
              variant={hollowSource === "full-hull-surface-filter" ? "default" : "outline"}
              size="xs"
              aria-pressed={hollowSource === "full-hull-surface-filter"}
              aria-label="Full-hull surface filter"
              title="Full-hull surface filter"
              data-testid="voxel-hollow-full-source"
              onClick={() => onHollowSourceChange("full-hull-surface-filter")}
            >
              FH
            </Button>
            <Button
              type="button"
              variant={showConflictMarkers ? "default" : "outline"}
              size="xs"
              aria-pressed={showConflictMarkers}
              aria-label="Conflict markers"
              title="Conflict markers"
              data-testid="voxel-conflict-marker-toggle"
              onClick={() => onShowConflictMarkersChange((current) => !current)}
            >
              <TriangleAlert aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant={showAmbiguityMarkers ? "default" : "outline"}
              size="xs"
              aria-pressed={showAmbiguityMarkers}
              aria-label="Ambiguity markers"
              title="Ambiguity markers"
              data-testid="voxel-ambiguity-marker-toggle"
              onClick={() => onShowAmbiguityMarkersChange((current) => !current)}
            >
              <CircleQuestionMark aria-hidden="true" />
            </Button>
            {projectedConflictCount > 0 ? (
              <span
                className="min-w-0 max-w-full text-pretty text-xs font-medium text-destructive"
                aria-live="polite"
                data-testid="projected-conflict-status"
              >
                {projectedConflictCount} ambiguous surface color conflicts
              </span>
            ) : null}
            {showHollow && projectedAmbiguityCount > 0 ? (
              <span
                className="min-w-0 max-w-full text-pretty text-xs font-medium text-amber-500"
                aria-live="polite"
                data-testid="projected-ambiguity-status"
              >
                {projectedAmbiguityCount} shell candidates
              </span>
            ) : null}
          </div>
        </div>
        <div
          className="pointer-events-none absolute right-3 top-3 z-10 size-24 rounded-md border border-white/15"
          data-testid="voxel-orientation-gizmo"
          aria-label="Orientation gizmo"
        >
          <span
            className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded border border-white/15 bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground"
            data-testid="voxel-surface-label"
          >
            {activeSurface}
          </span>
        </div>
        {status === "unavailable" ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-primary-foreground/80">
            3D unavailable
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between border-t bg-background/90 px-4 py-2">
        <span className="text-xs font-medium">3D voxel view</span>
        <span className="text-xs text-muted-foreground" aria-live="polite" aria-label="3D view status">
          {status === "ready" ? "3D ready" : status === "unavailable" ? "3D unavailable" : "3D initializing…"}
        </span>
      </div>
    </section>
  );
}

function SliceWorkspacePreview({
  panels,
  visiblePanels,
}: {
  panels: readonly ViewPanel[];
  visiblePanels: PanelVisibility;
}) {
  return (
    <div
      className="relative z-10 grid min-h-[260px] grid-cols-2 gap-4 p-5 sm:grid-cols-3"
      data-testid="voxel-html-preview"
    >
      {panels.map((panel) => (
        <PanelTile
          key={panel.id}
          panel={panel}
          emphasis="small"
          muted={panel.surface ? !visiblePanels[panel.surface] : false}
        />
      ))}
    </div>
  );
}

function PanelPreview({ panel }: { panel: ViewPanel }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{panel.id}</span>
        <span className="text-xs text-muted-foreground">{panel.axis}</span>
      </div>
      <div
        className="grid aspect-square overflow-hidden rounded-sm border"
        style={{ gridTemplateColumns: `repeat(${panel.width}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`${panel.id} projected slice preview`}
      >
        {panel.pixels.map((pixel, index) => (
          <span
            key={index}
            className="aspect-square"
            style={{ backgroundColor: pixel.occupied ? (pixel.color ?? "#ffffff") : "transparent" }}
          />
        ))}
      </div>
    </div>
  );
}

function PanelTile({ panel, emphasis, muted = false }: { panel: ViewPanel; emphasis: "large" | "small"; muted?: boolean }) {
  return (
    <div className={cn("grid rounded-md border bg-background/90 p-2 shadow-sm", muted && "opacity-45")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{panel.id}</span>
        <span className="text-xs text-muted-foreground">{panel.axis}</span>
      </div>
      <PixelGrid panel={panel} className={emphasis === "large" ? "max-h-[250px]" : "max-h-[90px]"} />
    </div>
  );
}

function PixelGrid({ panel, className }: { panel: ViewPanel; className?: string }) {
  return (
    <div
      className={cn("grid aspect-square overflow-hidden rounded-sm border bg-muted/40", className)}
      style={{ gridTemplateColumns: `repeat(${panel.width}, minmax(0, 1fr))` }}
      role="img"
      aria-label={`${panel.id} projected slice preview`}
    >
      {panel.pixels.map((pixel, index) => (
        <span
          key={index}
          className="aspect-square"
          style={{ backgroundColor: pixel.occupied ? (pixel.color ?? "#ffffff") : "transparent" }}
        />
      ))}
    </div>
  );
}
