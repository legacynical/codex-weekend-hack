# Viewer controls

Users inspect the candidate through camera movement, face panels, voxel modes, outlines, and diagnostic markers.

## Sub-features

- `viewer.ready` renders the 3D candidate and six projected slice previews.
- `viewer.layers` toggles Panels, Voxels, individual faces, Projected, Hollow, and Cube outlines.
- `viewer.markers` changes hollow sources and conflict or ambiguity markers.
- `viewer.camera` rotates the camera through the canvas and orientation gizmo.
- `viewer.idle` stops rendering after interaction settles and renders after resize.
- `viewer.lifecycle` preserves the selected surface and display choices when uploads replace the benchmark or a rejected replacement restores it.

## How to get to it (user POV)

Open `/` to inspect the benchmark immediately, or upload six compatible panels for project output. Use the toolbar inside the 3D view. Drag the canvas to orbit. Use the orientation gizmo in the upper right to change the view.

## Driving it with Playwright

Preconditions: Launch through the skill. Wait for `voxel-viewer-canvas` and visible `3D ready`.

- Run `--grep 'renders voxel content on demand'` for the toolbar, gizmo, resize, render-idle, and screenshot assertions. The toolbar is `voxel-scene-controls`. The six HTML previews appear in `voxel-html-preview`.
- Click `page.getByRole("button", { name: "Voxels", exact: true })`. Expect `aria-pressed="false"`, `data-voxel-mode="hidden"`, and `data-visible-voxel-count="0"` on the canvas. Compare visible and hidden screenshots. Click again to restore voxels.
- Toggle `Panels` and face buttons named `Front`, `Back`, `Left`, `Right`, `Top`, and `Bottom`. Check each `aria-pressed` state and the resulting scene.
- Use `voxel-projected-toggle`, `voxel-hollow-toggle`, `voxel-outline-toggle`, `voxel-hollow-visible-source`, and `voxel-hollow-full-source`. Observe the rendered scene alongside pressed states and canvas counts.
- Use `voxel-conflict-marker-toggle` and `voxel-ambiguity-marker-toggle` for overlays. Check `projected-ambiguity-status` in the hollow projected mode.
- Run `--grep 'keeps perspective view freely rotatable'` for repeated synthetic drag assertions. The test checks changed `data-camera-position`, increasing `data-orbit-events`, and restored `data-controls-enabled="true"`.
- Run `--grep 'preserves viewer controls through project construction and rejected replacement fallback'` from `tests/browser/viewer-lifecycle.spec.ts`. The recipe selects the right gizmo face through `page.mouse.click` at the canvas's right edge minus 18 pixels and top edge plus 48 pixels. It checks that `data-active-surface` and `voxel-surface-label` both read `right`, and that the original canvas remains connected.
- The lifecycle recipe then hides Voxels and Panels, enables Projected and Cube outlines, and disables Front before uploading six compatible PNGs. After project construction and rejected replacement fallback, the selected surface and its label must still read `right`.
- When `voxel-viewer-source` reads `project output`, expect the toolbar choices to remain selected and `data-voxel-mode="hidden"`. Visible voxel and outline counts must remain zero. Re-enable Voxels through its button. Expect projected mode, one visible voxel, twelve outline segments, and changed canvas pixels.
- Reject a front replacement through the real file input. When `voxel-viewer-source` reads `benchmark fallback`, expect the same toolbar choices, projected mode, more than one visible voxel, and more than twelve outline segments. The test retains screenshots before uploads, after project construction, after showing projected voxels, and after fallback.

## Gotchas

- Current helpers named `dragCanvasWithMouse`, `dragGizmoCenterWithMouse`, and `clickGizmoCenterWithMouse` dispatch synthetic PointerEvents. The lifecycle test's right-face selection uses Playwright mouse input. That click does not establish real mouse dragging, capture, or release behavior. Use Computer Use for interactive pointer reproduction.
- Diagnostic canvas attributes support the visible proof. They cannot establish correct rendering alone.
- Toolbar state alone does not prove that a replacement scene received the display choices. Check the source label, rendered mode and counts, and screenshots at each lifecycle transition.
- The existing suite excludes `GPU stall due to ReadPixels` messages from its console warning check. Report other warnings or errors and retain traces.
- A settled render counter establishes the tested idle period. It does not prove long-running memory or CPU performance.
