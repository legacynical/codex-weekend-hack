import { expect, test } from "@playwright/test";

test("renders the workbench shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /inspect constrained image grids/i })).toBeVisible();
  await expect(page.getByText("Swirl sphere fixture")).toBeVisible();
  await expect(page.getByText("Surface color agreement")).toBeVisible();
});
