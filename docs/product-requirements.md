# Product requirements

Last verified: 2026-05-02 11:47 PM PDT
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
- The system provides one or more 2D grid templates and copy-paste prompts for use in the user's image model of choice.
- The prompt/template should encode hard boundaries, view layout, voxel scale, color/material constraints, and any symmetry or connectivity expectations.
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
- The 3D voxel scene should include an always-visible Blender-style navigation/orientation gizmo in the top-right of the voxel canvas. It should prioritize camera navigation behavior over object-transform behavior: drag the center/orbit ball to orbit in perspective view, click a signed axis target to align to that surface, and keep the main canvas orbitable afterward.
- The gizmo should use Blender-like polish as a reference point: `X` red, `Y` green, and `Z` blue; large clickable ball targets instead of arrowheads; labels rendered on the positive-axis balls themselves; a center orbit ball that can be grabbed/click-dragged for free perspective rotation; dimmer/opposing signed targets for the negative sides; clean hover/pressed states; and no oversized frame that competes with the voxel scene.
- Perspective free-rotate regressions require root-cause investigation before being closed. Known risk: forcing a camera up vector that is parallel to the active view direction can produce a degenerate camera basis and make orbit controls appear stuck, especially after front/back orthogonal transitions.
- Frequently used 3D inspection controls, including object visibility, projected-panel visibility, voxel outline mode, projected mode, and gizmo surface navigation, should remain reachable from the voxel scene itself without requiring the user to scroll away from the canvas.
- Canvas-local controls should be compact and modern rather than a large multi-row button block. The preferred direction is a small toolbar or clustered icon/segmented controls with concise labels, predictable pressed states, and enough hit area to operate comfortably without covering the voxel scene.
- Voxel rendering should default to compact packed cubes with no visual gaps between adjacent voxels.
- The viewer should provide a display-mode toggle for showing individual cube outlines versus rendering same-color adjacent voxels as visually continuous blocks; this is a rendering preference only and must not change voxel occupancy or validation data.
- The viewer should provide a `Projected` display toggle that shows only the voxels implied or shaped by the currently visible projected panels. This mode should attempt to assign voxel colors from surface-visible panel pixels, flag color conflicts only when visible panel evidence constrains the same projected surface voxel to incompatible colors, and remain an inspection aid that does not overwrite the canonical voxel candidate or validation result.
- A projected hull reconstructed from the benchmark's own six signed surface panels should not report thousands of color conflicts by default. If the swirl sphere's own canonical panels still produce projected conflicts, the UI should treat that as a reconstruction/color-assignment bug or an under-specified-projection limitation to resolve before adding new workflows.
- Pixel-level conflict resolution through a pixel editor is a planned feature after projected-mode inspection can reliably identify conflicts; direct pixel editing is not required in the current inspection slice.

### Reconstruction

- The system converts generated views into a candidate voxel volume.
- For the earliest prototype, reconstruction may favor conservative occupancy rules over artistic completeness.
- Ambiguous cells should be tracked rather than silently guessed when possible.

### Validation and review

- The system reports whether the candidate is valid, invalid, or ambiguous.
- Validation should include geometry and appearance rules appropriate to the current object class, such as recognizability, connectivity, watertightness, silhouette consistency, coherent colors/materials, unsupported floating voxels, volume bounds, and simple symmetry constraints.
- Human review should include the source views, rotatable slice workspace, rendered voxel preview, gizmo-driven orthogonal surface selection, and validation report.
- Validation review should explain color/material conflicts in plain terms, especially when axis-only visual-hull reconstruction matches silhouettes but cannot infer hidden or conflicting surface colors.
- Projected-mode review should separately flag color conflicts introduced by the currently visible panel set so users can tell the difference between canonical candidate validation failures and active-panel projection conflicts.
- Projected-mode conflict counts must be explainable and benchmark-calibrated. The canonical swirl sphere panels should produce either zero conflicts or a small, documented ambiguity class with examples; an unexplained high count such as `1548` should fail stability review.

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

tt1. [iterate] Prototype and evaluate the swirl voxel sphere benchmark with occupancy, watertight/connectivity, and color coherence checks.
tt2. [action] Define the first configurable multi-view grid template and JSON/Zod contract supporting grid sizes, saved templates, `x`, `y`, `z`, and 45-degree diagonal or cross-section panels.
tt3. [iterate] Test whether axis-only, axis-plus-diagonal, or axis-plus-cross-section grid inputs produce the best validity rate for simple geometry.
tt4. [risk] Animal generation may require richer constraints than side views can provide, causing attractive but structurally invalid voxel outputs.
tt5. [deferred] Add external image generation API support after saved/uploaded image workflows and template prompts are useful.
tt6. [action] Refactor the rotatable slice workspace and reconstructed voxel model viewer so panel visibility controls and camera orientation controls are separate UI concepts.
tt7. [action] Stabilize voxel scene inspection UX with a top-right `x/y/z` orientation gizmo, canvas-local controls, compact no-gap voxel rendering, and cube-outline display mode.
tt8. [action] Add six signed projected panels, per-surface visibility state, and gizmo-driven signed orthogonal surface transitions with current-surface labeling.
tt9. [action] Add a `Projected` display mode that previews the voxel hull implied by the currently visible projected panels, assigns colors from visible panel pixels, and reports color conflicts without mutating the canonical voxel candidate.
tt10. [deferred] Add a pixel editor for resolving projected-panel color conflicts after projected-mode conflict detection is reliable.
tt11. [action] Correct signed panel placement and orientation so all six projected panels line up with their corresponding voxel-volume sides.
tt12. [iterate] Replace the oversized canvas control block with a compact modern control surface that keeps the voxel scene visually primary.
tt13. [iterate] Upgrade the top-right orientation gizmo into a Blender-style combination gizmo with colored axes, draggable rotation arcs, and clickable ball joints for signed orthogonal surface views.
tt14. [action] Fix the perspective free-rotate regression so viewport drag never gets stuck after gizmo, projected-mode, panel, or surface-selection interactions.
tt15. [action] Investigate and reduce the `1548` projected color conflicts from canonical swirl sphere panels; document any remaining expected ambiguity with example voxels and panel evidence.
tt16. [iterate] Redesign the gizmo visual model around larger ball targets that replace arrowheads, labels above positive-axis balls, hover/pressed states, and Blender-like navigation behavior.
tt17. [action] Add instrumentation and regression coverage that proves perspective drags change camera position after front/back/top/bottom/right/left gizmo transitions, not only that OrbitControls emits events.

---

## Open questions

No open questions.

## Decisions

d1. The free-rotate workspace remains upload/inspect/template-only for v0; direct voxel or slice editing is planned after reconstruction and validation are reliable.
d2. The grid view should support various slice selections, including non-center slices, not only orthogonal view slices or 45-degree slices through center mass.
d3. First-class saved-template grid size presets are `16`, `32`, and `64`; arbitrary dimensions are planned later.
d4. Surface buttons in the voxel scene control projected-panel visibility, not camera movement. Orthogonal camera navigation is driven by the top-right gizmo with explicit current-surface labeling.
d5. Voxel scene controls should be available near or over the canvas instead of only below later page content, because scroll-dependent controls make inspection workflows harder to use.
d6. Compact packed voxel rendering with no gaps is the preferred default; cube outlines are an optional display mode for reading individual voxel boundaries.
d7. The initial orthogonal surface set is the full six signed exterior set: `front`, `back`, `left`, `right`, `top`, and `bottom`; diagonal and target-slice camera views remain deferred.
d8. The orientation gizmo belongs in the top-right of the voxel canvas.
d9. Surface visibility controls should expose all six surfaces directly, without relying on grouped controls such as `Side`.
d10. Orthogonal surface navigation should live in the top-right gizmo. Clicking a ball joint should animate to that signed surface, show the surface label below the gizmo, and leave free orbit rotation available afterward.
d11. The separate `Orthogonal View` toggle and arrow controls are deprecated by the ball-joint gizmo model and should be removed from the primary control surface.
d12. `Projected` display mode should preview only the voxels implied by currently visible projected panels, assign colors from surface-visible panel pixels where possible, flag conflicts from incompatible visible-panel evidence on the same projected surface voxel, and avoid changing the canonical voxel candidate or validation data.
d13. Pixel-level editing for resolving projected-panel color conflicts is planned but deferred until projected-mode conflict detection is reliable.
d14. All six projected panels must be visually aligned with the voxel volume side they represent; panel misalignment is a stability bug, not a cosmetic issue.
d15. The top-right gizmo should evolve from an informational axis marker into an interactive Blender-style combination gizmo with drag rotation along colored arcs.
d16. The current large canvas-local control footprint is not acceptable long term; inspection controls should be redesigned into a compact modern toolbar/control cluster.
d17. The Blender navigation gizmo, not the object transform gizmo, is the closer behavioral reference for this viewer: drag orbits the view, clicking axis labels/balls aligns the view, and the camera remains freely orbitable after alignment.
d18. The current `1548` projected color conflicts in the canonical swirl sphere are not accepted as expected behavior without deeper proof; the next implementation pass should treat them as a bug or unresolved projection-model limitation.
d19. A likely root cause of the repeated perspective-rotate lock is camera-up handling: resetting `camera.up` to world Y while the camera is looking along the Y axis can make the up vector parallel to the view direction and destabilize OrbitControls.
d20. Gizmo labels should be rendered on the positive-axis balls themselves, and the center ball should be an active orbit affordance rather than decorative geometry.
