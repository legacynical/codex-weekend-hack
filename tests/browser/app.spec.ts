import { expect, type Locator, test } from "@playwright/test";

test("renders the workbench shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /inspect constrained voxel candidates/i })).toBeVisible();
  await expect(page.getByText("Swirl sphere inspection")).toBeVisible();
  await expect(page.getByText("Surface color agreement")).toBeVisible();
});

test("renders a nonblank voxel viewer with snap controls", async ({ page }) => {
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

  await expect(page.getByRole("button", { name: "Front" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Side" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Top" })).toBeVisible();

  const workspace = page.getByTestId("voxel-html-preview");
  await page.getByRole("button", { name: "Side" }).click();
  await expect(workspace.getByText("side-x")).toBeVisible();
  await page.getByRole("button", { name: "Top" }).click();
  await expect(workspace.getByText("top-z")).toBeVisible();
  await page.getByRole("button", { name: "Front" }).click();
  await expect(workspace.getByText("front-y")).toBeVisible();

  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);

  const beforeDragEvents = Number((await canvas.getAttribute("data-orbit-events")) ?? "0");
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
  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);

  const panelsButton = page.getByRole("button", { name: "Panels" });
  const voxelsButton = page.getByRole("button", { name: "Voxels" });
  const outlineButton = page.getByTestId("voxel-outline-toggle");
  await expect(panelsButton).toHaveAttribute("aria-pressed", "true");
  await expect(voxelsButton).toHaveAttribute("aria-pressed", "true");
  await expect(outlineButton).toHaveAttribute("aria-pressed", "false");

  await panelsButton.click();
  await expect(panelsButton).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);

  await panelsButton.click();
  await voxelsButton.click();
  await expect(voxelsButton).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);

  await voxelsButton.click();
  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);
  await outlineButton.click();
  await expect(outlineButton).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => canvasHasNonBackgroundPixels(canvas)).toBe(true);
  expect(consoleIssues).toEqual([]);
});

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
