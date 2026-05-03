import { expect, type Locator, type Page, test } from "@playwright/test";

test("renders the workbench shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /inspect constrained voxel candidates/i })).toBeVisible();
  await expect(page.getByText("Swirl sphere inspection")).toBeVisible();
  await expect(page.getByText("Surface color agreement")).toBeVisible();
});

test("renders a nonblank voxel viewer with surface controls and gizmo navigation", async ({ page }) => {
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

  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);

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
  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);

  const beforeGizmoDrags = Number((await canvas.getAttribute("data-gizmo-drags")) ?? "0");
  await canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    const rect = canvasElement.getBoundingClientRect();
    const start = { x: rect.right - 60, y: rect.top + 60 };
    const end = { x: start.x + 28, y: start.y + 12 };

    canvasElement.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: start.x,
        clientY: start.y,
        isPrimary: true,
        pointerId: 2,
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
        pointerId: 2,
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
        pointerId: 2,
        pointerType: "mouse",
      }),
    );
  });

  await expect.poll(async () => Number((await canvas.getAttribute("data-gizmo-drags")) ?? "0")).toBeGreaterThan(beforeGizmoDrags);
  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);

  const panelsButton = page.getByRole("button", { name: "Panels" });
  const voxelsButton = page.getByRole("button", { name: "Voxels" });
  const projectedButton = page.getByTestId("voxel-projected-toggle");
  const outlineButton = page.getByTestId("voxel-outline-toggle");
  await expect(panelsButton).toHaveAttribute("aria-pressed", "true");
  await expect(voxelsButton).toHaveAttribute("aria-pressed", "true");
  await expect(projectedButton).toHaveAttribute("aria-pressed", "false");
  await expect(outlineButton).toHaveAttribute("aria-pressed", "false");

  const frontPanelButton = page.getByRole("button", { name: "Front" });
  await expect(frontPanelButton).toHaveAttribute("aria-pressed", "true");
  await frontPanelButton.click();
  await expect(frontPanelButton).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);

  await frontPanelButton.click();
  await voxelsButton.click();
  await expect(voxelsButton).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);

  await voxelsButton.click();
  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);
  await projectedButton.click();
  await expect(projectedButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("projected-conflict-status")).toHaveCount(0);
  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);
  await outlineButton.click();
  await expect(outlineButton).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);

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
  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);
  expect(consoleIssues).toEqual([]);
});

test("keeps perspective view freely rotatable across repeated drags", async ({ page }) => {
  await page.goto("/");

  const canvas = page.getByTestId("voxel-viewer-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByText("3D ready")).toBeVisible();
  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);

  const observedPositions = new Set<string>();
  let previousOrbitEvents = Number((await canvas.getAttribute("data-orbit-events")) ?? "0");
  observedPositions.add((await canvas.getAttribute("data-camera-position")) ?? "");

  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    await dragCanvasWithMouse(page, canvas, {
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

  expect(observedPositions.size).toBeGreaterThan(12);
  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);
});

async function dragCanvasWithMouse(
  page: Page,
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
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error("Expected canvas bounds for perspective drag");
  }

  const start = { x: box.x + box.width * startXRatio, y: box.y + box.height * startYRatio };
  const end = { x: box.x + box.width * endXRatio, y: box.y + box.height * endYRatio };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
}

async function canvasHasNonBackgroundPixels(canvas: Locator) {
  return canvas.evaluate(async (element) => {
    const canvasElement = element as HTMLCanvasElement;
    const image = new Image();
    image.src = canvasElement.toDataURL("image/png");
    await image.decode();

    const sample = document.createElement("canvas");
    sample.width = image.width;
    sample.height = image.height;

    const context = sample.getContext("2d");

    if (!context) {
      return false;
    }

    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;

    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 0;
      const green = pixels[index + 1] ?? 0;
      const blue = pixels[index + 2] ?? 0;

      if (Math.abs(red - 23) > 12 || Math.abs(green - 32) > 12 || Math.abs(blue - 34) > 12) {
        return true;
      }
    }

    return false;
  });
}
