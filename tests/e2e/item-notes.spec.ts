import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { MENU_VERSION } from "../helpers/catalog";
import { API_VERSION, type ParseRequest, type ParseResponse } from "../../src/contracts/index";

async function openDemo(page: Page) {
  await page.goto("/");
  await page.getByTestId("dining-location").selectOption("demo");
  await page.getByRole("checkbox", { name: "Read replies aloud" }).uncheck();
}
const disclosure = "Special requests need counter confirmation. Availability and any extra charge are not confirmed.";

test("manual special request stays visible through review and receipt at 390px without a price change or parser request", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/api/interpret", route => { requests.push(route.request().url()); return route.abort(); });
  await page.setViewportSize({ width: 390, height: 844 });
  await openDemo(page);
  await page.getByTestId("menu-water").click();
  await expect(page.getByTestId("total")).toHaveText("$1.50");
  await page.getByRole("button", { name: "Add note for Water", exact: true }).click();
  await expect(page.getByTestId("item-note-input")).toBeFocused();
  await expect(page.getByTestId("review")).toBeDisabled(); // Opening alone holds input.
  await page.getByTestId("item-note-input").fill("extra ice");
  await page.getByTestId("save-item-note").click();
  await expect(page.getByTestId("cart").getByTestId("item-note")).toHaveText("Special request: extra ice");
  await expect(page.getByTestId("total")).toHaveText("$1.50");
  await expect(page.getByText(disclosure, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByTestId("review").click();
  await expect(page.getByTestId("review").getByTestId("item-note")).toHaveText("Special request: extra ice");
  await expect(page.getByTestId("review-total")).toHaveText("$1.50");
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("ticket").getByTestId("item-note")).toHaveText("Special request: extra ice");
  await expect(page.getByTestId("ticket")).toContainText("$1.50");
  await expect(page.getByTestId("ticket")).toContainText(disclosure);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(requests).toEqual([]);
});

test("fixture typed interpretation of 'water with extra ice' adds a labelled request, not a priced modifier", async ({ page }) => {
  const requests: ParseRequest[] = [];
  await page.route("**/api/interpret", async route => {
    const req = route.request().postDataJSON() as ParseRequest;
    requests.push(req);
    const response: ParseResponse = {
      v: API_VERSION, menuVersion: MENU_VERSION, requestId: req.requestId, baseRevision: req.baseRevision,
      parser: "fixture", fallbackReason: null,
      result: { kind: "proposal", ops: [{ type: "ADD", itemId: "water", qty: 1, modifiers: [], note: "extra ice" }] },
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response) });
  });
  await openDemo(page);
  await page.getByTestId("text-input").fill("water with extra ice");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("cart").getByTestId("item-note")).toHaveText("Special request: extra ice");
  await expect(page.getByTestId("badge-parser")).toContainText("fixture");
  await expect(page.getByTestId("total")).toHaveText("$1.50");
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ text: "water with extra ice", source: "text", asrConfidence: null, locationId: "demo" });
  await page.getByTestId("review").click();
  await expect(page.getByTestId("review")).toContainText("Special request: extra ice");
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("ticket")).toContainText("Special request: extra ice");
  await expect(page.getByTestId("ticket")).toContainText("$1.50");
});
