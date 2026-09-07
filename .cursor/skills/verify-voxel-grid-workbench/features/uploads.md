# Face uploads

Users choose a grid size and assign images to six faces. Six compatible panels replace the benchmark with the project's voxel candidate.

## Sub-features

- `uploads.entry` opens the slots through the header button or the Uploads tab.
- `uploads.accept` accepts compatible images for front, back, left, right, top, and bottom.
- `uploads.replace` replaces a face and updates the candidate or reports rejection.
- `uploads.race` ignores obsolete decodes after a size change or a newer selection.
- `uploads.obsolete-rejection` keeps the newer accepted image when an older decode fails later.
- `uploads.concurrent` retains accepted faces when a size change cancels another pending face.

## How to get to it (user POV)

Click **Upload face images** in the header or **Uploads** in the Assets card. Choose **16**, **32**, or **64** under Panel grid size. Select an image in each face slot.

## Driving it with Playwright

Preconditions: Launch through the skill. Use `createPanelPng` from `tests/browser/panelPngFixture.ts` for compatible test images.

- Open the header entry with `page.getByRole("button", { name: "Upload face images" }).click()`. Expect `upload-slots-tab` and the `front face image` input. The tab entry is `page.getByRole("button", { name: "Uploads", exact: true })` and needs its own check when claiming both entry points.
- For each face, call `page.getByLabel(slot + " face image").setInputFiles(...)` with a PNG from `createPanelPng({ preset: 16, occupiedCells: [[0, 0]] })`. Expect `upload-slot-status-${slot}` to contain `accepted at 16 x 16` and `project-readiness` to increment to `6 of 6 compatible panels`.
- After six accepted images, expect `voxel-viewer-source` to read `project output`, the visible title `Upload project candidate`, and `voxel-viewer-canvas` to have `data-visible-voxel-count="1"`.
- Replace the front image with invalid PNG bytes through the same input. Expect the decode error, five compatible panels, six saved assets, five active assignments, and `voxel-viewer-source` equal to `benchmark fallback`.
- Run `--grep 'ignores stale decodes'` for the delayed decode, size change, and rapid replacement path. Its assertions require the final accepted filename and readiness count to remain stable after the delayed decode finishes.
- Run `--grep 'keeps a newer accepted upload when an obsolete replacement decode rejects'` from `tests/browser/upload-lifecycle.spec.ts`. The recipe rejects an invalid front image, starts a delayed replacement, then accepts `current-front.png`. After the obsolete replacement fails, expect that filename to remain accepted with one compatible panel, one saved asset, and one active assignment.
- Run `--grep 'retains concurrent accepted panels when resolution changes cancel another upload'` from the same file. The recipe uploads front and back concurrently, with back completing first. After both are accepted, it starts left and changes Panel grid size to **32**. Expect the left status to retain its size-change diagnostic after its decode finishes. Front and back remain accepted at **16 x 16**, with two compatible panels, two saved assets, and two active assignments.
- Use [the viewer lifecycle recipe](viewer-controls.md) when changing the upload-to-viewer boundary. It verifies that scene replacements preserve existing toolbar choices and their rendered effects.

## Gotchas

- The input resets its value after selection so selecting the same filename can trigger again. Observe the slot status rather than the file input value for acceptance.
- A saved asset is separate from an active assignment. A rejected replacement can retain six saved assets while reducing compatible assignments to five.
- The browser upload adapter supports PNG, WebP, and JPEG. The current browser upload proof uses generated PNGs. It does not establish WebP, JPEG, every size, or persistence after reload.
- The race tests intercept decode timing. The obsolete-rejection test also forces the older decode to fail. Report those controlled conditions with the result.
- The size selector controls new uploads. The concurrent characterization retains already accepted 16 x 16 panels when the selector changes to 32. It does not establish mixed-resolution construction.
