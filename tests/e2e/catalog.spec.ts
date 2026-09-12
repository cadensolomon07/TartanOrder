// The served catalog is labelled honestly: /api/health, the header badge and the
// location selector agree on source, version and shortlist order in either mode.
import { test, expect } from "./fixtures";
import { HealthResponseSchema } from "../../src/contracts/index";
import { BUNDLED_VERSION_ID } from "../../src/catalog/bundled";

// The three requested venues with no complete prices (113, 179, 108) are no longer selectable.
const SHORTLIST = ["110", "92", "174", "82", "188", "114", "155", "109"];
// The fictional Demo Counter is public for the meal demo and listed after the ranked shortlist.
const PUBLIC = [...SHORTLIST, "demo"];

test("health, header badges and the selector agree on catalog source, version and shortlist order", async ({ page, request }) => {
  const health = HealthResponseSchema.parse(await (await request.get("/api/health")).json());
  expect(health.v).toBe(3);
  expect(health.catalog.versionId).toBe(BUNDLED_VERSION_ID);
  expect(health.menuVersion).toBe(BUNDLED_VERSION_ID);
  await page.goto("/");
  const source = page.getByTestId("catalog-source");
  if (health.catalog.source === "bundled") {
    await expect(source).toHaveText(`Menu: bundled fallback · ${BUNDLED_VERSION_ID}`);
  } else {
    expect(health.catalog.source).toBe("supabase");
    await expect(source).toHaveText(`Menu: Supabase · ${BUNDLED_VERSION_ID}`);
  }
  const persistence = page.getByTestId("persistence");
  if (health.orderPersistence === "off") {
    await expect(persistence).toHaveAttribute("data-state", "off");
    await expect(persistence).toHaveText("Server saving off");
  } else {
    await expect(persistence).toHaveAttribute("data-state", "saved", { timeout: 15000 });
  }
  const selector = page.getByTestId("dining-location");
  await expect(selector).toHaveValue("188");
  const values = await selector.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
  expect(values).toEqual(PUBLIC);
  await selector.selectOption("110");
  const preview = page.getByTestId("menu-preview-110-0");
  await expect(preview).toBeVisible();
  await expect(preview).toBeDisabled();
  await selector.selectOption("188");
  await expect(page.getByTestId("inference-note")).toContainText("inferred from the published names and descriptions");
  await expect(page.getByTestId("menu-cmu_188_smash_d_burger").getByTestId("dietary-mark").first()).toBeVisible();
});

test("keyless CI mode serves the bundled catalog with server saving off", async ({ request }) => {
  const health = HealthResponseSchema.parse(await (await request.get("/api/health")).json());
  test.skip(health.catalog.source !== "bundled", "the server is not in bundled mode");
  expect(health.orderPersistence).toBe("off");
});
