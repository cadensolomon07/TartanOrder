// Database-backed journeys against the TartanHacks project. They run only when the
// server reports the Supabase catalog and persistence (npm run test:e2e:live);
// the keyless run skips them. Sessions are deleted by tests/e2e/global-teardown.ts.
import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { ExportLogSchema, HealthResponseSchema } from "../../src/contracts/index";
import { bundledCatalog, BUNDLED_VERSION_ID } from "../../src/catalog/bundled";
import { indexCatalog } from "../../src/catalog/lookup";
import { replayLog } from "../../src/core/engine";

test.describe.configure({ mode: "serial" });

const FRIES = "cmu_188_fresh_cut_fries";
const BURGER = "cmu_188_smash_d_burger";
const sessionIds = new Set<string>();

function captureSessions(page: Page) {
  page.on("request", (request) => {
    if (request.method() !== "POST" || !request.url().endsWith("/api/sessions")) return;
    const body = request.postDataJSON() as { sessionId?: unknown } | null;
    if (body && typeof body.sessionId === "string") sessionIds.add(body.sessionId);
  });
}

async function chooseLocalRules(page: Page) {
  await page.getByTestId("eng-toggle").click();
  await page.getByTestId("local-only").check();
  await page.getByTestId("eng-toggle").click();
}

test.beforeEach(async ({ request }) => {
  const health = HealthResponseSchema.parse(await (await request.get("/api/health")).json());
  test.skip(health.catalog.source !== "supabase" || health.orderPersistence !== "supabase", "server is not in Supabase catalog and persistence mode");
});

test("health and the header badge report the Supabase catalog at the released version", async ({ page, request }) => {
  captureSessions(page);
  const health = HealthResponseSchema.parse(await (await request.get("/api/health")).json());
  expect(health).toMatchObject({ v: 3, menuVersion: BUNDLED_VERSION_ID, catalog: { source: "supabase", versionId: BUNDLED_VERSION_ID }, orderPersistence: "supabase" });
  await page.goto("/");
  await expect(page.getByTestId("catalog-source")).toHaveText(`Menu: Supabase · ${BUNDLED_VERSION_ID}`);
  await expect(page.getByTestId("persistence")).toHaveAttribute("data-state", "saved", { timeout: 15000 });
  await expect(page.getByTestId("persistence")).toHaveText("Saved to server");
});

test("the Stack'd menu renders from the database with published prices in catalog order", async ({ page }) => {
  captureSessions(page);
  const menu = indexCatalog(bundledCatalog());
  const expected = menu.itemsForLocation("188");
  await page.goto("/");
  await expect(page.getByTestId("dining-location")).toHaveValue("188");
  await expect(page.getByTestId(`menu-${BURGER}`)).toContainText("$9.20");
  await expect(page.getByTestId(`menu-${FRIES}`)).toContainText("$3.45");
  const rendered = await page.locator('[data-testid^="menu-cmu_188_"]').evaluateAll(buttons => buttons.map(button => button.getAttribute("data-testid")!.replace(/^menu-/, "")));
  // Buttons are grouped by category (mains, sides, drinks) and keep catalog order inside each group.
  const byCategory = ["mains", "sides", "drinks"].flatMap(category => expected.filter(item => item.category === category).map(item => item.id));
  expect(rendered).toEqual(byCategory);
  expect(rendered).toHaveLength(expected.length);
});

test("a clarified, undone, confirmed order is saved and its server export replays to the same receipt", async ({ page, request }) => {
  captureSessions(page);
  const earlier = new Set(sessionIds);
  await page.goto("/");
  await expect(page.getByTestId("persistence")).toHaveAttribute("data-state", "saved", { timeout: 15000 });
  // The session this page load created, not one captured by an earlier test in this serial file.
  const firstSession = [...sessionIds].find((id) => !earlier.has(id));
  if (!firstSession) throw new Error("The page load did not create a server session.");
  await chooseLocalRules(page);
  await page.getByTestId(`menu-${FRIES}`).click();
  await page.getByTestId(`menu-${FRIES}`).click();
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(2);
  await page.getByTestId("text-input").fill("remove the fries");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("clarify")).toBeVisible();
  await page.getByTestId("clarify").getByRole("button").nth(0).click();
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(1);
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(2);
  await expect(page.getByTestId("total")).toHaveText("$6.90");
  await page.getByTestId("review").click();
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("ticket")).toContainText("$6.90");
  await expect(page.getByTestId("persistence")).toHaveAttribute("data-state", "saved", { timeout: 15000 });

  // The engineering panel can fetch the server copy of this session.
  await page.getByTestId("eng-toggle").click();
  await page.getByTestId("fetch-server-log").click();
  await expect(page.getByTestId("server-log-notice")).toHaveText("Server copy downloaded.", { timeout: 15000 });

  await page.reload();
  await expect(page.getByTestId("persistence")).toHaveAttribute("data-state", "saved", { timeout: 15000 });
  const exported = await request.get(`/api/sessions/${encodeURIComponent(firstSession)}/export`);
  expect(exported.status()).toBe(200);
  const log = ExportLogSchema.parse(await exported.json());
  expect(log.menuVersion).toBe(BUNDLED_VERSION_ID);
  expect(log.sessionId).toBe(firstSession);
  const view = replayLog(JSON.stringify(log), bundledCatalog());
  expect(view.phase).toBe("committed");
  expect(view.receipt?.totalCents).toBe(690);
  expect(view.receipt?.lines.map(line => ({ itemId: line.itemId, qty: line.qty }))).toEqual([{ itemId: FRIES, qty: 1 }, { itemId: FRIES, qty: 1 }]);
  expect(view.audit.some(entry => entry.outcome === "clarify")).toBe(true);
  expect(sessionIds.size).toBeGreaterThanOrEqual(2);
});
