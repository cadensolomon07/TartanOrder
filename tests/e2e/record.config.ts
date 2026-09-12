// Playwright config for the labeled demo recording + screenshot set.
// Run: PLAYWRIGHT_BASE_URL=<url> npx playwright test --config tests/e2e/record.config.ts
// Output: test-results/demo-recording/**/video.webm and public/demo/shots/*.png
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: process.env.RECORDING_PARSER === "gemini" ? "gemini-demo.record.ts" : "demo-record.record.ts",
  timeout: 240_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "../../test-results/demo-recording", // never under public/: not served, not committed
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    viewport: { width: 1280, height: 800 },
    video: { mode: "on", size: { width: 1280, height: 800 } },
  },
});
