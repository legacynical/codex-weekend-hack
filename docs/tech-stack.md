# Technology Stack & Dependencies

Last verified: 2026-05-02 05:54 PM
Source-of-truth for: approved runtime, frameworks, dependency roles, tooling, infrastructure, and repo conventions

This document records the scaffolded stack and lockfile-backed package versions for the initial browser app.

---

## Stack overview

| Layer | Technology |
| --- | --- |
| App runtime | Browser-first TypeScript app, with Node.js only for local tooling |
| UI framework | React + Vite + TypeScript |
| Styling and components | Tailwind CSS v4 with shadcn/ui copy-in components |
| 3D rendering | Direct Three.js with `InstancedMesh` for voxel previews |
| Voxel engine | Pure TypeScript modules, isolated from React and rendering |
| Grid/image parsing | Browser Canvas/ImageData APIs, validated through typed schemas |
| Data validation | Zod schemas for template metadata, uploaded grids, run records, and validation reports |
| Persistence | Local JSON export/import for reproducible experiment runs |
| State management | React state first; Zustand only when shared experiment state becomes awkward |
| Testing | Vitest for voxel/core logic; Playwright for browser upload/render smoke tests |
| Deployment | Vercel-hosted static web app after local prototype |

---

## A. Runtime

| Technology | Version | Purpose | Docs |
| --- | --- | --- | --- |
| Browser ES modules | modern evergreen browsers | Run the interactive UI, Canvas parsing, and WebGL voxel preview. | [Vite browser target](https://vite.dev/guide/) |
| Node.js | v24.12.0 local toolchain | Local package scripts, Vite dev server, tests, and build tooling. | [Node.js](https://nodejs.org/) |
| TypeScript | 6.0.3 | Shared type system for UI, voxel core, schemas, and tests. | [TypeScript](https://www.typescriptlang.org/) |

*Config*: `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`.

---

## B. Frameworks and platforms

| Framework or platform | Version | Purpose | Docs |
| --- | --- | --- | --- |
| Vite | 8.0.10 | Fast local dev server and static build pipeline for the browser app. | [Vite](https://vite.dev/guide/) |
| React | 19.2.5 | UI shell for upload flow, template controls, validation panels, and app state. | [React TypeScript](https://react.dev/learn/typescript) |
| Tailwind CSS | 4.2.4 | Utility CSS system for dense, inspectable app UI without bespoke stylesheet sprawl. | [Tailwind CSS](https://tailwindcss.com/) |
| shadcn/ui | `shadcn` CLI 4.6.0, radix-nova preset | Copy-in component baseline for controls, panels, dialogs, and form primitives. | [shadcn/ui Vite](https://ui.shadcn.com/docs/installation/vite) |
| Vercel | approved, configure when deployment starts | Static hosting target for the app after the local prototype is useful. | [Vercel](https://vercel.com/docs) |

*Config*: `vite.config.ts`, `components.json`, `src/index.css`, `src/main.tsx`, `src/App.tsx`.

*Important boundary*: React owns UI state and presentation; voxel reconstruction, validation, and projection math should live in framework-independent TypeScript modules.

---

## C. Key dependencies

### UI styling and components

| Package | Version | Purpose | Docs |
| --- | --- | --- | --- |
| `tailwindcss` | 4.2.4 | Generate the app utility CSS layer and design tokens. | [Tailwind CSS](https://tailwindcss.com/docs/installation/using-vite) |
| shadcn/ui components | copy-in via `shadcn` 4.6.0 | Provide editable local React component primitives for buttons, cards, badges, separators, and related UI controls. | [shadcn/ui CLI](https://ui.shadcn.com/docs/cli) |

*Config*: `components.json`, `src/index.css`, `src/components/ui/`, `src/lib/utils.ts`.

*Status*: Installed and initialized with the `radix-nova` shadcn preset.

*Important boundary*: shadcn/ui components are copied into the repo and become local source; do not treat them as a black-box runtime component library.

### Rendering and preview

| Package | Version | Purpose | Docs |
| --- | --- | --- | --- |
| `three` | 0.184.0 | Render voxel candidates, parsed view aids, and benchmark previews through direct Three.js scene ownership. | [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) |

*Config*: `src/rendering/`.

*Status*: Installed, not yet wired into the starter shell. React Three Fiber is intentionally deferred because v0 needs a small imperative voxel preview more than a React-composed 3D scene.

*Important boundary*: Use Three.js as a rendering adapter over validated voxel data, not as the source of truth for occupancy or color/material state.

### Voxel core

| Package | Version | Purpose | Docs |
| --- | --- | --- | --- |
| Internal TypeScript modules | workspace code | Grid parsing, deterministic projections, visual-hull style occupancy, connected/watertight checks, color/material validation, and benchmark generation. | [Research](./research/multi-view-voxel-reconstruction.md) |

*Config*: `src/core/`, `src/validation/`, `src/benchmarks/`.

*Status*: Approved module layout.

*Important boundary*: Core modules should not import React or Three.js. They should accept and return plain typed data so tests can exercise them without a browser renderer.

### Data contracts and parsing

| Package | Version | Purpose | Docs |
| --- | --- | --- | --- |
| `zod` | 4.4.2 | Runtime validation for template manifests, panel metadata, uploaded grid records, voxel run records, and validation reports. | [Zod](https://zod.dev/) |
| Browser Canvas/ImageData | n/a | Read uploaded image pixels and split a grid into configured panels. | [Canvas API](https://developer.mozilla.org/docs/Web/API/Canvas_API) |

*Config*: `src/schemas/`, `src/parsing/`.

*Important boundary*: Uploaded image content is untrusted input. Parse with Canvas/ImageData, validate metadata with schemas, and report template mismatches before reconstruction.

### Persistence

| Package | Version | Purpose | Docs |
| --- | --- | --- | --- |
| Local JSON export/import | n/a | Save and reload experiment runs without accounts, databases, or cloud sync. | n/a |

*Config*: `src/persistence/`, `src/schemas/`.

*Status*: Approved for v0.

*Important boundary*: JSON persistence stores the experiment contract: schema version, run metadata, template id/config, source image reference/name, parsed panel metadata, voxel data, color/material assignments, and validation report. It should not require backend storage. Embedding image bytes as base64 is deferred unless separate image files become too cumbersome.

### UI state

| Package | Version | Purpose | Docs |
| --- | --- | --- | --- |
| React built-in state | n/a | Approved state model for the first prototype. | [React managing state](https://react.dev/learn/managing-state) |
| `zustand` | deferred | Possible later shared-state dependency if upload, parsing, rendering, and validation panels become cumbersome with lifted React state. | [Zustand](https://zustand.docs.pmnd.rs/getting-started/introduction) |

*Config*: `src/state/` only if adopted.

*Status*: React state approved for v0; Zustand deferred.

---

## D. Development dependencies

### Build, lint, and formatting

| Package | Version | Purpose | Docs |
| --- | --- | --- | --- |
| `typescript` | 6.0.3 | Type checking. | [TypeScript](https://www.typescriptlang.org/) |
| `eslint` | 10.3.0 | Static analysis for TypeScript and React. | [ESLint](https://eslint.org/) |
| `@tailwindcss/vite` | 4.2.4 | Vite integration for Tailwind CSS v4. | [Tailwind Vite install](https://tailwindcss.com/docs/installation/using-vite) |
| `shadcn` CLI | 4.6.0 | Initialize `components.json` and add copy-in UI components. | [shadcn/ui Vite](https://ui.shadcn.com/docs/installation/vite) |

*Config*: `tsconfig.json`, `eslint.config.js`, `vite.config.ts`, `components.json`.

*Status*: Prettier intentionally excluded for now.

### Browser test tooling

| Package | Version | Purpose | Docs |
| --- | --- | --- | --- |
| `vitest` | 4.1.5 | Fast unit tests for core math, projections, parsing, and validation. | [Vitest](https://vitest.dev/) |
| `@playwright/test` | 1.59.1 | Browser smoke tests for upload flow and nonblank Three.js canvas rendering. | [Playwright](https://playwright.dev/) |

*Config*: `vitest.config.ts`, `playwright.config.ts`, `tests/`.

---

## E. Testing

| Artifact or package | Version / status | Purpose |
| --- | --- | --- |
| Core fixture tests | approved | Test analytic voxel sphere occupancy, projections, diagonal panels, cross-section parsing, connectivity, watertightness, and color coherence. |
| Vitest | 4.1.5 | Run deterministic logic tests without a browser renderer. |
| Playwright | 1.59.1 | Verify upload workflow, UI layout, rendered voxel canvas, and basic interaction. |

*Config*: `src/**/*.test.ts`, `tests/browser/*.spec.ts`.

*Scripts*: approved after scaffold:

```bash
pnpm test        # run unit tests
pnpm test:e2e    # run browser smoke tests
pnpm typecheck   # run TypeScript checks
```

*Further reading*: [Product validation strategy](./product-requirements.md), [multi-view reconstruction research](./research/multi-view-voxel-reconstruction.md).

---

## F. Infrastructure and external services

| Service | Purpose | Notes |
| --- | --- | --- |
| External image generation APIs | deferred | The first prototype should work from saved/uploaded images and copy-paste prompts. |
| Vercel | deployment target | Host the static app once the local UI is useful. |

---

## G. Package management

**`pnpm` approved** - [Docs](https://pnpm.io/)

- *Config*: `package.json`, `pnpm-lock.yaml`, `node_modules/`.
- *Patches*: none yet.
- *Why*: good monorepo path if the voxel core later splits from the UI, strict dependency layout, and fast installs.

### Overrides or resolutions

No overrides, resolutions, or patches exist in the manifest.

---

## H. Scripts

Approved canonical scripts after scaffold:

```bash
pnpm dev         # start Vite dev server
pnpm build       # typecheck and build static app
pnpm preview     # preview built static app locally
pnpm test        # run Vitest unit tests
pnpm test:e2e    # run Playwright browser smoke tests
pnpm lint        # run ESLint
pnpm typecheck   # run TypeScript checks
```

---

## I. Dependency lifecycle

Approved commands after adopting pnpm:

```bash
pnpm add <pkg>                 # production dependency
pnpm add -D <pkg>              # development dependency
pnpm dlx shadcn@latest init    # initialize shadcn/ui after Vite scaffold
pnpm dlx shadcn@latest add <component> # copy a shadcn/ui component into source
pnpm update <pkg>              # update one package
pnpm remove <pkg>              # remove dependency
pnpm audit                     # dependency audit
pnpm outdated                  # check available updates
```

---

## J. Versioning strategy

- **Pinning**: exact versions are optional at the prototype stage; lockfile should be authoritative once created.
- **Ranges**: use normal package-manager ranges for app dependencies unless reproducibility problems appear.
- **Overrides / resolutions**: allow only for security, compatibility, or blocked upstream fixes; document each override here.
- **Patches**: avoid local dependency patches unless a prototype-blocking issue cannot be solved another way.

---

## K. Major version upgrades

Before upgrading core stack pieces, review upstream guidance:

1. [Vite guide](https://vite.dev/guide/)
2. [React docs](https://react.dev/)
3. [Three.js docs](https://threejs.org/docs/)
4. [Vitest docs](https://vitest.dev/)
5. [Playwright docs](https://playwright.dev/)
6. [Zod docs](https://zod.dev/)
7. [Tailwind CSS docs](https://tailwindcss.com/docs)
8. [shadcn/ui docs](https://ui.shadcn.com/docs)

---

## L. Current constraints

- Manifest and lockfile exist; dependency versions are now lockfile-backed.
- The first app should work without external image generation API credentials.
- The browser app must handle saved/uploaded image grids.
- The first app should support local JSON export/import for experiment reproducibility.
- Voxel reconstruction and validation should remain deterministic and testable outside the renderer.
- Color/material validation is part of the first loop, not a later rendering-only concern.
- Prettier is intentionally excluded for now.
- Tailwind CSS v4 and shadcn/ui are installed; shadcn components are local source under `src/components/ui/`.
- Vercel is the preferred hosting target.
- Direct Three.js is approved for v0; React Three Fiber is deferred.

---

## M. Future considerations

| Need | Why | Candidates |
| --- | --- | --- |
| Heavy reconstruction off-main-thread | Larger grids may block UI interaction. | Web Workers, Comlink, WASM later if profiling proves it. |
| Persistence beyond JSON files | Users may eventually want saved experiment libraries and benchmark comparisons. | IndexedDB and cloud/database storage are later candidates. |
| React Three Fiber | A React-composed scene model may help if the preview becomes a complex interactive scene. | Deferred unless direct Three.js scene lifecycle becomes costly. |
| Export formats | Validated assets may need game/toolchain output. | JSON voxel volume, MagicaVoxel `.vox`, glTF after validation stabilizes. |
| External generation integration | Deferred API support may become useful after grid templates prove valuable. | OpenAI image API, local model adapters, provider-neutral prompt export. |
| Advanced constraints | Animals and complex props may need stronger priors. | Constraint solver, learned reconstruction, template-specific validators. |

---

## N. References

- [Product requirements](./product-requirements.md)
- [Multi-view voxel reconstruction from 2D image grids](./research/multi-view-voxel-reconstruction.md)
- [Vite](https://vite.dev/guide/)
- [React TypeScript](https://react.dev/learn/typescript)
- [Tailwind CSS Vite install](https://tailwindcss.com/docs/installation/using-vite)
- [shadcn/ui Vite install](https://ui.shadcn.com/docs/installation/vite)
- [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)
- [Zod](https://zod.dev/)
- [Vitest](https://vitest.dev/)
- [Playwright](https://playwright.dev/)

---

## Task triage

tt2. [iterate] Build the swirl voxel sphere fixture before supporting arbitrary uploaded grids.
tt3. [iterate] Start with strict visual-hull reconstruction, then compare scored/constraint-solved variants.
tt4. [action] Define the JSON export/import schema and Zod validation contract.
tt5. [research] Evaluate browser voxel rendering/export libraries only if raw Three.js becomes too costly to maintain.
tt6. [risk] React rendering and direct Three.js rendering can fight over ownership if scene lifecycle boundaries are not explicit.

---

## Open questions

No open questions.
