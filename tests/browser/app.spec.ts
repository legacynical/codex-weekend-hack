import { expect, test } from "@playwright/test";

test("renders the workbench shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /inspect constrained voxel candidates/i })).toBeVisible();
  await expect(page.getByText("Swirl sphere inspection")).toBeVisible();
  await expect(page.getByText("Surface color agreement")).toBeVisible();
});

test("renders a nonblank voxel viewer with snap controls", async ({ page }) => {
  await page.goto("/");

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
});
