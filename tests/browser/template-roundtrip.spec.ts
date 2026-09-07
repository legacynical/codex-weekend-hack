import { readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

for (const preset of [16, 32, 64] as const) {
  test(`downloaded ${preset} template accepts a painted cell and rejects partial cells`, async ({ page }, testInfo) => {
    await page.goto("/");
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId(`template-download-${preset}`).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`pixel-grid-${preset}.png`);
    const downloadedPath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(downloadedPath);
    await testInfo.attach("downloaded-template", { path: downloadedPath, contentType: "image/png" });

    const downloadedBytes = await readFile(downloadedPath);
    const fixtures = await page.evaluate(async ({ base64, preset }) => {
      const source = await fetch(`data:image/png;base64,${base64}`).then((response) => response.blob());
      const bitmap = await createImageBitmap(source);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not decode the downloaded template");
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const original = context.getImageData(0, 0, canvas.width, canvas.height);
      let nonBackgroundPixels = 0;
      for (let index = 0; index < original.data.length; index += 4) {
        const [red, green, blue, alpha] = original.data.subarray(index, index + 4);
        if (!(alpha === 0 || (red === 255 && green === 255 && blue === 255 && alpha === 255))) {
          nonBackgroundPixels += 1;
        }
      }

      const cellPixels = canvas.width / preset;
      context.fillStyle = "#336699";
      context.fillRect(0, 0, cellPixels, cellPixels);
      const completeCell = canvas.toDataURL("image/png");
      context.putImageData(original, 0, 0);
      context.fillRect(0, 0, cellPixels / 2, cellPixels);
      return {
        width: canvas.width,
        height: canvas.height,
        nonBackgroundPixels,
        completeCell,
        partialCell: canvas.toDataURL("image/png"),
      };
    }, { base64: downloadedBytes.toString("base64"), preset });

    expect(fixtures.width).toBe(1024);
    expect(fixtures.height).toBe(1024);
    expect.soft(fixtures.nonBackgroundPixels, "Template guides must classify as background").toBe(0);

    const completePath = testInfo.outputPath(`painted-cell-${preset}.png`);
    const partialPath = testInfo.outputPath(`partial-cell-${preset}.png`);
    await writeFile(completePath, Buffer.from(fixtures.completeCell.split(",")[1], "base64"));
    await writeFile(partialPath, Buffer.from(fixtures.partialCell.split(",")[1], "base64"));
    await testInfo.attach("painted-cell", { path: completePath, contentType: "image/png" });
    await testInfo.attach("partial-cell", { path: partialPath, contentType: "image/png" });

    await page.getByRole("button", { name: "Upload face images" }).click();
    await page.getByRole("button", { name: String(preset), exact: true }).click();
    const input = page.getByLabel("front face image");
    const status = page.getByTestId("upload-slot-status-front");
    const readiness = page.getByTestId("project-readiness");
    await input.setInputFiles(downloadedPath);
    await expect(status).toContainText("strict-v1");
    await testInfo.attach("blank-template-rejection", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    await expect.soft(status).toContainText("no occupied cells");
    await expect.soft(status).not.toContainText("mixes occupied and background");
    await expect(readiness).toContainText("0 of 6 compatible panels");

    await input.setInputFiles(completePath);
    await expect(status).toContainText(`accepted at ${preset} x ${preset}`);
    await expect(readiness).toContainText("1 of 6 compatible panels");
    await testInfo.attach("painted-template-accepted", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    await input.setInputFiles(partialPath);
    await expect(status).toContainText("Cell 0,0 mixes occupied and background pixels under strict-v1");
    await expect(readiness).toContainText("0 of 6 compatible panels");
    await testInfo.attach("partial-cell-rejected", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
}
