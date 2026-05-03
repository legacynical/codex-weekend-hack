import { useEffect, useMemo, useRef, useState } from "react";

import { createSwirlSphere } from "@/benchmarks/swirlSphere";
import { Button } from "@/components/ui/button";
import type { ViewPanel } from "@/core/panels";
import { projectVolumeToAxisPanels } from "@/core/projection";
import type { VoxelVolume } from "@/core/voxel";
import { VoxelScene } from "@/rendering/voxelScene";

const snapViews = [
  { label: "Front", value: "front", axis: "y" },
  { label: "Side", value: "side", axis: "x" },
  { label: "Top", value: "top", axis: "z" },
] as const;

type SnapView = (typeof snapViews)[number]["value"];

export function VoxelViewer() {
  const [activeView, setActiveView] = useState<SnapView>("top");
  const [showVoxels, setShowVoxels] = useState(true);
  const [showPanels, setShowPanels] = useState(true);
  const [showOutlines, setShowOutlines] = useState(false);
  const benchmark = useMemo(() => {
    const volume = createSwirlSphere({ x: 16, y: 16, z: 16 });

    return {
      volume,
      panels: projectVolumeToAxisPanels(volume),
    };
  }, []);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
      <VoxelCanvas
        volume={benchmark.volume}
        panels={benchmark.panels}
        activeView={activeView}
        showVoxels={showVoxels}
        showPanels={showPanels}
        showOutlines={showOutlines}
        onActiveViewChange={setActiveView}
        onShowVoxelsChange={setShowVoxels}
        onShowPanelsChange={setShowPanels}
        onShowOutlinesChange={setShowOutlines}
      />
      <div className="border-t bg-muted" data-testid="voxel-viewer">
        <SliceWorkspacePreview panels={benchmark.panels} activeView={activeView} />
      </div>
      <div className="grid gap-3 border-t bg-card px-4 py-3 sm:grid-cols-3">
        {benchmark.panels.map((panel) => (
          <PanelPreview key={panel.id} panel={panel} />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-background/90 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Swirl sphere inspection</p>
          <p className="text-xs text-muted-foreground">16 voxel preset with x/y/z projected slice planes</p>
        </div>
      </div>
    </div>
  );
}

function VoxelCanvas({
  volume,
  panels,
  activeView,
  showVoxels,
  showPanels,
  showOutlines,
  onActiveViewChange,
  onShowVoxelsChange,
  onShowPanelsChange,
  onShowOutlinesChange,
}: {
  volume: VoxelVolume;
  panels: readonly ViewPanel[];
  activeView: SnapView;
  showVoxels: boolean;
  showPanels: boolean;
  showOutlines: boolean;
  onActiveViewChange: (view: SnapView) => void;
  onShowVoxelsChange: (updater: (current: boolean) => boolean) => void;
  onShowPanelsChange: (updater: (current: boolean) => boolean) => void;
  onShowOutlinesChange: (updater: (current: boolean) => boolean) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<VoxelScene | null>(null);
  const initialViewRef = useRef(activeView);
  const [status, setStatus] = useState<"initializing" | "ready" | "unavailable">("initializing");

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    let scene: VoxelScene | null = null;
    let mounted = true;

    try {
      scene = new VoxelScene(host, {
        volume,
        panels,
        initialView: initialViewRef.current,
      });
      sceneRef.current = scene;
      queueMicrotask(() => {
        if (mounted) {
          setStatus("ready");
        }
      });

      return () => {
        mounted = false;
        scene?.dispose();
        sceneRef.current = null;
      };
    } catch {
      queueMicrotask(() => {
        if (mounted) {
          setStatus("unavailable");
        }
      });
      scene?.dispose();
      sceneRef.current = null;
    }
  }, [volume, panels]);

  useEffect(() => {
    sceneRef.current?.snapTo(activeView);
  }, [activeView]);

  useEffect(() => {
    const scene = sceneRef.current;

    if (!scene) {
      return;
    }

    if (typeof scene.setDisplayOptions === "function") {
      scene.setDisplayOptions({ showOutlines, showPanels, showVoxels });
    } else {
      scene.setVisibility({ showPanels, showVoxels });
    }
  }, [showOutlines, showPanels, showVoxels]);

  return (
    <section className="grid gap-0 bg-card" aria-label="3D voxel view">
      <div
        ref={hostRef}
        className="relative h-[340px] overflow-hidden bg-[#172022] sm:h-[420px]"
        data-testid="voxel-canvas-host"
      >
        <div
          className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-md border border-white/15 bg-background/90 p-2 shadow-sm backdrop-blur"
          data-testid="voxel-scene-controls"
          aria-label="Scene inspection controls"
        >
          <Button
            type="button"
            variant={showVoxels ? "default" : "outline"}
            size="sm"
            aria-pressed={showVoxels}
            onClick={() => onShowVoxelsChange((current) => !current)}
          >
            Voxels
          </Button>
          <Button
            type="button"
            variant={showPanels ? "default" : "outline"}
            size="sm"
            aria-pressed={showPanels}
            onClick={() => onShowPanelsChange((current) => !current)}
          >
            Panels
          </Button>
          <Button
            type="button"
            variant={showOutlines ? "default" : "outline"}
            size="sm"
            aria-pressed={showOutlines}
            data-testid="voxel-outline-toggle"
            onClick={() => onShowOutlinesChange((current) => !current)}
          >
            Cube outlines
          </Button>
          {snapViews.map(({ label, value }) => (
            <Button
              key={value}
              type="button"
              variant={activeView === value ? "default" : "outline"}
              size="sm"
              onClick={() => onActiveViewChange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div
          className="pointer-events-none absolute bottom-3 left-3 z-10 size-24 rounded-md border border-white/15"
          data-testid="voxel-orientation-gizmo"
          aria-label="Orientation gizmo"
        />
        {status === "unavailable" ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-primary-foreground/80">
            3D unavailable
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between border-t bg-background/90 px-4 py-2">
        <span className="text-xs font-medium">3D voxel view</span>
        <span className="text-xs text-muted-foreground">
          {status === "ready" ? "3D ready" : status === "unavailable" ? "3D unavailable" : "3D initializing"}
        </span>
      </div>
    </section>
  );
}

function SliceWorkspacePreview({
  panels,
  activeView,
}: {
  panels: readonly ViewPanel[];
  activeView: SnapView;
}) {
  const activeAxis = snapViews.find((view) => view.value === activeView)?.axis ?? "z";
  const topPanel = panels.find((panel) => panel.axis === activeAxis) ?? panels[0];
  const sidePanels = panels.filter((panel) => panel.id !== topPanel?.id);

  return (
    <div
      className="relative z-10 grid min-h-[300px] grid-cols-1 justify-center gap-4 p-5 sm:min-h-[360px] sm:grid-cols-[minmax(0,320px)_120px]"
      data-testid="voxel-html-preview"
    >
      {topPanel ? <PanelTile panel={topPanel} emphasis="large" /> : null}
      <div className="grid content-center gap-3">
        {sidePanels.map((panel) => (
          <PanelTile key={panel.id} panel={panel} emphasis="small" />
        ))}
      </div>
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

function PanelTile({ panel, emphasis }: { panel: ViewPanel; emphasis: "large" | "small" }) {
  return (
    <div className="grid rounded-md border bg-background/90 p-2 shadow-sm">
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
      className={["grid aspect-square overflow-hidden rounded-sm border bg-muted/40", className ?? ""].join(" ")}
      style={{ gridTemplateColumns: `repeat(${panel.width}, minmax(0, 1fr))` }}
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
