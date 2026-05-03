import { useMemo, useState } from "react";

import { createSwirlSphere } from "@/benchmarks/swirlSphere";
import { Button } from "@/components/ui/button";
import type { ViewPanel } from "@/core/panels";
import { projectVolumeToAxisPanels } from "@/core/projection";

const snapViews = [
  { label: "Front", value: "front", axis: "y" },
  { label: "Side", value: "side", axis: "x" },
  { label: "Top", value: "top", axis: "z" },
] as const;

type SnapView = (typeof snapViews)[number]["value"];

export function VoxelViewer() {
  const [activeView, setActiveView] = useState<SnapView>("top");
  const benchmark = useMemo(() => {
    const volume = createSwirlSphere({ x: 16, y: 16, z: 16 });

    return {
      volume,
      panels: projectVolumeToAxisPanels(volume),
    };
  }, []);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="bg-muted" data-testid="voxel-viewer">
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
        <div className="flex items-center gap-2" aria-label="Camera snap controls">
          {snapViews.map(({ label, value }) => (
            <Button
              key={value}
              type="button"
              variant={activeView === value ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveView(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
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
      className="relative z-10 grid min-h-[300px] grid-cols-[minmax(0,1fr)_120px] gap-4 p-5 sm:min-h-[360px]"
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
