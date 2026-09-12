import { defineConfig, devices } from "@playwright/test";

// Without Supabase keys in this process (CI, a fresh clone, plain `npm run
// test:e2e`) the app under test runs the labelled bundled catalog with server
// saving off. `npm run test:e2e:live` loads .env.local into the process, so the
// server keeps its own defaults (Supabase catalog and persistence) and the
// specs that need the database run against the TartanHacks project.
// E2E_CATALOG / E2E_PERSISTENCE force either mode explicitly.
const hasKeys = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEYS && process.env.SUPABASE_SECRET_KEYS);
const keyless = Boolean(process.env.CI) || !hasKeys;
const serverEnv: Record<string, string> = {
  ...(process.env.E2E_CATALOG ? { CATALOG_SOURCE: process.env.E2E_CATALOG } : keyless ? { CATALOG_SOURCE: "bundled" } : {}),
  ...(process.env.E2E_PERSISTENCE ? { ORDER_PERSISTENCE: process.env.E2E_PERSISTENCE } : keyless ? { ORDER_PERSISTENCE: "off" } : {}),
};

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false,
    timeout: 60000,
    env: serverEnv,
  },
});
