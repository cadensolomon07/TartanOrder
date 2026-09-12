// A's starter gate: real local rules reach a reviewed simulated campus receipt.
// This is typed input and makes no API request; it does not exercise a microphone.
import { test, expect } from "./fixtures";
import { CAMPUS_DISCLOSURE } from "../../src/contracts/index";

test("real local rules reach a reviewed simulated receipt", async ({ page }) => {
  // No interpretation request may leave the page; server-side order saving
  // (/api/sessions) is a separate concern and is allowed to happen.
  const apiHits: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/interpret")) apiHits.push(request.url()); });
  await page.goto("/");
  await expect(page.getByTestId("dining-location")).toHaveValue("188");
  await page.getByTestId("eng-toggle").click();
  await page.getByTestId("local-only").check();
  await page.getByTestId("eng-toggle").click();
  await expect(page.getByTestId("disclosure")).toHaveText(CAMPUS_DISCLOSURE);
  for (const [text, total] of [["one Smash'd Burger", "$9.20"], ["Fresh Cut Fries", "$12.65"], ["Coleslaw", "$16.10"]]) {
    await page.getByTestId("text-input").fill(text);
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("total")).toHaveText(total);
  }
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(3);
  await expect(page.getByTestId("badge-parser")).toContainText("rules");
  await page.getByTestId("review").click();
  await expect(page.getByTestId("review-total")).toHaveText("$16.10");
  await expect(page.getByTestId("review")).toContainText("1× Smash'd Burger");
  await expect(page.getByTestId("review")).toContainText("1× Fresh Cut Fries");
  await expect(page.getByTestId("review")).toContainText("1× Coleslaw");
  await expect(page.getByTestId("ticket")).toHaveCount(0);
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("ticket")).toBeVisible();
  await expect(page.getByTestId("ticket")).toContainText("Simulated");
  await expect(page.getByTestId("ticket")).toContainText("$16.10");
  expect(apiHits).toEqual([]);
});
