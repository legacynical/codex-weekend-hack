import { expect, type Locator, test } from "@playwright/test";

import { createPanelPng } from "./panelPngFixture";

test.setTimeout(60_000);

test("renders the workbench shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /inspect constrained voxel candidates/i })).toBeVisible();
  await expect(page.getByText("Swirl sphere inspection")).toBeVisible();
  await expect(page.getByText("Surface color agreement")).toBeVisible();

  await page.getByRole("button", { name: "Upload face images" }).click();
  await expect(page.getByTestId("upload-slots-tab")).toBeVisible();
  await expect(page.getByLabel("front face image")).toBeAttached();
  await expect(page.getByTestId("project-readiness")).toContainText("0 of 6 compatible panels");
  await expect(page.getByTestId("project-diagnostics")).toContainText("Repair in: active project");
  await expect(page.getByTestId("voxel-viewer-source")).toHaveText("benchmark fallback");
});

test("constructs project-owned viewer output from six real PNG uploads and blocks rejected replacements", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload face images" }).click();

  const frontInput = page.getByLabel("front face image");
  await frontInput.setInputFiles({
    name: "invalid-front.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a PNG"),
  });
  await expect(frontInput).toHaveValue("");
  await expect(page.getByTestId("upload-slot-status-front")).toContainText(/could not be decoded|decode/i);
  await expect(page.getByTestId("project-readiness")).toContainText("0 of 6 compatible panels");

  const validPanel = createPanelPng({ preset: 16, occupiedCells: [[0, 0]] });
  for (const [index, slot] of ["front", "back", "left", "right", "top", "bottom"].entries()) {
    await page.getByLabel(`${slot} face image`).setInputFiles({
      name: `${slot}-valid.png`,
      mimeType: "image/png",
      buffer: validPanel,
    });
    await expect(page.getByTestId(`upload-slot-status-${slot}`)).toContainText("accepted at 16 x 16");
    await expect(page.getByTestId("project-readiness")).toContainText(`${index + 1} of 6 compatible panels`);
  }

  await expect(page.getByTestId("voxel-viewer-source")).toHaveText("project output");
  await expect(page.getByText("Upload project candidate")).toBeVisible();
  await expect(page.getByTestId("voxel-viewer-canvas")).toHaveAttribute("data-visible-voxel-count", "1");
  await expect(page.getByTestId("project-readiness")).toContainText("6 saved assets");
  await expect(page.getByTestId("project-readiness")).toContainText("6 active assignments");
  await expect(page.getByTestId("project-diagnostics")).toContainText("Constructor diagnostics report no findings");

  const canvas = page.getByTestId("voxel-viewer-canvas");
  const beforeReplacement = await canvas.screenshot({ animations: "disabled" });
  await frontInput.setInputFiles({
    name: "front-red-replacement.png",
    mimeType: "image/png",
    buffer: createPanelPng({ preset: 16, occupiedCells: [[0, 0]], color: "#ff0000" }),
  });
  await expect(page.getByTestId("upload-slot-status-front")).toContainText("front-red-replacement.png accepted");
  await expect(page.getByTestId("project-diagnostics")).toContainText("source-panel color mismatches");
  await expect(page.getByTestId("project-readiness")).toContainText("invalid");
  await expect
    .poll(async () => Buffer.compare(beforeReplacement, await canvas.screenshot({ animations: "disabled" })))
    .not.toBe(0);

  await frontInput.setInputFiles({
    name: "front-rejected-replacement.png",
    mimeType: "image/png",
    buffer: Buffer.from("still not a PNG"),
  });
  await expect(page.getByTestId("upload-slot-status-front")).toContainText(/could not be decoded|decode/i);
  await expect(page.getByTestId("project-readiness")).toContainText("5 of 6 compatible panels");
  await expect(page.getByTestId("project-readiness")).toContainText("6 saved assets");
  await expect(page.getByTestId("project-readiness")).toContainText("5 active assignments");
  await expect(page.getByTestId("voxel-viewer-source")).toHaveText("benchmark fallback");
  await expect(page.getByText("Swirl sphere inspection")).toBeVisible();
});

test("ignores stale decodes after resolution changes and rapid same-slot replacements", async ({ page }) => {
  await page.addInitScript(() => {
    const originalCreateImageBitmap = globalThis.createImageBitmap.bind(globalThis);
    globalThis.createImageBitmap = (async (source: ImageBitmapSource) => {
      if (source instanceof File && source.name.startsWith("slow-")) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      return originalCreateImageBitmap(source);
    }) as typeof createImageBitmap;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Upload face images" }).click();

  const frontInput = page.getByLabel("front face image");
  await frontInput.setInputFiles({
    name: "slow-16.png",
    mimeType: "image/png",
    buffer: createPanelPng({ preset: 16, occupiedCells: [[0, 0]] }),
  });
  await expect(page.getByTestId("upload-slot-status-front")).toContainText("Processing slow-16.png");
  await page.getByRole("button", { name: "32", exact: true }).click();
  await expect(frontInput).toHaveValue("");
  await expect(page.getByTestId("upload-slot-status-front")).toContainText("Panel grid size changed");
  await page.waitForTimeout(750);
  await expect(page.getByTestId("upload-slot-status-front")).toContainText("Panel grid size changed");
  await expect(page.getByTestId("project-readiness")).toContainText("0 of 6 compatible panels");

  await frontInput.setInputFiles({
    name: "fast-32.png",
    mimeType: "image/png",
    buffer: createPanelPng({ preset: 32, occupiedCells: [[0, 0]], color: "#336699" }),
  });
  await expect(page.getByTestId("upload-slot-status-front")).toContainText("fast-32.png accepted at 32 x 32");

  await frontInput.setInputFiles({
    name: "slow-red-32.png",
    mimeType: "image/png",
    buffer: createPanelPng({ preset: 32, occupiedCells: [[0, 0]], color: "#ff0000" }),
  });
  await expect(page.getByTestId("upload-slot-status-front")).toContainText("Replacing the active panel");
  await frontInput.setInputFiles({
    name: "fast-blue-32.png",
    mimeType: "image/png",
    buffer: createPanelPng({ preset: 32, occupiedCells: [[0, 0]], color: "#0000ff" }),
  });
  await expect(page.getByTestId("upload-slot-status-front")).toContainText("fast-blue-32.png accepted at 32 x 32");
  await page.waitForTimeout(750);
  await expect(page.getByTestId("upload-slot-status-front")).toContainText("fast-blue-32.png accepted at 32 x 32");
  await expect(page.getByTestId("project-readiness")).toContainText("1 of 6 compatible panels");
  await expect(page.getByTestId("project-readiness")).toContainText("1 saved assets");
});

test("downloads the selected template PNG", async ({ page }) => {
  await page.goto("/");
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("template-download-16").click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("pixel-grid-16.png");
});

test("renders voxel content on demand with surface controls and gizmo navigation", async ({ page }) => {
  const consoleIssues: string[] = [];
  page.on("console", (message) => {
    const text = message.text();

    if (text.includes("GPU stall due to ReadPixels")) {
      return;
    }

    if (["error", "warning"].includes(message.type())) {
      consoleIssues.push(text);
    }
  });

  await page.goto("/");

  const canvas = page.getByTestId("voxel-viewer-canvas");
  const canvasHost = page.getByTestId("voxel-canvas-host");
  await expect(canvasHost).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(page.getByText("3D ready")).toBeVisible();
  await expect(canvasHost.getByTestId("voxel-scene-controls")).toBeVisible();
  await expect(canvasHost.getByTestId("voxel-orientation-gizmo")).toBeVisible();
  await expect(page.getByTestId("voxel-viewer")).toBeVisible();
  await expect(page.getByTestId("voxel-html-preview")).toBeVisible();

  const gizmoBox = await canvasHost.getByTestId("voxel-orientation-gizmo").boundingBox();
  const hostBox = await canvasHost.boundingBox();
  expect(gizmoBox).not.toBeNull();
  expect(hostBox).not.toBeNull();

  if (!gizmoBox || !hostBox) {
    throw new Error("Expected gizmo and host bounds");
  }

  expect(gizmoBox.x).toBeGreaterThan(hostBox.x + hostBox.width * 0.7);
  expect(gizmoBox.y).toBeLessThan(hostBox.y + hostBox.height * 0.3);

  const controlsBox = await canvasHost.getByTestId("voxel-scene-controls").boundingBox();
  expect(controlsBox).not.toBeNull();

  if (!controlsBox) {
    throw new Error("Expected scene control bounds");
  }

  expect(controlsBox.height).toBeLessThan(90);
  expect(controlsBox.width).toBeLessThan(hostBox.width * 0.66);

  for (const label of ["Front", "Back", "Left", "Right", "Top", "Bottom"]) {
    await expect(page.getByRole("button", { name: label })).toBeVisible();
  }

  const workspace = page.getByTestId("voxel-html-preview");
  for (const label of ["front", "back", "left", "right", "top", "bottom"]) {
    await expect(workspace.getByText(label, { exact: true })).toBeVisible();
  }

  await expectVoxelRender(canvas, "base");
  await expectRendererIdle(canvas);

  const beforeResizeRenderCount = await rendererRenderCount(canvas);
  await page.setViewportSize({ height: 800, width: 1100 });
  await expect.poll(async () => rendererRenderCount(canvas)).toBeGreaterThan(beforeResizeRenderCount);
  await expectRendererIdle(canvas);

  const beforeDragEvents = Number((await canvas.getAttribute("data-orbit-events")) ?? "0");
  const beforeDragPosition = await canvas.getAttribute("data-camera-position");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  if (!box) {
    throw new Error("Expected canvas bounds for orbit drag");
  }

  await canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    const rect = canvasElement.getBoundingClientRect();
    const start = { x: rect.left + rect.width * 0.55, y: rect.top + rect.height * 0.45 };
    const end = { x: rect.left + rect.width * 0.72, y: rect.top + rect.height * 0.56 };

    canvasElement.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: start.x,
        clientY: start.y,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
    canvasElement.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: end.x,
        clientY: end.y,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
    canvasElement.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: end.x,
        clientY: end.y,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });

  await expect.poll(async () => Number((await canvas.getAttribute("data-orbit-events")) ?? "0")).toBeGreaterThan(beforeDragEvents);
  await expect.poll(async () => canvas.getAttribute("data-camera-position")).not.toBe(beforeDragPosition);
  await expectRendererIdle(canvas);

  const beforeGizmoDrags = Number((await canvas.getAttribute("data-gizmo-drags")) ?? "0");
  const beforeCenterGizmoDrags = Number((await canvas.getAttribute("data-gizmo-center-drags")) ?? "0");
  const beforeCenterGizmoPosition = await canvas.getAttribute("data-camera-position");
  await dragGizmoCenterWithMouse(canvas);
  await expect.poll(async () => Number((await canvas.getAttribute("data-gizmo-drags")) ?? "0")).toBeGreaterThan(beforeGizmoDrags);
  await expect
    .poll(async () => Number((await canvas.getAttribute("data-gizmo-center-drags")) ?? "0"))
    .toBeGreaterThan(beforeCenterGizmoDrags);
  await expect.poll(async () => canvas.getAttribute("data-controls-enabled")).toBe("true");
  await expect.poll(async () => canvas.getAttribute("data-camera-position")).not.toBe(beforeCenterGizmoPosition);
  await expectRendererIdle(canvas);

  const beforeCenterClickPosition = await canvas.getAttribute("data-camera-position");
  await clickGizmoCenterWithMouse(canvas);
  await expect(page.getByTestId("voxel-surface-label")).toContainText(/front|back|left|right|top|bottom/);
  await expect.poll(async () => canvas.getAttribute("data-controls-enabled")).toBe("true");
  await expect.poll(async () => canvas.getAttribute("data-camera-position")).not.toBe(beforeCenterClickPosition);
  await expectRendererIdle(canvas);

  const panelsButton = page.getByRole("button", { name: "Panels" });
  const voxelsButton = page.getByRole("button", { name: "Voxels" });
  const projectedButton = page.getByTestId("voxel-projected-toggle");
  const hollowButton = page.getByTestId("voxel-hollow-toggle");
  const outlineButton = page.getByTestId("voxel-outline-toggle");
  const visibleHollowSourceButton = page.getByTestId("voxel-hollow-visible-source");
  const fullHullSourceButton = page.getByTestId("voxel-hollow-full-source");
  const conflictMarkerButton = page.getByTestId("voxel-conflict-marker-toggle");
  const ambiguityMarkerButton = page.getByTestId("voxel-ambiguity-marker-toggle");
  await expect(panelsButton).toHaveAttribute("aria-pressed", "true");
  await expect(voxelsButton).toHaveAttribute("aria-pressed", "true");
  await expect(projectedButton).toHaveAttribute("aria-pressed", "false");
  await expect(hollowButton).toHaveAttribute("aria-pressed", "false");
  await expect(outlineButton).toHaveAttribute("aria-pressed", "false");
  await expect(visibleHollowSourceButton).toHaveAttribute("aria-pressed", "true");
  await expect(fullHullSourceButton).toHaveAttribute("aria-pressed", "false");
  await expect(conflictMarkerButton).toHaveAttribute("aria-pressed", "true");
  await expect(ambiguityMarkerButton).toHaveAttribute("aria-pressed", "true");

  const frontPanelButton = page.getByRole("button", { name: "Front" });
  await expect(frontPanelButton).toHaveAttribute("aria-pressed", "true");
  await frontPanelButton.click();
  await expect(frontPanelButton).toHaveAttribute("aria-pressed", "false");

  await frontPanelButton.click();
  await panelsButton.click();
  await expect(panelsButton).toHaveAttribute("aria-pressed", "false");
  const visibleVoxelsScreenshot = await canvas.screenshot({ animations: "disabled" });
  const beforeVoxelHideRenderCount = await rendererRenderCount(canvas);
  await voxelsButton.click();
  await expect(voxelsButton).toHaveAttribute("aria-pressed", "false");
  await expect(canvas).toHaveAttribute("data-voxel-mode", "hidden");
  await expect(canvas).toHaveAttribute("data-visible-voxel-count", "0");
  await expect.poll(async () => rendererRenderCount(canvas)).toBeGreaterThan(beforeVoxelHideRenderCount);
  const hiddenVoxelsScreenshot = await canvas.screenshot({ animations: "disabled" });
  expect(Buffer.compare(visibleVoxelsScreenshot, hiddenVoxelsScreenshot)).not.toBe(0);

  await voxelsButton.click();
  await expectVoxelRender(canvas, "base");
  await panelsButton.click();
  await expect(panelsButton).toHaveAttribute("aria-pressed", "true");
  await projectedButton.click();
  await expect(projectedButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("projected-conflict-status")).toHaveCount(0);
  await expectVoxelRender(canvas, "projected");
  await hollowButton.click();
  await expect(hollowButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("projected-ambiguity-status")).toBeVisible();
  await expectVoxelRender(canvas, "projected");
  await fullHullSourceButton.click();
  await expect(fullHullSourceButton).toHaveAttribute("aria-pressed", "true");
  await expect(visibleHollowSourceButton).toHaveAttribute("aria-pressed", "false");
  await expectVoxelRender(canvas, "projected");
  await conflictMarkerButton.click();
  await ambiguityMarkerButton.click();
  await expect(conflictMarkerButton).toHaveAttribute("aria-pressed", "false");
  await expect(ambiguityMarkerButton).toHaveAttribute("aria-pressed", "false");
  await expectVoxelRender(canvas, "projected");
  await outlineButton.click();
  await expect(outlineButton).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => Number((await canvas.getAttribute("data-outline-segment-count")) ?? "0")).toBeGreaterThan(0);

  await expect(page.getByTestId("voxel-surface-label")).toContainText(/front|back|left|right|top|bottom/);
  await canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    const rect = canvasElement.getBoundingClientRect();
    const point = { x: rect.right - 18, y: rect.top + 48 };

    canvasElement.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: point.x,
        clientY: point.y,
        isPrimary: true,
        pointerId: 3,
        pointerType: "mouse",
      }),
    );
    canvasElement.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: point.x,
        clientY: point.y,
        isPrimary: true,
        pointerId: 3,
        pointerType: "mouse",
      }),
    );
  });

  await expect(page.getByTestId("voxel-surface-label")).toContainText("right");
  const beforePostGizmoOrbitEvents = Number((await canvas.getAttribute("data-orbit-events")) ?? "0");
  const beforePostGizmoPosition = await canvas.getAttribute("data-camera-position");
  await canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    const rect = canvasElement.getBoundingClientRect();
    const start = { x: rect.left + rect.width * 0.46, y: rect.top + rect.height * 0.48 };
    const end = { x: rect.left + rect.width * 0.62, y: rect.top + rect.height * 0.35 };

    canvasElement.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: start.x,
        clientY: start.y,
        isPrimary: true,
        pointerId: 4,
        pointerType: "mouse",
      }),
    );
    canvasElement.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: end.x,
        clientY: end.y,
        isPrimary: true,
        pointerId: 4,
        pointerType: "mouse",
      }),
    );
    canvasElement.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: end.x,
        clientY: end.y,
        isPrimary: true,
        pointerId: 4,
        pointerType: "mouse",
      }),
    );
  });
  await expect
    .poll(async () => Number((await canvas.getAttribute("data-orbit-events")) ?? "0"))
    .toBeGreaterThan(beforePostGizmoOrbitEvents);
  await expect.poll(async () => canvas.getAttribute("data-controls-enabled")).toBe("true");
  await expect.poll(async () => canvas.getAttribute("data-camera-position")).not.toBe(beforePostGizmoPosition);
  await expectRendererIdle(canvas);
  expect(consoleIssues).toEqual([]);
});

test("keeps perspective view freely rotatable across repeated drags", async ({ page }) => {
  await page.goto("/");

  const canvas = page.getByTestId("voxel-viewer-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByText("3D ready")).toBeVisible();
  await expectVoxelRender(canvas, "base");
  await expectRendererIdle(canvas);

  const observedPositions = new Set<string>();
  let previousOrbitEvents = Number((await canvas.getAttribute("data-orbit-events")) ?? "0");
  observedPositions.add((await canvas.getAttribute("data-camera-position")) ?? "");

  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    await dragCanvasWithMouse(canvas, {
      endXRatio: 0.52 + Math.cos(angle) * 0.2,
      endYRatio: 0.5 + Math.sin(angle) * 0.18 + 0.08,
      startXRatio: 0.46,
      startYRatio: 0.48,
    });

    await expect
      .poll(async () => Number((await canvas.getAttribute("data-orbit-events")) ?? "0"))
      .toBeGreaterThan(previousOrbitEvents);
    previousOrbitEvents = Number((await canvas.getAttribute("data-orbit-events")) ?? "0");
    observedPositions.add((await canvas.getAttribute("data-camera-position")) ?? "");
    await expect.poll(async () => canvas.getAttribute("data-controls-enabled")).toBe("true");
  }

  expect(observedPositions.size).toBeGreaterThan(8);
  await expectRendererIdle(canvas);
});

async function dragCanvasWithMouse(
  canvas: Locator,
  {
    endXRatio,
    endYRatio,
    startXRatio,
    startYRatio,
  }: {
    endXRatio: number;
    endYRatio: number;
    startXRatio: number;
    startYRatio: number;
  },
) {
  await dispatchCanvasPointerDrag(canvas, {
    endXRatio,
    endYRatio,
    pointerId: 20,
    startXRatio,
    startYRatio,
  });
}

async function dragGizmoCenterWithMouse(canvas: Locator) {
  await canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    const rect = canvasElement.getBoundingClientRect();
    const size = Math.min(96, Math.max(72, Math.floor(Math.min(rect.width, rect.height) * 0.24)));
    const centerX = rect.left + rect.width - 12 - size / 2;
    const centerY = rect.top + 12 + size / 2;

    for (const [type, clientX, clientY, buttons] of [
      ["pointerdown", centerX, centerY, 1],
      ["pointermove", centerX + 18, centerY + 10, 1],
      ["pointermove", centerX + 34, centerY + 18, 1],
      ["pointerup", centerX + 34, centerY + 18, 0],
    ] as const) {
      canvasElement.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          button: 0,
          buttons,
          clientX,
          clientY,
          isPrimary: true,
          pointerId: 21,
          pointerType: "mouse",
        }),
      );
    }
  });
}

async function clickGizmoCenterWithMouse(canvas: Locator) {
  await canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    const rect = canvasElement.getBoundingClientRect();
    const size = Math.min(96, Math.max(72, Math.floor(Math.min(rect.width, rect.height) * 0.24)));
    const centerX = rect.left + rect.width - 12 - size / 2;
    const centerY = rect.top + 12 + size / 2;

    canvasElement.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: centerX,
        clientY: centerY,
        isPrimary: true,
        pointerId: 22,
        pointerType: "mouse",
      }),
    );
    canvasElement.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: centerX,
        clientY: centerY,
        isPrimary: true,
        pointerId: 22,
        pointerType: "mouse",
      }),
    );
  });
}

async function dispatchCanvasPointerDrag(
  canvas: Locator,
  {
    endXRatio,
    endYRatio,
    pointerId,
    startXRatio,
    startYRatio,
  }: {
    endXRatio: number;
    endYRatio: number;
    pointerId: number;
    startXRatio: number;
    startYRatio: number;
  },
) {
  await canvas.evaluate(
    (element, options) => {
      const canvasElement = element as HTMLCanvasElement;
      const rect = canvasElement.getBoundingClientRect();
      const start = {
        x: rect.left + rect.width * options.startXRatio,
        y: rect.top + rect.height * options.startYRatio,
      };
      const midpoint = {
        x: rect.left + rect.width * ((options.startXRatio + options.endXRatio) / 2),
        y: rect.top + rect.height * ((options.startYRatio + options.endYRatio) / 2),
      };
      const end = {
        x: rect.left + rect.width * options.endXRatio,
        y: rect.top + rect.height * options.endYRatio,
      };

      for (const [type, point, buttons] of [
        ["pointerdown", start, 1],
        ["pointermove", midpoint, 1],
        ["pointermove", end, 1],
        ["pointerup", end, 0],
      ] as const) {
        canvasElement.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            button: 0,
            buttons,
            clientX: point.x,
            clientY: point.y,
            isPrimary: true,
            pointerId: options.pointerId,
            pointerType: "mouse",
          }),
        );
      }
    },
    { endXRatio, endYRatio, pointerId, startXRatio, startYRatio },
  );
}

async function expectVoxelRender(canvas: Locator, mode: "base" | "projected") {
  await expect(canvas).toHaveAttribute("data-voxel-mode", mode);
  await expect.poll(async () => Number((await canvas.getAttribute("data-visible-voxel-count")) ?? "0")).toBeGreaterThan(0);
  await expect.poll(async () => rendererRenderCount(canvas)).toBeGreaterThan(0);
  expect((await canvas.screenshot({ animations: "disabled" })).byteLength).toBeGreaterThan(1_000);
}

async function expectRendererIdle(canvas: Locator) {
  await expect
    .poll(
      async () => {
        const before = await rendererRenderCount(canvas);
        await new Promise((resolve) => setTimeout(resolve, 120));
        return (await rendererRenderCount(canvas)) === before;
      },
      { intervals: [100, 200], timeout: 5_000 },
    )
    .toBe(true);
}

async function rendererRenderCount(canvas: Locator): Promise<number> {
  return Number((await canvas.getAttribute("data-render-count")) ?? "0");
}
