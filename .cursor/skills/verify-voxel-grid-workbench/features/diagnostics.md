# Project diagnostics

Users see upload readiness, construction findings, and separate geometry and color validation results.

## Sub-features

- `diagnostics.empty` identifies incomplete face assignments and the repair owner.
- `diagnostics.valid` reports the compatible candidate with no constructor findings.
- `diagnostics.color` reports a conflicting replacement image.
- `diagnostics.fallback` separates project readiness from the benchmark shown during incomplete input.

## How to get to it (user POV)

Open `/` and read **Active project** beneath Assets. Read **Validation lanes** below it. Upload or replace face images to change project diagnostics. Use viewer markers for projected conflicts and ambiguity.

## Driving it with Playwright

Preconditions: Launch through the skill. Use the [upload recipe](uploads.md) for accepted images and replacements.

- Run `--grep 'renders the workbench shell'`. Expect `project-readiness` to contain `0 of 6 compatible panels`, `project-diagnostics` to contain `Repair in: active project`, and `voxel-viewer-source` to read `benchmark fallback`.
- Upload six compatible single-cell PNGs. Expect `project-diagnostics` to contain `Constructor diagnostics report no findings`, readiness to show six saved assets and six active assignments, and the viewer source to switch to `project output`.
- Replace the front face with an otherwise compatible red single-cell PNG. The existing `constructs project-owned viewer output` test expects `source-panel color mismatches`, `invalid` in readiness, and changed canvas pixels.
- Replace that face with invalid PNG bytes. Expect five compatible panels and benchmark fallback. Preserve the diagnostic text and viewer source in the evidence so the displayed benchmark is not mistaken for the failed project's output.
- Inspect the visible lanes `Silhouette consistency`, `Connected watertight volume`, and `Surface color agreement`. Record their result and whether the card identifies `project` or `benchmark fallback`.

## Gotchas

- Six accepted panels can produce an invalid candidate. Acceptance, construction, and validation are separate results.
- The validation lanes can describe the benchmark while the active project reports missing panels. Check the source label for every claim.
- A green-looking viewer is not sufficient proof. Keep diagnostic messages, candidate source, and resulting image together.
- The browser suite covers the stated examples. It does not establish every constructor finding or repair-owner path.
