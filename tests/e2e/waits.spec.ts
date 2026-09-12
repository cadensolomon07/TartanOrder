import { test, expect } from "@playwright/test";

const sandwich = "cmu_188_nashville_sandwich_southern_style_fried_chicken";

test("seeded offer swaps atomically through Undo, review and receipt while offline", async ({ page, context }) => {
  await page.goto("/");
  await context.setOffline(true);
  await page.getByTestId(`menu-${sandwich}`).click();
  await expect(page.getByTestId("swap-offer")).toContainText("Simulated wait times");
  await expect(page.getByTestId("swap-price-change")).toContainText("$0.79 more for 1");
  await page.getByTestId("accept-swap").click();
  await expect(page.getByTestId("total")).toHaveText("$9.99");
  await expect(page.getByTestId("cart")).toContainText("The Grill at Scotty's");
  await expect(page.getByTestId("wait-estimate")).toContainText("4 min");
  await expect(page.getByTestId("dining-location")).toHaveValue("109");
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("total")).toHaveText("$9.20");
  await expect(page.getByTestId("wait-estimate")).toContainText("14 min");
  await expect(page.getByTestId("swap-offer")).toHaveCount(0);
  await page.getByTestId("review").click();
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("ticket")).toContainText("$9.20");
  await expect(page.getByTestId("ticket")).toContainText("14 min");
  await expect(page.getByTestId("ticket")).toContainText("Simulated wait times");
});

test("faster item does not claim a faster multi-item cart and typing dismisses", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("menu-cmu_188_fresh_cut_fries").click();
  await page.getByTestId(`menu-${sandwich}`).click();
  await expect(page.getByTestId("swap-cart-change")).toContainText("stays 14 min");
  await page.getByTestId("accept-swap").click();
  await expect(page.getByTestId("total")).toHaveText("$13.44");
  await expect(page.getByTestId("wait-estimate")).toContainText("14 min");
  await page.getByTestId("dining-location").selectOption("188");
  await page.getByTestId(`menu-${sandwich}`).click();
  await expect(page.getByTestId("swap-offer")).toBeVisible();
  await page.getByTestId("text-input").fill("actually");
  await expect(page.getByTestId("swap-offer")).toHaveCount(0);
  await page.getByTestId("text-input").fill("");
  await expect(page.getByTestId("swap-offer")).toHaveCount(0);
});
