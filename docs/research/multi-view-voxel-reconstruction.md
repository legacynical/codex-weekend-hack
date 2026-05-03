---
topic: "Multi-view voxel reconstruction from 2D image grids"
slug: "multi-view-voxel-reconstruction"
aliases:
  - "shape from silhouettes"
  - "visual hull voxel reconstruction"
  - "multi-view voxel coloring"
category: architecture
researched: "2026-05-02T14:30:46-07:00"
expires: "2027-05-02"
version: 1
confidence: medium
project: "codex-weekend-hack"
related-decisions: []
related-research: []
source-count: 5
status: current
superseded-by: null
---

# Multi-view voxel reconstruction from 2D image grids

## Context

This project is investigating whether constrained 2D image generations can be converted into valid voxel assets. The near-term direction is an experimental web UI where users provide saved or uploaded image grids containing orthographic, diagonal, or cross-section views. The closest classical pattern is Shape from Silhouette (SFS), also called visual hull construction: it estimates shape from multiple silhouettes and returns an upper bound of the object, not a guaranteed exact reconstruction [S1]. With few views, the visual hull can be coarse, cannot recover concavities that never appear in silhouettes, and is sensitive to silhouette or calibration errors [S1, S2].

## Shape-from-silhouette baseline

Visual-hull reconstruction maps cleanly to a voxel prototype. A candidate voxel is projected into each supplied view; if that projected position falls outside any required silhouette, the voxel is eliminated. A teaching implementation describes this as computing an occupancy score for each voxel by projecting into each image and adding to the score when the point falls inside the silhouette [S3].

For generated grids, the "camera" can be deterministic. Axis-aligned views can be defined as:

| View | Projection from voxel `(x, y, z)` to grid pixel | Common role |
| --- | --- | --- |
| `x` side view | `(y, z)` | Constrains height and depth silhouette. |
| `y` front/back view | `(x, z)` | Constrains width and height silhouette. |
| `z` top/bottom view | `(x, y)` | Constrains footprint. |

The simplest candidate is the intersection of all view-consistent voxel sets. This is deterministic and suitable for hand-authored fixtures before image-generated inputs. It will overfill hidden concavities because silhouette-only reconstruction returns the maximal silhouette-consistent volume [S1, S2].

## Multi-view grids and 45-degree constraints

Adding more views reduces ambiguity. A multi-view reconstruction survey states that single-view reconstruction is ambiguous and uncertain, while multi-view methods use several viewpoints to make reconstruction more tractable [S4]. For this project, generated grid inputs can expose `x`, `y`, `z`, and 45-degree views in one template.

45-degree views can be deterministic projections in integer voxel space. For example, a diagonal around `z` can map `(x, y, z)` to `(x + y, z)` or `(x - y, z)` after applying an offset. These are diagonal silhouettes unless the template explicitly asks for slice images. A true cross-section view should specify a plane, such as `x + y = k`, and a convention for how colors/materials are sampled.

| Panel kind | Meaning | Validation use |
| --- | --- | --- |
| Orthographic silhouette/color view | Surface appearance from an axis-aligned direction. | Occupancy elimination, silhouette consistency, visible-surface color checks. |
| Diagonal silhouette/color view | Surface appearance from a 45-degree direction. | Additional occupancy elimination and color consistency checks. |
| Cross-section slice | Interior slice through the volume. | Direct occupancy/material constraints on a plane. |

## Color and material consistency

Silhouette consistency answers "can this voxel exist?" but not whether the object has coherent color. Multi-view reconstruction work distinguishes silhouette constraints from photo/color consistency constraints; an accurate reconstruction from color images must satisfy both types of evidence [S2]. A recent survey describes voxel-based methods as using color consistency to estimate both space occupancy and color in a voxel grid [S4].

| Validation target | Suggested first-pass rule |
| --- | --- |
| Occupancy | A voxel may exist only if every required silhouette view allows it. |
| Surface color | Visible surface colors projected into multiple views should agree within a configured palette/tolerance. |
| Interior color/material | Cross-section panels may assign interior material; ordinary exterior views should not silently define hidden interior color. |
| Coherent swirl pattern | Neighboring visible voxels should form continuous or intentionally banded color paths under the selected projection rules. |

Color consistency must be reported separately from occupancy validity. A voxel object can be watertight and connected while still failing coherent colors/materials.

## Voxel sphere with colorful swirl pattern

A voxel sphere is a strong proof case because occupancy is mathematically simple while color can be complex. A first fixture can generate the sphere analytically with radius `r` and center `c`; occupancy is valid when `(x - cx)^2 + (y - cy)^2 + (z - cz)^2 <= r^2`. This tests UI, grid parsing, projection logic, validation, and color/material checks before relying on image-model compliance.

The swirl pattern should be a validation target, not only a prompt aesthetic. A deterministic test pattern can assign hue by azimuth and height:

```text
theta = atan2(y - cy, x - cx)
height = (z - zMin) / (zMax - zMin)
band = theta + turns * height
color = palette[round(wrap01(band / tau) * (palette.length - 1))]
```

For generated images, the validator can compare each visible voxel's projected color across views. If two panels imply different colors for the same visible surface voxel, the output should fail or be marked ambiguous depending on tolerance. This follows the broader multi-view principle that color/photo consistency can refine or test voxel occupancy and surface appearance [S2, S4, S5].

## Reconstruction approaches to consider

| Approach | How it works | Strengths | Limitations |
| --- | --- | --- | --- |
| Strict visual hull | Intersect all silhouette-consistent voxels. | Simple, deterministic, good for fixtures and early UI. | Overfills concavities and can be too coarse with few views [S1, S2]. |
| Scored visual hull | Keep occupancy scores per voxel and classify by thresholds. | Handles optional or noisy views better than hard intersection. | Can admit invalid geometry if thresholds are too forgiving. |
| Constraint-solved occupancy | Treat silhouettes, cross-sections, connectivity, watertightness, symmetry, and colors as constraints. | Matches the need to distinguish invalid and ambiguous outputs. | More implementation complexity than visual hull. |
| Photo/color-consistency refinement | Use multi-view color agreement to remove inconsistent voxels or assign colors. | Supports first-loop material validation. | Generated images may contain stylization inconsistencies requiring palette tolerance [S2, S4, S5]. |
| Learned reconstruction | Train or use a model to predict voxels from views. | Can infer missing geometry from priors. | Premature for saved/uploaded grids; requires data and is less inspectable [S4]. |

## Suggested data contract for experiments

```json
{
  "gridSize": { "x": 32, "y": 32, "z": 32 },
  "views": [
    {
      "id": "front",
      "kind": "orthographic",
      "axis": "y",
      "direction": "positive",
      "panelRect": { "x": 0, "y": 0, "width": 32, "height": 32 },
      "channels": ["silhouette", "color"]
    },
    {
      "id": "diag-z-45",
      "kind": "diagonal",
      "axis": "z",
      "projection": "x_plus_y",
      "panelRect": { "x": 32, "y": 0, "width": 63, "height": 32 },
      "channels": ["silhouette", "color"]
    },
    {
      "id": "slice-mid",
      "kind": "cross-section",
      "plane": "x+y=31",
      "panelRect": { "x": 0, "y": 32, "width": 32, "height": 32 },
      "channels": ["occupancy", "material"]
    }
  ],
  "validation": {
    "requiredViews": ["front", "side", "top"],
    "optionalViews": ["diag-z-45"],
    "requireConnected": true,
    "requireWatertight": true,
    "colorTolerance": "palette-index-or-delta-e"
  }
}
```

## Implementation notes

Start with fixture images and an analytic voxel sphere before generated images. The visual-hull algorithm is easiest to debug when each view panel can be regenerated from the known volume and compared to parser output. For the interactive UI, the minimum useful review panel should show: uploaded/source grid, parsed view panels, reconstructed voxel preview, occupancy status, connectivity/watertight status, color/material status, and per-view mismatch overlays.

## Sources

| Key | Title | URL | Accessed | Type | Reliability |
|---|---|---|---|---|---|
| S1 | Visual Hull Construction, Alignment and Refinement Across Time | https://www.ri.cmu.edu/publications/visual-hull-construction-alignment-and-refinement-across-time/ | 2026-05-02 | publication | high |
| S2 | Multi-View Reconstruction using Photo-consistency and Exact Silhouette Constraints: A Maximum-Flow Formulation | https://docslib.org/doc/5669530/multi-view-reconstruction-using-photo-consistency-and-exact-silhouette-constraints-a-maximum-flow-formulation | 2026-05-02 | publication | medium |
| S3 | Shape-from-Silhouettes | https://github.com/KKeishiro/Shape-from-Silhouettes | 2026-05-02 | github | medium |
| S4 | Multi-view 3D reconstruction based on deep learning: A survey and comparison of methods | https://www.sciencedirect.com/science/article/abs/pii/S0925231224003242 | 2026-05-02 | publication | high |
| S5 | Multi-hypothesis, volumetric reconstruction of 3-D objects from multiple calibrated camera views | https://portal.fis.tum.de/en/publications/multi-hypothesis-volumetric-reconstruction-of-3-d-objects-from-mu | 2026-05-02 | publication | medium |

## Research Notes

- Methodology: searched for "voxel reconstruction from silhouettes visual hull orthographic projections", "shape from silhouette visual hull voxel carving orthographic views", and "multi view voxel reconstruction silhouettes diagonal views color consistency"; opened publication pages, a full-text paper mirror, a survey page, and an implementation repository.
- Gaps: sources are about calibrated-camera reconstruction, not image-model-generated pixel grids. The adaptation to template grids and diagonal/cross-section panels is an architectural inference from the cited projection and consistency methods.
- Conflicts: no direct conflict found. The main distinction is that silhouette methods provide a maximal silhouette-consistent shape, while photo/color consistency can refine or validate appearance but may introduce sensitivity to noisy generated colors.
- Follow-up: research browser-based voxel rendering libraries, grid parsing formats, and watertight/connectivity validation algorithms before implementation.
