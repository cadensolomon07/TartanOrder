import { test, expect } from "@playwright/test";

test("published campus prices survive an offline typed journey, review and simulated receipt", async ({ page, context }) => {
  const requests: string[] = [];
  page.on("request", request => { if(request.url().includes("/api/interpret")) requests.push(request.url()); });
  await page.goto("/");
  await expect(page.getByTestId("dining-location")).toHaveValue("188");
  await expect(page.getByTestId("price-source")).toContainText("CMU’s published menu");
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
  await page.getByTestId("dining-location").selectOption("190");
  await expect(page.getByTestId("confirm")).toHaveCount(0);
  await page.getByTestId("menu-cmu_190_vanilla_milkshake").click();
  await expect(page.getByTestId("total")).toHaveText("$16.75");
  await expect(page.getByTestId("cart")).toContainText("Stack'd Underground");
  await expect(page.getByTestId("cart")).toContainText("Stack'd Dessert Bar");
  await page.getByTestId("dining-location").selectOption("127");
  await expect(page.getByTestId("price-source")).toContainText("not available");
  await expect(page.getByTestId("menu-cmu_188_smash_d_burger")).toHaveCount(0);
  await expect(page.getByTestId("total")).toHaveText("$16.75");
  await page.getByTestId("review").click();
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("ticket")).toContainText("$16.75");
});

test("a campus HTTP 503 actually falls back to the selected location's rules", async ({ page }) => {
  await page.goto("/");
  let calls = 0;
  await page.route("**/api/interpret", route => {
    calls++;
    const request = route.request().postDataJSON();
    expect(request.locationId).toBe("188");
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ v: request.v, requestId: request.requestId, error: { code: "PROVIDER_UNAVAILABLE", message: "Unavailable", retryable: true } }) });
  });
  await page.getByTestId("text-input").fill("fresh cut fries");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("total")).toHaveText("$3.45");
  await expect(page.getByTestId("badge-parser")).toContainText("rules");
  expect(calls).toBe(1);
});
