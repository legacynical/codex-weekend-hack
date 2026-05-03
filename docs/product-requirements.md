# Product requirements

Last verified: 2026-05-02 05:08 PM
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
- Multi-view grid inputs covering `x`, `y`, `z`, and 45-degree diagonal or cross-section panels for experimentation.
- A reconstruction or constraint-solving step that converts generated 2D views into a candidate 3D voxel volume.
- A validation layer that detects impossible, ambiguous, disconnected, non-watertight, color-incoherent, or malformed voxel results.
- Color/material assignment as part of the first validation loop.
- Early benchmark objects with simple geometry, voxelized icons, simple props, stylized plants, and stylized animals.
- A voxel sphere benchmark with a complex, colorful swirl pattern.

### Out of scope

- Production-quality general 3D asset generation in the first milestone.
- Complex animal generation as the initial proof point.
- Photorealistic mesh generation, rigging, animation, physics, or game-engine export polish until valid voxel construction is proven.
- Depending on a single side view as sufficient truth for complex objects unless validation shows it works for a constrained object class.
- Direct external image generation API integration in the first prototype.

### Baseline launch bar

- Generate or upload at least one simple object class from constrained 2D images into a valid 3D voxel asset.
- Show the input grid, parsed views, reconstructed voxel result, color/material preview, and validation report for each run.
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
| Rendering | Direct Three.js voxel preview. | Rendering must visualize validated voxel data and validation overlays; it must not become the source of truth for occupancy or material state. |
| Parsing and contracts | Browser Canvas/ImageData plus typed schemas. | Uploaded image grids are untrusted inputs and must be parsed, schema-validated, and rejected with actionable errors before reconstruction when malformed. |
| Persistence | Local JSON export/import. | Runs and benchmarks must be reproducible without a server, including schema version, source-image references, parsed panels, voxel data, material data, and validation results. |

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

### Reconstruction

- The system converts generated views into a candidate voxel volume.
- For the earliest prototype, reconstruction may favor conservative occupancy rules over artistic completeness.
- Ambiguous cells should be tracked rather than silently guessed when possible.

### Validation and review

- The system reports whether the candidate is valid, invalid, or ambiguous.
- Validation should include geometry and appearance rules appropriate to the current object class, such as recognizability, connectivity, watertightness, silhouette consistency, coherent colors/materials, unsupported floating voxels, volume bounds, and simple symmetry constraints.
- Human review should include the source views and a rendered voxel preview.

### First benchmark: swirl voxel sphere

- The first named benchmark should be a voxel sphere with a complex, colorful swirl pattern.
- The sphere tests whether simple watertight geometry can be paired with non-trivial color/material validation.
- The benchmark should distinguish geometry validity from color coherence so a correct sphere with broken colors fails the appropriate check.

---

## I. Data and content model (intent)

- **Canonical objects:** generation run, target object class, constraint template, uploaded source grid, parsed view panel, voxel candidate, material/color assignment, validation report, benchmark case.
- **Identity:** generation runs should be addressable by timestamp or stable run id; benchmark cases should have stable names.
- **Ownership and boundaries:** the PRD owns product intent; future technical docs should own model choices, file formats, solver strategy, and rendering implementation.

---

## J. Output, reporting, and integration contract

- **Human output:** side-by-side view of prompt/template, uploaded 2D grid, parsed view panels, voxel reconstruction, color/material preview, and validation result.
- **Machine output:** schema version, run metadata, template id/config, source image references, parsed panel metadata, voxel volume data, material/color data, validation status, and failure reasons.
- **Integration boundaries:** later exporters or game-engine integrations should consume only validated voxel candidates, not raw generated images.
- **Persistence contract:** local JSON export/import is part of the v0 workflow so benchmark cases and failed runs can be replayed without a backend.

---

## K. Testing and validation strategy

- Start with deterministic or hand-authored fixture views for simple shapes to prove the reconstruction and validation logic independent of image model variability.
- Add image-generated cases only after the fixture path can pass and fail predictably.
- Include the swirl voxel sphere as an early fixture and uploaded-grid benchmark.
- Validate the core pipeline with deterministic unit tests before relying on browser smoke tests or visual inspection.
- Use browser-level checks for upload flow, layout, nonblank voxel rendering, and mismatch overlays once the UI exists.
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

---

## Task triage

tt1. [iterate] Prototype and evaluate the swirl voxel sphere benchmark with occupancy, watertight/connectivity, and color coherence checks.
tt2. [action] Define the first multi-view grid template and JSON/Zod contract supporting `x`, `y`, `z`, and 45-degree diagonal or cross-section panels.
tt3. [iterate] Test whether axis-only, axis-plus-diagonal, or axis-plus-cross-section grid inputs produce the best validity rate for simple geometry.
tt4. [risk] Animal generation may require richer constraints than side views can provide, causing attractive but structurally invalid voxel outputs.
tt5. [deferred] Add external image generation API support after saved/uploaded image workflows and template prompts are useful.

---

## Open questions

No open questions.
