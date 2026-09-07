---
name: verify-voxel-grid-workbench
description: Verify the Voxel Grid Workbench browser UI with the existing Playwright suite, an isolated local server, retained traces, and feature maps. Use when reproducing workbench bugs or checking uploads, template downloads, viewer controls, and diagnostics.
---

# Verify Voxel Grid Workbench

Run from the repository root. Read the [feature index](features/README.md), then the maps relevant to the change. The primary product is the browser UI at `/`. It needs no account, backend, or seed service. Each browser test gets a fresh context. Project state lives in the page and resets on reload.

## Launch

This verification workflow was exercised with Node.js 22. The repository declares pnpm 11.5.0; inspect `package.json` before setup. Its normal development command is `pnpm dev`. Verification uses the installed Node tools because the local pnpm wrapper has failed with `unable to open database`. This fallback proves the installed checkout. It does not prove a frozen dependency installation.

Run Doctor before the first launch. Use a new run ID for every attempt so a rerun cannot remove earlier evidence.

```bash
export VOXEL_VERIFY_RUN="$(date -u +%Y%m%dT%H%M%SZ)-$$"
node node_modules/@playwright/test/cli.js test --config .cursor/skills/verify-voxel-grid-workbench/playwright.config.ts
```

The [verification config](playwright.config.ts) imports the root config and reuses `tests/browser`. Playwright starts `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5188 --strictPort` from the repository root. Readiness is an HTTP response from `http://127.0.0.1:5188`. The config refuses an existing server and prevents Vite from switching ports. The tests wait for the workbench heading and, where relevant, `3D ready`.

Playwright closes its browser contexts and owned server when the command finishes. Run Cleanup after successful and failed attempts.

## Doctor

Run these read-only checks from the repository root. They inspect the runtime, installed tools, browser executable, configured test discovery, and listener ownership without starting a browser or server.

```bash
node --version
node -e 'const fs = require("node:fs"); for (const name of ["vite", "@playwright/test"]) console.log(name, require(`${name}/package.json`).version); const executable = require("@playwright/test").chromium.executablePath(); console.log(executable, fs.existsSync(executable) ? "installed" : "missing")'
lsof -nP -iTCP:5188 -sTCP:LISTEN
node node_modules/@playwright/test/cli.js test --config .cursor/skills/verify-voxel-grid-workbench/playwright.config.ts --list --reporter=json | node -e 'let input = ""; process.stdin.on("data", part => input += part); process.stdin.on("end", () => { const server = JSON.parse(input).config.webServer; if (Array.isArray(server) || server.url !== "http://127.0.0.1:5188" || server.reuseExistingServer !== false || !server.command.includes("--strictPort")) throw new Error("Verification server isolation is incorrect"); console.log(server); });'
```

Before launch, `lsof` must show no listener. Its exit code 1 means no matching listener. If the port is occupied, record the PID and command and leave the existing process alone. The last check loads the resolved config and requires one strict server on port `5188` with reuse disabled. Keep the config's single-object `defineConfig` call. Its multi-argument form combines web servers and would also launch the root server on port `5173`. Inspect the retained output directory in `playwright.config.ts` here before driving.

If Node, modules, or Chromium are missing, report that unmet prerequisite. The repository setup is `pnpm install --frozen-lockfile` followed by `pnpm exec playwright install chromium`. Do not call installed-tool verification proof of either setup command.

If a run stalls while its server is active, repeat `lsof` and compare the PID with the run's process tree. A listening port alone does not prove ownership or app identity.

## Drive

Use the existing `tests/browser/app.spec.ts` and its real PNG fixture in `tests/browser/panelPngFixture.ts`. Select a mapped feature with `--grep` on the launch command. For example, append `--grep 'constructs project-owned viewer output'` to exercise image upload, construction, replacement, and fallback.

Use ARIA names and `data-testid` handles listed in the maps. Upload files through the real file inputs. Download templates through their buttons. Check visible content and file effects alongside diagnostic attributes.

For interactive browser or native UI work, use Computer Use. The existing Playwright suite is the automated project test harness. Its synthetic pointer dispatches do not establish that real mouse hit testing, capture, or release works. Reproduce pointer defects through Computer Use and retain that evidence separately.

## Evidence

The config retains traces and screenshots for every test under `test-results/verification/<run>/artifacts/`. The list reporter prints progress. `test-results/verification/<run>/report.json` records test results and attachments in the same run directory. An omitted `VOXEL_VERIFY_RUN` generates a unique ID, but setting it makes the evidence easy to locate.

For each claim, record the command, exit code, selected feature IDs, actions, resulting state, and side effects. A trace records the test actions and snapshots. A final screenshot alone cannot prove a transition. Save downloaded files into the run directory when their bytes are part of the claim. Test-local download paths do not survive browser cleanup unless saved.

Read the JSON results and attachments before claiming success. Distinguish failed, skipped, retried, and untested paths. The template filename test alone does not prove PNG contents or re-upload compatibility. Use the template map's round-trip checks before claiming that contract. The delayed-decode test changes browser decode timing for its race scenario. It does not measure normal decode performance.

Browser verification covers the local development build. Run the repository's lint, type checks, unit suite, and production build separately when the change needs those checks. A passing browser suite does not establish those results.

## Cleanup

Let the Playwright command finish, or interrupt the owned command and wait for its teardown. Do not kill processes by name. If a listener remains, inspect its PID, command, parent process, and working directory before stopping only a process proven to belong to this run.

```bash
lsof -nP -iTCP:5188 -sTCP:LISTEN
test -f "test-results/verification/$VOXEL_VERIFY_RUN/report.json"
rg --files "test-results/verification/$VOXEL_VERIFY_RUN"
```

Confirm no listener remains on port `5188` and the report, traces, and screenshots still exist. Do not delete the run directory during cleanup. Close only Computer Use tabs created for this verification after retaining their evidence.

## Helpers

This skill ships one Playwright configuration and no executable helper scripts. The launch command above runs it. Keep the maps aligned with the app through `/maintain-verification-skill` when behavior changes.
