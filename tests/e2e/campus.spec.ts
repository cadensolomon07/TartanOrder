import { test, expect } from "@playwright/test";
import { API_VERSION, MENU_VERSION } from "../../src/contracts/index";

test("published campus prices survive an offline typed journey, review and simulated receipt", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", request => { if(request.url().includes("/api/interpret")) requests.push(request.url()); });
  await page.goto("/");
  await expect(page.getByTestId("dining-location")).toHaveValue("188");
  await expect(page.getByTestId("price-source")).toContainText("priced choices from CMU-hosted menu snapshots");
  await page.getByTestId("eng-toggle").click();
  await page.getByTestId("local-only").check();
  await page.getByTestId("eng-toggle").click();
  await context.setOffline(true);
  await page.getByTestId("text-input").fill("a smashd burger");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("total")).toHaveText("$9.20");
  await page.getByTestId("text-input").fill("fresh cut fries");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("total")).toHaveText("$12.65");
  await expect(page.getByTestId("cart")).toContainText("Stack'd Underground");
  await page.getByTestId("review").click();
  await expect(page.getByTestId("review-total")).toHaveText("$12.65");
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("ticket")).toContainText("$12.65");
  await expect(page.getByTestId("ticket")).toContainText("Nothing was sent");
  expect(requests).toEqual([]);
});

test("location selection keeps sourced cart items and requires a fresh review", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("menu-cmu_188_smash_d_burger").click();
  await page.getByTestId("review").click();
  await page.getByTestId("dining-location").selectOption("114");
  await expect(page.getByTestId("confirm")).toHaveCount(0);
  await page.getByTestId("menu-cmu_114_samosa-2").click();
  await expect(page.getByTestId("total")).toHaveText("$14.70");
  await expect(page.getByTestId("cart")).toContainText("Stack'd Underground");
  await expect(page.getByTestId("cart")).toContainText("Taste of India");
  await page.getByTestId("dining-location").selectOption("113");
  await expect(page.getByTestId("price-source")).toContainText("No complete priced configurations");
  await expect(page.getByTestId("menu-cmu_188_smash_d_burger")).toHaveCount(0);
  const preview = page.getByRole("group", { name: "Menu preview" });
  await expect(preview.getByRole("button", { name: /The Good Egg/ })).toBeDisabled();
  await expect(preview.getByRole("button", { name: /The Good Egg/ })).toContainText("Price unavailable");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(2);
  await expect(page.getByTestId("total")).toHaveText("$14.70");
  await page.getByTestId("review").click();
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("ticket")).toContainText("$14.70");
});

test("a campus HTTP 503 actually falls back to the selected location's rules", async ({ page }) => {
  await page.goto("/");
  let calls = 0;
  await page.route("**/api/interpret", route => {
    calls++;
    const request = route.request().postDataJSON();
    expect(request.locationId).toBe("188");
    expect(request.v).toBe(API_VERSION);
    expect(request.menuVersion).toBe(MENU_VERSION);
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ v: API_VERSION, requestId: request.requestId, error: { code: "PROVIDER_UNAVAILABLE", message: "Unavailable", retryable: true } }) });
  });
  await page.getByTestId("text-input").fill("fresh cut fries");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("total")).toHaveText("$3.45");
  await expect(page.getByTestId("badge-parser")).toContainText("rules");
  expect(calls).toBe(1);
});


test("the public selector preserves eleven campus locations and a separate fictional meal demo", async ({ page }) => {
  await page.goto("/");
  const selector = page.getByTestId("dining-location");
  await expect(selector).toHaveValue("188");
  await expect(selector.locator("option")).toHaveCount(12);
  const values = await selector.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
  expect([...values].sort()).toEqual(["110", "92", "174", "82", "188", "179", "113", "114", "155", "109", "108", "demo"].sort());
  for (const retired of ["84", "180", "190", "127"]) expect(values).not.toContain(retired);
  await expect(selector).toContainText("Demo Counter");
  await expect(page.getByTestId("menu-burger")).toHaveCount(0);
});
