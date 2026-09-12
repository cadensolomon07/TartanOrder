// Shared Playwright test object. In Supabase persistence mode every page load
// creates a server session; an automatic fixture records each session id the
// page posts so global-teardown.ts can delete exactly those rows afterwards.
import { test as base, expect } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const SESSION_LOG = "test-results/e2e-sessions.txt";

export const test = base.extend<{ trackSessions: void }>({
  trackSessions: [async ({ page }, use) => {
    mkdirSync(dirname(SESSION_LOG), { recursive: true });
    page.on("request", (request) => {
      if (request.method() !== "POST" || !request.url().endsWith("/api/sessions")) return;
      const body = request.postDataJSON() as { sessionId?: unknown } | null;
      if (body && typeof body.sessionId === "string") appendFileSync(SESSION_LOG, `${body.sessionId}\n`);
    });
    await use();
  }, { auto: true }],
});

export { expect };
