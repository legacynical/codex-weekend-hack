# Product requirements

Last verified: 2026-05-03 08:49 AM PDT
Source-of-truth for: product goals, scope, user-facing rules, and decision-rich intent for implementers

> Purpose: capture settled product behavior and requirements. Do not treat guesswork as decisions; record uncertainty, conflicts, and owner decisions in Open questions (`oqN.` handles). Audience: project owner, future humans, and agent implementers.

## A. Product summary

- Build an experimental interactive web UI for a 3D asset/world generator engine that uses 2D image generation as the primary creative primitive, then reconstructs or validates usable voxel outputs from constrained generated views.
- The initial product hypothesis extends a known technique: providing pregenerated grid/image inputs to image models so they fill bounded squares to produce valid pixel art.
- The first useful target is not arbitrary 3D generation. The product should prove that constrained 2D generations can become valid voxel forms, starting with simple geometry, voxelized icons, simple props, and stylized plants or animals before expanding toward more complex geometry.

---

## B. Product principles

1. Constraints first, expression second: generated images should be allowed to vary stylistically only inside boundaries that keep the final voxel output valid.
2. Validate before generalizing: the engine should demonstrate correctness on simple forms before attempting complex animals or organic geometry.
3. Keep the 2D-to-3D contract inspectable: generated side/front/top views, voxel reconstruction steps, and validation failures should be visible enough for humans and agents to debug.
4. Treat invalid generations as data: failures should feed constraint design, benchmark cases, and model-prompt iteration rather than being discarded as one-off mistakes.

---

## C. Scope and milestones

### In scope

- A pipeline for parsing constrained 2D pixel or grid images intended to represent one or more orthographic, diagonal, or cross-section views of a voxel object.
- Support for saved or uploaded image grids, with external image generation API support deferred.
- Template image input grids and copy-paste prompts that users can take to their image model of choice.
- A configurable intersecting slice/grid workspace where users can upload generated pixel images into specific slice planes and inspect the arrangement with free camera rotation.
- Slice/grid view configuration should support various selected slice planes, not only orthogonal view slices or 45-degree slices through center mass.
- Multi-view grid inputs covering `x`, `y`, `z`, and 45-degree diagonal or cross-section panels for experimentation.
- A reconstruction or constraint-solving step that converts generated 2D views into a candidate 3D voxel volume.
- A free-rotate 3D viewer for the reconstructed target voxel model, with gizmo-driven orthogonal surface selection for profile inspection.
- Grid template configuration, validation, saving, and reuse so users can create valid templates for external image models to fill with pixel art from multiple angles.
- A validation layer that detects impossible, ambiguous, disconnected, non-watertight, color-incoherent, or malformed voxel results.
- Color/material assignment as part of the first validation loop.
- Early benchmark objects with simple geometry, voxelized icons, simple props, stylized plants, and stylized animals.
- A voxel sphere benchmark with a complex, colorful swirl pattern.

### Out of scope

- Production-quality general 3D asset generation in the first milestone.
- Complex animal generation as the initial proof point.
- Photorealistic mesh generation, rigging, animation, physics, or game-engine export polish until valid voxel construction is proven.
- Depending on a single side view as sufficient truth for complex objects unless validation shows it works for a constrained object class.
- Direct voxel editing or direct slice editing in the free-rotate workspace; this is a planned feature after upload, inspection, reconstruction, and validation are reliable.
- Direct external image generation API integration in the first prototype.

### Baseline launch bar

- Generate or upload at least one simple object class from constrained 2D images into a valid 3D voxel asset.
- Show the input grid, parsed views, reconstructed voxel result, color/material preview, rotatable model viewer, and validation report for each run.
- Provide a configurable slice/grid workspace that can display uploaded pixel panels on intersecting planes, rotate freely, and use gizmo-driven orthogonal surface selection for template inspection.
- Let users save at least one valid grid template configuration for reuse with external image model prompts.
- Validate occupancy, watertight/connected volume, recognizable form, and coherent colors/materials.
- Include a small benchmark set that distinguishes valid generations, invalid generations, and ambiguous generations.
- Include a voxel sphere with a complex, colorful swirl pattern as an early benchmark.
- Make failure reasons actionable enough to guide the next prompt, template, or solver change.

### MVP build sequence

1. Ship pregenerated downloadable square grid template images for the `16`, `32`, and `64` presets. Each template is one plain `1024 x 1024` square grid PNG, not a face-layout sheet.
2. Add upload slots that map user-provided pixel-grid images to explicit faces or signed surfaces at the configured resolution, then validate dimensions, required slots, and panel metadata before reconstruction.
3. Wire uploaded slot data into the existing visual-hull reconstruction path so the user can construct a first voxel model from real template images, even if the first object class is simple geometry or the swirl sphere benchmark.
4. Keep further 3D inspection polish scoped to what the upload-to-voxel path needs: panel visibility, projected mode, conflict reporting, and enough camera/gizmo behavior to inspect whether construction worked.

### Current MVP implementation state

- The app exposes an Assets card with separate tabs for template downloads and uploads.
- The Templates tab provides three plain square-grid PNG downloads: `16 x 16`, `32 x 32`, and `64 x 64`, all exported as `1024 x 1024` PNGs for consistent image-model input.
- The grid cell sizes differ by preset inside the same canvas size: `64 px` cells for `16 x 16`, `32 px` cells for `32 x 32`, and `16 px` cells for `64 x 64`.
- The Uploads tab provides face-specific image slots for `front`, `back`, `left`, `right`, `top`, and `bottom`, all set to the currently configured resolution of `16`, `32`, or `64`.
- Upload parsing is not implemented yet, so the engine still cannot reconstruct a voxel model from image-generated pixel-art files.
- The next product-critical implementation step is browser image parsing from the upload slots into `ViewPanel` data.

### Deferred decisions

- Whether 45-degree panels should be treated as diagonal exterior views, true cross-section slices, or both.
- Whether reconstruction should be rule-based, constraint-solved, learned, or hybrid.

---

## D. Users, roles, and states

| Role or state | Description | Product rules |
| --- | --- | --- |
| Project owner | Defines target asset classes, constraints, and success criteria. | Owner decisions should be captured as requirements or open questions, not hidden in prompts. |
| Web UI user | Uploads or saves image grids, reviews parsed panels, and inspects voxel results. | Must be able to run the first workflow without external API credentials. |
| Generator operator | Runs generation experiments and reviews outputs. | Must see both the 2D generated inputs and resulting voxel validation state. |
| Implementer agent | Builds pipeline pieces, tests, prompts, and validators. | Must preserve inspectability and avoid treating visually pleasing but invalid outputs as success. |
| Valid asset | Candidate voxel object that passes the current validation rules. | Can be promoted to benchmark examples or exported later. |
| Invalid asset | Candidate that violates current constraints. | Should include a failure reason. |
| Ambiguous asset | Candidate where views are under-specified or admit multiple incompatible 3D interpretations. | Should be reported separately from invalid output. |

**Rules that must not be conflated:**

- A good-looking generated side image is not the same as a valid 3D voxel object.
- A connected, watertight voxel object is not proof that its colors/materials are coherent.
- A voxel object that passes simple geometric validation is not proof that the technique works for animals.
- Model creativity should be judged only after structural validity is satisfied.

---

## E. Technology direction

| Layer or concern | Direction | Product-facing constraint |
| --- | --- | --- |
| Runtime and UI | Browser-first React/Vite/TypeScript app. | The first workflow must run locally without accounts, backend storage, or external image-generation API credentials. |
| Voxel core | Framework-independent TypeScript modules. | Reconstruction, projection, and validation logic must be deterministic and testable without React or Three.js. |
| Rendering | Direct Three.js voxel and slice-grid preview. | Rendering must visualize validated voxel data, uploaded slice planes, gizmo-driven orthogonal surface selection, free orbit controls, and validation overlays; it must not become the source of truth for occupancy, template validity, or material state. |
| Parsing and contracts | Browser Canvas/ImageData plus typed schemas. | Uploaded image grids are untrusted inputs and must be parsed, schema-validated, and rejected with actionable errors before reconstruction when malformed. |
| Persistence | Local JSON export/import. | Runs, benchmarks, and saved grid templates must be reproducible without a server, including schema version, grid dimensions, slice/view definitions, source-image references, parsed panels, voxel data, material data, and validation results. |

**Product-level constraints:**

- The UI should remain inspectable and experiment-oriented rather than hiding the pipeline behind a single generate button.
- External generation providers are integration candidates only after saved/uploaded grid workflows and prompt templates prove useful.
- Package choices, module layout, and install commands live in [Tech stack](./tech-stack.md), not in this PRD.

---

## F. Problem, goals, and non-goals

- **Problem:** Image models can produce visually compelling 2D pixel art within grids, but turning generated side views into valid 3D voxel objects is underconstrained, especially for animals and other complex forms.
- **Goals:** Discover a repeatable 2D-generation-driven method for creating valid voxel assets; define constraints that preserve enough shape information; support multi-view input grids; and build validation loops that make generation failures useful.
- **Success criteria:** A benchmark object can be generated from constrained 2D views, reconstructed into voxels, validated automatically for recognizable form, connected/watertight volume, and coherent colors/materials, then inspected visually with clear pass/fail status.
- **Non-goals:** Solving arbitrary text-to-3D, generating complex animals first, depending on external image-generation APIs in the first prototype, or optimizing for final art quality before structural validity is reliable.

---

## G. Journeys and core behavior

### Experiment setup

- The operator chooses a target object class and a constraint template.
- The system provides three square grid template PNGs for use in the user's image model of choice: `16 x 16`, `32 x 32`, and `64 x 64`.
- All downloadable grid templates should be `1024 x 1024` PNGs because square 1024 output is a common/default image-generation target across current image models, and it divides cleanly into all three supported grid resolutions.
- The prompt/template should encode hard grid boundaries, voxel scale, color/material constraints, and any symmetry or connectivity expectations; face assignment happens in upload slots, not in the downloadable template image.
- The user can configure grid size and view/slice layout before saving a reusable template.
- First-class grid size presets for saved templates are `16`, `32`, and `64`; arbitrary dimensions are planned after the preset workflow is reliable.
- Saved templates should be valid by construction or fail with actionable template validation errors before the user sends them to an image model.
- The first target classes are geometric solids, voxelized icons, simple props, stylized plants, and stylized animals.

### 2D generation

- The user saves or uploads constrained grid images after generating or editing them outside the app.
- The app records uploaded/generated images as source artifacts for the voxel attempt.
- If the image violates obvious grid/view formatting constraints, the run should fail before reconstruction.

### Multi-view grid parsing

- The system should parse `x`, `y`, `z`, and 45-degree diagonal or cross-section panels from a single template image when configured.
- Axis-aligned views constrain the object's orthographic silhouettes and visible colors.
- 45-degree panels should be treated as additional experimental constraints that reduce ambiguity and expose color/material conflicts.
- Cross-section panels, when present, should constrain interior occupancy or material on a defined slice rather than being treated as ordinary exterior views.

### Slice workspace and camera controls

- The UI should provide a 3D workspace that shows intersecting image planes for the configured orthographic, diagonal, or cross-section slices.
- The slice workspace should allow users to select among multiple configured slice planes, including non-center slices; v0 should not assume all useful slices pass through center mass.
- Users should be able to upload generated pixel images into specific slice/view slots and inspect how those panels relate spatially before or during reconstruction.
- The slice workspace and reconstructed voxel model viewer should support free orbit rotation.
- The scene should support the six signed exterior panels as first-class inspection surfaces: `front`, `back`, `left`, `right`, `top`, and `bottom`.
- Each signed projected panel must be spatially aligned with the matching side of the voxel volume. A panel is not acceptable if it appears mirrored, rotated incorrectly, offset from the expected side, or visually disconnected from the surface it represents.
- Panel visibility controls and camera orientation controls are separate concepts. Surface buttons should expose all six projected panels directly as `Front`, `Back`, `Left`, `Right`, `Top`, and `Bottom`, and should toggle panel visibility rather than move the camera.
- Orthogonal camera navigation should be exposed through the orientation gizmo rather than a separate mode toggle or arrow-control cluster.
- Clicking a gizmo ball joint should animate the camera to the corresponding signed orthogonal surface: `front`, `back`, `left`, `right`, `top`, or `bottom`.
- The active surface text label should appear below the gizmo after a ball-joint selection so users know which orthogonal face is in view.
- Free camera rotation should remain available like Blender after any orthogonal surface transition, projected-mode toggle, panel-visibility change, or gizmo interaction; the perspective viewer must never remain in a locked, pan-only, or disabled-control state after a completed interaction.
- Dedicated orthogonal-view toggle and arrow controls are deprecated and should be removed cleanly once ball-joint navigation is available.
- The 3D voxel scene should include an always-visible Blender-style navigation/orientation gizmo in the top-right of the voxel canvas. It should prioritize camera navigation behavior over object-transform behavior: drag the center/orbit ball to orbit in perspective view, click the center/orbit ball to transition into the closest signed orthographic surface view, click a signed axis target to align to that surface, and keep the main canvas orbitable afterward.
- Dragging the middle/center of the orientation gizmo must behave as free perspective orbit/tumble, not as a constrained single-axis ring rotation. The camera should continue accepting horizontal and vertical orbit deltas across repeated drags without hitting a permanent polar lock, disabled-control state, or pan-only state.
- The gizmo should use Blender-like polish as a reference point: `X` red, `Y` green, and `Z` blue; large clickable ball targets instead of arrowheads; colored rotation arcs where they improve affordance; labels rendered on the positive-axis balls themselves; a center orbit ball that can be grabbed/click-dragged for free perspective rotation; dimmer/opposing signed targets for the negative sides; clean hover/pressed states; and no oversized frame that competes with the voxel scene.
- Perspective free-rotate regressions require root-cause investigation before being closed. Known risk: forcing a camera up vector that is parallel to the active view direction can produce a degenerate camera basis and make orbit controls appear stuck, especially after front/back orthogonal transitions.
- Frequently used 3D inspection controls, including object visibility, projected-panel visibility, voxel outline mode, projected mode, and gizmo surface navigation, should remain reachable from the voxel scene itself without requiring the user to scroll away from the canvas.
- Canvas-local controls should be compact and modern rather than a large multi-row button block. The preferred direction is a small toolbar or clustered icon/segmented controls with concise labels, predictable pressed states, and enough hit area to operate comfortably without covering the voxel scene.
- Voxel rendering should default to compact packed cubes with no visual gaps between adjacent voxels.
- The viewer should provide a display-mode toggle for showing individual cube outlines versus rendering same-color adjacent voxels as visually continuous blocks; this is a rendering preference only and must not change voxel occupancy or validation data.
- The viewer should provide a `Projected` display toggle that shows only the voxels implied or shaped by the currently visible projected panels. This mode should attempt to assign voxel colors from surface-visible panel pixels, flag color conflicts only when visible panel evidence constrains the same projected surface voxel to incompatible colors, and remain an inspection aid that does not overwrite the canonical voxel candidate or validation result.
- The viewer should provide `Hollow` as a first-class object display toggle, not a hidden sub-option. Hollow mode controls whether the current voxel preview shows only shell/surface voxels or includes filled interior voxels.
- Hollow projected inspection should support two source modes:
  - **Visible-panel hollow:** show the visible surface voxels directly evidenced by the currently enabled panels.
  - **Full-hull surface filter:** calculate from the full reconstructed hull, but show only the hull voxels associated with the currently enabled panels.
- Hollow behavior should work whether the underlying hull is empty or filled. The toggle changes which voxels are displayed for inspection; it must not rewrite canonical occupancy, panel data, or validation results.
- Hollow projected mode should keep the object footprint contained to the exterior layer visible from the active panels, then shrink inward when another visible projection constrains that footprint to a smaller silhouette or depth range. The intent is a hollow/surface preview that can show both the partial panel-calculated hull and the enabled-panel portion of the full calculated hull.
- Hollow mode should remain inspectable: if multiple visible panels imply incompatible shell placement, depth, or color assignments, the UI should flag the ambiguity rather than silently filling or deleting interior voxels.
- Conflict and ambiguity overlays should be independently toggleable. Conflict voxels may be marked with `x` on relevant faces, and ambiguous candidate shell voxels may be marked with `?` on relevant faces, so users can diagnose each failure class without losing the underlying hull preview.
- A projected hull reconstructed from the benchmark's own six signed surface panels should not report thousands of color conflicts by default. If the swirl sphere's own canonical panels still produce projected conflicts, the UI should treat that as a reconstruction/color-assignment bug or an under-specified-projection limitation to resolve before adding new workflows.
- Pixel-level conflict resolution through a pixel editor is a planned feature after projected-mode inspection can reliably identify conflicts; direct pixel editing is not required in the current inspection slice.

### Reconstruction

- The system converts generated views into a candidate voxel volume.
- For the earliest prototype, reconstruction may favor conservative occupancy rules over artistic completeness.
- Ambiguous cells should be tracked rather than silently guessed when possible.
- Projected hollow reconstruction should be modeled as a preview constraint over visible panels: either retain the surface voxels directly evidenced by the enabled panels, or compute from the full reconstructed hull and filter the visible surface voxels by enabled panel membership.
- Hollow preview should shrink the displayed shell when additional panel constraints rule out part of the footprint, while preserving enough ambiguity metadata to show candidate shell voxels when strict resolution is not possible.
- Hollow preview must preserve enough evidence to explain why a voxel is kept, removed, or marked ambiguous, including which panel projection constrained it.

### Validation and review

- The system reports whether the candidate is valid, invalid, or ambiguous.
- Validation should include geometry and appearance rules appropriate to the current object class, such as recognizability, connectivity, watertightness, silhouette consistency, coherent colors/materials, unsupported floating voxels, volume bounds, and simple symmetry constraints.
- Human review should include the source views, rotatable slice workspace, rendered voxel preview, gizmo-driven orthogonal surface selection, and validation report.
- Validation review should explain color/material conflicts in plain terms, especially when axis-only visual-hull reconstruction matches silhouettes but cannot infer hidden or conflicting surface colors.
- Projected-mode review should separately flag color conflicts introduced by the currently visible panel set so users can tell the difference between canonical candidate validation failures and active-panel projection conflicts.
- Projected-mode conflict counts must be explainable and benchmark-calibrated. The canonical swirl sphere panels should produce either zero conflicts or a small, documented ambiguity class with examples; an unexplained high count such as `1548` should fail stability review.
- Hollow projected-mode review should report shell-specific ambiguity separately from color conflict: a voxel may be geometrically ambiguous because panel evidence does not determine whether it belongs to the hollow shell, even when its color evidence is consistent.
- Conflict and ambiguity markers should be rendered as inspection overlays, not as voxel colors. Users must be able to independently hide conflict `x` markers and ambiguity `?` markers while keeping the hollow or filled voxel preview visible.

### First benchmark: swirl voxel sphere

- The first named benchmark should be a voxel sphere with a complex, colorful swirl pattern.
- The sphere tests whether simple watertight geometry can be paired with non-trivial color/material validation.
- The benchmark should distinguish geometry validity from color coherence so a correct sphere with broken colors fails the appropriate check.

---

## I. Data and content model (intent)

- **Canonical objects:** generation run, target object class, constraint template, saved grid template, grid size configuration, slice/view slot, uploaded source grid, parsed view panel, voxel candidate, material/color assignment, validation report, benchmark case.
- **Identity:** generation runs should be addressable by timestamp or stable run id; saved grid templates and benchmark cases should have stable names.
- **Ownership and boundaries:** the PRD owns product intent; future technical docs should own model choices, file formats, solver strategy, and rendering implementation.

---

## J. Output, reporting, and integration contract

- **Human output:** side-by-side view of prompt/template, uploaded 2D grid, parsed view panels, rotatable slice workspace, voxel reconstruction, color/material preview, gizmo-driven orthogonal surface selection, and validation result.
- **Machine output:** schema version, run metadata, template id/config, grid size configuration, slice/view slot definitions, source image references, parsed panel metadata, voxel volume data, material/color data, validation status, and failure reasons.
- **Integration boundaries:** later exporters or game-engine integrations should consume only validated voxel candidates, not raw generated images.
- **Persistence contract:** local JSON export/import is part of the v0 workflow so grid templates, benchmark cases, and failed runs can be replayed without a backend.

---

## K. Testing and validation strategy

- Start with deterministic or hand-authored fixture views for simple shapes to prove the reconstruction and validation logic independent of image model variability.
- Add image-generated cases only after the fixture path can pass and fail predictably.
- Include the swirl voxel sphere as an early fixture and uploaded-grid benchmark.
- Validate the core pipeline with deterministic unit tests before relying on browser smoke tests or visual inspection.
- Use browser-level checks for upload flow, layout, nonblank voxel rendering, rotatable slice-grid rendering, gizmo-driven orthogonal surface selection, saved template round trips, and mismatch overlays once the UI exists.
- Browser-level 3D inspection checks should cover actual camera position changes from free orbit before and after gizmo ball-joint orthogonal transitions, projected-mode toggles, panel visibility toggles, and repeated drag interactions; center-gizmo drag behavior; animated surface transitions from gizmo ball joints; visibility of the top-right orientation gizmo; reachability of scene controls without scrolling away from the voxel canvas; compact/no-gap voxel rendering; the cube-outline display toggle; six signed panel visibility toggles; the `Projected` display toggle; projected color assignment from surface-visible panel pixels; projected color-conflict reporting; and surface-label updates when gizmo ball joints are used.
- Hollow-mode tests should verify both visible-panel hollow and full-hull surface-filter modes. Coverage should include empty and filled hull fixtures, interior voxel removal, outer-shell preservation, footprint shrinkage when another visible projection constrains the result, and separate reporting/toggling for conflict `x` markers and ambiguity `?` markers.
- Add example pixel-panel fixture sets for the projected hollow path: a single-panel visible-surface case, a multi-panel strict-intersection shrink case, a full-hull surface-filter case, a conflicting-color case, an ambiguous-shell case, and an empty-hull/no-evidence case.
- Perspective free-rotate regression coverage should include repeated drags in varied directions and assert that the camera keeps changing while controls remain enabled, so failures where rotation eventually becomes restricted are caught before release.
- Browser-level 3D inspection checks should also cover signed panel alignment from representative front/back/left/right/top/bottom camera views, the interactive rotation-arc behavior of the top-right gizmo, and control overlay footprint so the toolbar does not dominate or obscure the primary voxel scene.
- Maintain benchmark tiers:
  - Tier 1: simple geometric solids and combinations, including the swirl voxel sphere.
  - Tier 2: voxelized icons and simple props.
  - Tier 3: stylized plants and primitive creatures with strong symmetry and constrained silhouettes.
  - Tier 4: stylized animals with multiple body parts and more expressive variation.
- Track failure classes, including view-format violation, silhouette mismatch, disconnected geometry, non-watertight volume, ambiguous depth, invalid topology, color/material incoherence, and validator/model disagreement.

---

## L. Trust, safety, and operations

- The system should never label an output successful solely because the 2D image is attractive.
- Prompts, templates, saved/uploaded images, model settings when known, and validation results should be retained for reproducibility during experiments.
- Any benchmark promotion should require a saved source input and a saved validation result.
- Model-driven outputs should be treated as candidates until validation and human review confirm they are useful.
- Uploaded image grids should be treated as untrusted content: parse through browser image APIs, validate template metadata, and fail early on mismatched dimensions, missing panels, or invalid channels.
- External image generation API support is deferred; the first prototype should work with saved or uploaded image grids.

---

## M. Related documentation

- [Documentation index](./_index.md)
- [Tech stack](./tech-stack.md)
- [Multi-view voxel reconstruction from 2D image grids](./research/multi-view-voxel-reconstruction.md)
- [Blender navigation gizmo reference](./research/blender-navigation-gizmo.md)

---

## Task triage

tt5. [action] Implement browser image parsing that converts face-slot PNG/WebP/JPEG uploads into `ViewPanel` data through Canvas/ImageData, preserving occupied pixels, transparent/background empties, source colors, slot id, configured preset size, and parse errors.
tt6. [action] Add pre-reconstruction upload validation for required slots, image dimensions, file type, grid alignment, color/alpha policy, empty panels, duplicate slots, and malformed cell contents so invalid uploads fail before voxel construction.
tt7. [action] Connect parsed uploaded face panels to `reconstructProjectedHull` and `validateVoxelCandidate`, then make the uploaded run replace the built-in swirl benchmark as the active candidate only when the parsed panel set passes validation.
tt8. [action] Introduce a single local run record in UI state so uploaded source names, parsed panels, reconstructed voxels, projected mode, conflict markers, ambiguity markers, validation lanes, and replay/export data refresh from one source of truth.
tt9. [iterate] Create deterministic fixture upload sets before image-model trials: a known-good swirl sphere six-panel set, a simple cube or cuboid set, one deliberately malformed dimension case, one empty-panel case, and one color-conflict case.
tt10. [iterate] Add prompt copy next to each downloadable square grid template that tells an external image model to preserve the `1024 x 1024` canvas, visible grid boundaries, pixel scale, background/transparent empty cells, and one-pixel-per-cell semantics.
tt11. [action] Add local JSON export/import for the first run record once tt8 is stable: schema version, template id, preset size, uploaded source names, parsed panels, reconstructed voxel candidate, validation result, and known non-persisted image-byte limitations.
tt12. [research] Test whether current image models preserve `16`, `32`, and `64` square grid templates well enough for reliable parsing, and record model/prompt examples that pass or fail the parser.
tt13. [risk] Image models may distort square grid boundaries, cell counts, colors, or image dimensions; mitigate with high-contrast template guides, parser rejection, clear failure messages, and fixture-first validation before treating generated examples as product proof.
tt14. [risk] Six exterior surface panels may be insufficient for color-coherent reconstruction of concave or occluded objects; keep diagonal/cross-section panels and ambiguity reporting visible until the owner decides how much ambiguity is acceptable.
tt15. [deferred] Add external image generation API support after template download, upload parsing, reconstruction, validation, local replay, and prompt-template usefulness are reliable.
tt16. [deferred] Add direct pixel editing, direct slice editing, and advanced hollow/ambiguity workflows after the uploaded-image-to-voxel loop works end to end.
tt17. [deferred] Decide whether subsystem PRDs are needed for parsing/data contracts, reconstruction/validation, and viewer interaction once the MVP run-record contract stops changing.

---

## Open questions

oq1. What is the primary product proof for the next milestone: a valid uploaded swirl sphere, any simple valid voxel object from uploaded panels, or an image-model-generated object that passes the parser and validator without hand repair?
oq2. Which object class should define the first non-sphere success path: simple geometric solids, voxelized icons, simple props, stylized plants, primitive creatures, or stylized animals?
oq3. Should the MVP require all six signed exterior panels (`front`, `back`, `left`, `right`, `top`, `bottom`) before reconstruction, or should it allow partial panel sets that produce an explicitly ambiguous visual hull?
oq4. For uploaded templates, should background/empty cells be represented by transparency, a fixed background color, a reserved palette index, or any low-alpha/near-background pixel that passes a tolerance?
oq5. How strict should color/material validation be for v0: exact palette match, nearest-palette tolerance, perceptual color tolerance, or object-class-specific rules?
oq6. What is the expected user workflow after parser rejection: only show actionable errors, offer automatic cleanup/cropping, or support manual repair through a later pixel/slice editor?
oq7. Should diagonal and cross-section panels remain deferred until six-surface uploads are reliable, or are they required in the first product proof to reduce ambiguity?
oq8. What should count as "recognizable form" in validation for early assets: fixed fixture comparison, silhouette similarity thresholds, owner/human review, or a mix of automated checks and human approval?
oq9. Should local JSON export/import persist only parsed voxel/run data for reproducibility, or should it also embed source image bytes/base64 so a run can be fully replayed without separate image files?
oq10. What level of failure reporting is required before calling the prototype useful: per-run summary only, per-panel errors, per-voxel conflict/ambiguity overlays, or exportable diagnostic reports?
oq11. Which user persona should drive UI priority for the first workflow: the project owner experimenting quickly, a generator operator comparing many prompts, or an implementer debugging parser/reconstruction failures?
oq12. Should the product optimize first for proving the technique locally in the browser, or for producing shareable/exportable voxel assets once a run validates?
oq13. Are advanced viewer controls such as hollow projected modes and gizmo polish still product-critical for the next milestone, or should they pause behind upload parsing, run records, and fixture validation?
oq14. When generated image panels are visually attractive but structurally invalid, should the app treat them as rejected candidates only, or preserve them as useful negative examples for prompt/template iteration?
oq15. What decision would justify creating subsystem PRDs now: growing implementation complexity, multiple agents editing separate areas, or a need to stabilize contracts before more code is written?
