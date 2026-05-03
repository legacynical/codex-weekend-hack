import { Box, CheckCircle2, Layers3, Palette, PanelTop, Upload } from "lucide-react";

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
  },
  {
    label: "Connected watertight volume",
    passed: benchmarkReport.geometry.connected && benchmarkReport.geometry.watertight,
  },
  {
    label: "Surface color agreement",
    passed: benchmarkReport.color.coherent,
  },
] as const;

function App() {
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
          <Button variant="outline" size="sm">
            <Upload className="size-4" aria-hidden="true" />
            Upload grid
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
                  projected slice planes, orbit rotation, and front, side, and top snaps.
                </p>
              </div>
              <Badge variant="outline" className="font-normal">
                preset 16
              </Badge>
            </div>

            <VoxelViewer />
          </section>

          <aside className="grid gap-4">
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
                      <span className="text-sm">{item.label}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
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
