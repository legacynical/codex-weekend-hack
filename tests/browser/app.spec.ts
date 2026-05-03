import { expect, test } from "@playwright/test";

test("renders the workbench shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /inspect constrained voxel candidates/i })).toBeVisible();
  await expect(page.getByText("Swirl sphere inspection")).toBeVisible();
  await expect(page.getByText("Surface color agreement")).toBeVisible();
});

test("renders a nonblank voxel viewer with snap controls", async ({ page }) => {
  await page.goto("/");

  const canvas = page.getByTestId("voxel-viewer-canvas");
  await expect(page.getByTestId("voxel-canvas-host")).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(page.getByText("3D ready")).toBeVisible();
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

  await expect
    .poll(async () =>
      canvas.evaluate(async (element) => {
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
      }),
    )
    .toBe(true);
});
