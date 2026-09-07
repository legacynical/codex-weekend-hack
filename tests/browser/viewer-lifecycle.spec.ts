import { expect, test } from "@playwright/test";

import { createPanelPng } from "./panelPngFixture";

test("preserves viewer controls through project construction and rejected replacement fallback", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.goto("/");

  const canvas = page.getByTestId("voxel-viewer-canvas");
  const source = page.getByTestId("voxel-viewer-source");
  const voxels = page.getByRole("button", { name: "Voxels", exact: true });
  const panels = page.getByRole("button", { name: "Panels", exact: true });
  const projected = page.getByTestId("voxel-projected-toggle");
  const outlines = page.getByTestId("voxel-outline-toggle");
  const front = page.getByRole("button", { name: "Front", exact: true });
  const surfaceLabel = page.getByTestId("voxel-surface-label");

  await expect(page.getByText("3D ready")).toBeVisible();
  await expect(source).toHaveText("benchmark fallback");
  const originalCanvas = await canvas.elementHandle();
  const canvasBounds = await canvas.boundingBox();
  if (!canvasBounds) throw new Error("Expected canvas bounds for the right gizmo face");
  await page.mouse.click(canvasBounds.x + canvasBounds.width - 18, canvasBounds.y + 48);
  await expect(canvas).toHaveAttribute("data-active-surface", "right");
  await expect(surfaceLabel).toHaveText("right");
  expect(await originalCanvas?.evaluate((element) => element.isConnected)).toBe(true);
  await voxels.click();
  await panels.click();
  await projected.click();
  await outlines.click();
  await front.click();
  await expect(canvas).toHaveAttribute("data-voxel-mode", "hidden");
  await expect(canvas).toHaveAttribute("data-visible-voxel-count", "0");
  await testInfo.attach("benchmark-hidden-before-uploads", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  await page.getByRole("button", { name: "Upload face images" }).click();
  const panel = createPanelPng({ preset: 16, occupiedCells: [[0, 0]] });
  for (const slot of ["front", "back", "left", "right", "top", "bottom"]) {
    await page.getByLabel(`${slot} face image`).setInputFiles({
      name: `${slot}-lifecycle.png`,
      mimeType: "image/png",
      buffer: panel,
    });
    await expect(page.getByTestId(`upload-slot-status-${slot}`)).toContainText("accepted at 16 x 16");
  }

  await expect(source).toHaveText("project output");
  await expect(page.getByTestId("project-readiness")).toContainText("6 of 6 compatible panels");
  await expect(page.getByText("3D ready")).toBeVisible();
  await testInfo.attach("project-after-construction", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await expect(canvas).toHaveAttribute("data-active-surface", "right");
  await expect(surfaceLabel).toHaveText("right");
  await expect(voxels).toHaveAttribute("aria-pressed", "false");
  await expect(panels).toHaveAttribute("aria-pressed", "false");
  await expect(projected).toHaveAttribute("aria-pressed", "true");
  await expect(outlines).toHaveAttribute("aria-pressed", "true");
  await expect(front).toHaveAttribute("aria-pressed", "false");
  await expect(canvas).toHaveAttribute("data-voxel-mode", "hidden");
  await expect(canvas).toHaveAttribute("data-visible-voxel-count", "0");
  await expect(canvas).toHaveAttribute("data-outline-segment-count", "0");

  const hiddenProject = await canvas.screenshot({ animations: "disabled" });
  await voxels.click();
  await expect(voxels).toHaveAttribute("aria-pressed", "true");
  await expect(canvas).toHaveAttribute("data-voxel-mode", "projected");
  await expect(canvas).toHaveAttribute("data-visible-voxel-count", "1");
  await expect(canvas).toHaveAttribute("data-outline-segment-count", "12");
  await expect.poll(async () => Buffer.compare(hiddenProject, await canvas.screenshot({ animations: "disabled" }))).not.toBe(0);
  await testInfo.attach("project-projected-with-outlines", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  await page.getByLabel("front face image").setInputFiles({
    name: "front-rejected-lifecycle.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a PNG"),
  });
  await expect(page.getByTestId("upload-slot-status-front")).toContainText(/could not be decoded|decode/i);
  await expect(page.getByTestId("project-readiness")).toContainText("5 of 6 compatible panels");
  await expect(source).toHaveText("benchmark fallback");
  await expect(page.getByText("3D ready")).toBeVisible();
  await testInfo.attach("fallback-after-rejected-replacement", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await expect(canvas).toHaveAttribute("data-active-surface", "right");
  await expect(surfaceLabel).toHaveText("right");
  await expect(voxels).toHaveAttribute("aria-pressed", "true");
  await expect(panels).toHaveAttribute("aria-pressed", "false");
  await expect(projected).toHaveAttribute("aria-pressed", "true");
  await expect(outlines).toHaveAttribute("aria-pressed", "true");
  await expect(front).toHaveAttribute("aria-pressed", "false");
  await expect(canvas).toHaveAttribute("data-voxel-mode", "projected");
  await expect.poll(async () => Number(await canvas.getAttribute("data-visible-voxel-count"))).toBeGreaterThan(1);
  await expect.poll(async () => Number(await canvas.getAttribute("data-outline-segment-count"))).toBeGreaterThan(12);
});
