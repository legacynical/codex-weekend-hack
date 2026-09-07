import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

import baseConfig from "../../../playwright.config";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const runId = process.env.VOXEL_VERIFY_RUN ?? randomUUID();

if (!/^[a-zA-Z0-9_-]+$/.test(runId)) {
  throw new Error("VOXEL_VERIFY_RUN must contain only letters, digits, underscores, or hyphens");
}

const evidenceDirectory = `${repositoryRoot}test-results/verification/${runId}`;
const baseURL = "http://127.0.0.1:5188";

export default defineConfig({
  ...baseConfig,
  testDir: `${repositoryRoot}tests/browser`,
  outputDir: `${evidenceDirectory}/artifacts`,
  preserveOutput: "always",
  reporter: [["list"], ["json", { outputFile: `${evidenceDirectory}/report.json` }]],
  use: {
    ...baseConfig.use,
    baseURL,
    trace: "on",
    screenshot: "on",
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5188 --strictPort",
    cwd: repositoryRoot,
    url: baseURL,
    reuseExistingServer: false,
  },
});
