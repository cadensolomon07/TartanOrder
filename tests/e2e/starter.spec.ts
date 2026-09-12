// A's bootstrap gate, kept as-is in intent: real local rules reach a reviewed
// simulated receipt through the finished kiosk (typed input, no voice).
import { test, expect } from "@playwright/test";
test("real local rules reach a reviewed simulated receipt", async ({ page }) => {
  // Select Local only explicitly: the journey must complete with no API traffic.
  const apiHits: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/")) apiHits.push(r.url()); });
  await page.goto("/");
  await page.getByTestId("eng-toggle").click();
  await page.getByTestId("local-only").check();
  await page.getByTestId("eng-toggle").click();
  await expect(page.getByTestId("disclosure")).toHaveText("TartanOrder Demo Counter · Seeded menu · No real purchase.");
  await page.getByTestId("text-input").fill("a burger, fries and lemonade");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("total")).toHaveText("$13.50");
  await expect(page.getByTestId("badge-parser")).toContainText("rules");
  await page.getByTestId("review").click();
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("ticket")).toBeVisible();
  await expect(page.getByTestId("ticket")).toContainText("Simulated");
  expect(apiHits).toEqual([]);
});
