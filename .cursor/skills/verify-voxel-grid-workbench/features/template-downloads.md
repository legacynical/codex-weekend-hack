# Template downloads

Users download grid PNGs for preparing face images at the chosen resolution. White guides mark a transparent background. Paint each occupied cell completely, including its guide pixels.

## Sub-features

- `templates.entry` opens the Templates tab from another Assets tab.
- `templates.download` downloads the 16, 32, and 64 grid PNGs.
- `templates.roundtrip` checks the downloaded artifact against the image upload path.

## How to get to it (user POV)

Open `/` for the initial Templates tab, or click **Templates** in the Assets card. Click the PNG button beside the desired grid size.

## Driving it with Playwright

Preconditions: Launch through the skill. Record the run directory when retaining downloaded files.

- Open the tab with `page.getByRole("button", { name: "Templates", exact: true }).click()`. Expect `template-downloads-tab` and previews `template-grid-preview-16`, `template-grid-preview-32`, and `template-grid-preview-64`.
- Start `page.waitForEvent("download")` before clicking `page.getByTestId("template-download-16")`. The existing `--grep 'downloads the selected template PNG'` test expects `pixel-grid-16.png`.
- Repeat with `template-download-32` and `template-download-64` when those sizes are in scope. Their accessible names are `Download 32 x 32 PNG template` and `Download 64 x 64 PNG template`.
- Use `download.saveAs(...)` to retain each PNG in the run directory. Inspect the image bytes and dimensions when claiming usable template contents. Select the matching upload resolution before checking a saved download through a face input.
- Run `--grep 'downloaded .* template accepts'` for `tests/browser/template-roundtrip.spec.ts` at all three presets. A blank template must classify as empty background rather than an occupied guide pattern. A completely painted cell must be accepted. A partly painted cell must be rejected by the strict parser. Retain the source download and resulting diagnostics. Proof remains pending until their browser run passes.

## Gotchas

- A correct suggested filename does not establish that the PNG decodes or works with the strict upload parser.
- White guide pixels count as background. Painting only inside the guides leaves a mixed occupied cell, which the strict parser rejects.
- Record the actual round-trip outcomes. A filename assertion does not prove them.
- The displayed CSS preview is separate from the downloaded PNG. A screenshot of the preview does not prove the artifact's pixels.
- Save the download before closing its browser context. Browser-owned temporary downloads may disappear during cleanup.
