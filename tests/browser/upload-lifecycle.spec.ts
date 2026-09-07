import { expect, test } from "@playwright/test";

import { createPanelPng } from "./panelPngFixture";

test("keeps a newer accepted upload when an obsolete replacement decode rejects", async ({ page }) => {
  await page.addInitScript(() => {
    const originalCreateImageBitmap = globalThis.createImageBitmap.bind(globalThis);
    globalThis.createImageBitmap = (async (source: ImageBitmapSource) => {
      if (source instanceof File && source.name === "slow-rejected-front.png") {
        await new Promise((resolve) => setTimeout(resolve, 600));
        throw new Error("Obsolete source decode failed");
      }
      return originalCreateImageBitmap(source);
    }) as typeof createImageBitmap;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Upload face images" }).click();
  const input = page.getByLabel("front face image");
  const status = page.getByTestId("upload-slot-status-front");
  const readiness = page.getByTestId("project-readiness");
  const buffer = createPanelPng({ preset: 16, occupiedCells: [[0, 0]] });

  await input.setInputFiles({ name: "invalid-front.png", mimeType: "image/png", buffer: Buffer.from("not a PNG") });
  await expect(status).toContainText("could not be decoded");
  await expect(readiness).toContainText("0 saved assets");

  await input.setInputFiles({ name: "slow-rejected-front.png", mimeType: "image/png", buffer });
  await expect(status).toHaveText(
    "Replacing the active panel with slow-rejected-front.png. Constructor output is stale.",
  );
  await input.setInputFiles({ name: "current-front.png", mimeType: "image/png", buffer });
  await expect(status).toHaveText("current-front.png accepted at 16 x 16.");
  await page.waitForTimeout(750);
  await expect(status).toHaveText("current-front.png accepted at 16 x 16.");
  await expect(readiness).toContainText("1 of 6 compatible panels");
  await expect(readiness).toContainText("1 saved assets");
  await expect(readiness).toContainText("1 active assignments");
});

test("retains concurrent accepted panels when resolution changes cancel another upload", async ({ page }) => {
  await page.addInitScript(() => {
    const originalCreateImageBitmap = globalThis.createImageBitmap.bind(globalThis);
    globalThis.createImageBitmap = (async (source: ImageBitmapSource) => {
      if (source instanceof File) {
        const delay = source.name === "back.png" ? 200 : 600;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return originalCreateImageBitmap(source);
    }) as typeof createImageBitmap;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Upload face images" }).click();
  const buffer = createPanelPng({ preset: 16, occupiedCells: [[0, 0]] });
  const readiness = page.getByTestId("project-readiness");
  const frontStatus = page.getByTestId("upload-slot-status-front");
  const backStatus = page.getByTestId("upload-slot-status-back");
  const leftStatus = page.getByTestId("upload-slot-status-left");

  await page.getByLabel("front face image").setInputFiles({ name: "front.png", mimeType: "image/png", buffer });
  await expect(frontStatus).toHaveText("Processing front.png at 16 x 16.");
  await page.getByLabel("back face image").setInputFiles({ name: "back.png", mimeType: "image/png", buffer });
  await expect(frontStatus).toHaveText("Processing front.png at 16 x 16.");
  await expect(backStatus).toHaveText("back.png accepted at 16 x 16.");
  await expect(frontStatus).toHaveText("front.png accepted at 16 x 16.");
  await expect(readiness).toContainText("2 of 6 compatible panels");
  await expect(readiness).toContainText("2 saved assets");
  await expect(readiness).toContainText("2 active assignments");

  await page.getByLabel("left face image").setInputFiles({ name: "left.png", mimeType: "image/png", buffer });
  await expect(leftStatus).toHaveText("Processing left.png at 16 x 16.");
  await page.getByRole("button", { name: "32", exact: true }).click();
  await expect(leftStatus).toHaveText(
    "Panel grid size changed before left.png finished processing. Select it again for 32 x 32.",
  );
  await page.waitForTimeout(750);
  await expect(leftStatus).toHaveText(
    "Panel grid size changed before left.png finished processing. Select it again for 32 x 32.",
  );
  await expect(frontStatus).toHaveText("front.png accepted at 16 x 16.");
  await expect(backStatus).toHaveText("back.png accepted at 16 x 16.");
  await expect(readiness).toContainText("2 of 6 compatible panels");
  await expect(readiness).toContainText("2 saved assets");
  await expect(readiness).toContainText("2 active assignments");
});
