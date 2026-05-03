import { Box, CheckCircle2, Layers3, Palette, PanelTop, Upload } from "lucide-react";

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

const workflow = [
  { step: "01", label: "Parse uploaded grids", icon: PanelTop },
  { step: "02", label: "Reconstruct occupancy", icon: Box },
  { step: "03", label: "Validate material coherence", icon: Palette },
] as const;

const lanes = [
  "Silhouette consistency",
  "Connected watertight volume",
  "Surface color agreement",
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <section className="flex min-h-[520px] flex-col justify-between rounded-lg border bg-card p-5 shadow-sm sm:p-6">
            <div className="max-w-3xl space-y-4">
              <Badge variant="secondary" className="w-fit">
                Multi-view voxel reconstruction
              </Badge>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-balance md:text-6xl">
                Inspect constrained image grids before they become voxel assets.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                A browser-first workbench for parsing orthographic, diagonal, and
                cross-section panels into deterministic voxel candidates with
                visible validation results.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
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
          </section>

          <aside className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Swirl sphere fixture</CardTitle>
                <CardDescription>First analytic benchmark target</CardDescription>
                <CardAction>
                  <Badge variant="outline" className="font-normal">
                  benchmark
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="grid aspect-square grid-cols-8 gap-1 rounded-md border bg-muted p-3">
                  {Array.from({ length: 64 }, (_, index) => {
                    const row = Math.floor(index / 8);
                    const col = index % 8;
                    const distance = Math.hypot(row - 3.5, col - 3.5);
                    const filled = distance < 3.7;
                    const tone = (row + col) % 5;

                    return (
                      <div
                        key={index}
                        className={[
                          "aspect-square rounded-[2px]",
                          filled ? "shadow-sm" : "opacity-20",
                          tone === 0 && filled ? "bg-[var(--chart-1)]" : "",
                          tone === 1 && filled ? "bg-[var(--chart-2)]" : "",
                          tone === 2 && filled ? "bg-[var(--chart-3)]" : "",
                          tone === 3 && filled ? "bg-[var(--chart-4)]" : "",
                          tone === 4 && filled ? "bg-[var(--chart-5)]" : "",
                          !filled ? "bg-background" : "",
                        ].join(" ")}
                      />
                    );
                  })}
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
                  <div key={item}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm">{item}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        pending
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
