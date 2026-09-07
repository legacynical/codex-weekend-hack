# Voxel Grid Workbench verification map

Use [the skill](../SKILL.md) for launch, Doctor, evidence, and cleanup. Start each recipe at `/` in a fresh browser context. The initial viewer shows the swirl benchmark, and the Assets card opens on Templates.

These maps describe the user paths to check. The existing browser suite covers only the stated entry points and assertions. Read the matching file before narrowing a run with `--grep`.

| Feature | Entry points | Existing test selection |
| --- | --- | --- |
| [Face uploads](uploads.md) | Upload face images header button, Uploads tab | `constructs project-owned viewer output\|ignores stale decodes` |
| [Upload lifecycle](uploads.md) | Same-slot replacements, concurrent face inputs, Panel grid size | `keeps a newer accepted upload when an obsolete replacement decode rejects\|retains concurrent accepted panels when resolution changes cancel another upload` |
| [Template downloads](template-downloads.md) | Templates tab, three PNG buttons | `downloads the selected template PNG\|downloaded .* template accepts` |
| [Viewer controls](viewer-controls.md) | 3D view toolbar, canvas, orientation gizmo | `renders voxel content on demand\|keeps perspective view freely rotatable` |
| [Viewer lifecycle](viewer-controls.md) | Toolbar choices followed by project construction and rejected replacement | `preserves viewer controls through project construction and rejected replacement fallback` |
| [Project diagnostics](diagnostics.md) | Active project card, Validation lanes, viewer overlays | `renders the workbench shell\|constructs project-owned viewer output\|renders voxel content on demand` |

Record feature IDs, entry points, test results, untested paths, and evidence locations with each proof. Keep evidence through cleanup. Use Computer Use for interactive verification, including real mouse checks. The suite's synthetic pointer events are a separate proof level.
