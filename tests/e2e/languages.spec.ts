import { test, expect } from "./fixtures";
import { MENU_VERSION } from "../helpers/catalog";
import { API_VERSION, type ParseRequest } from "../../src/contracts";

for (const [language, text, note, confirm, receipt] of [
  ["es-ES", "Un agua con hielo extra", "hielo extra", "Confirmar pedido simulado", "Recibo simulado"],
  ["zh-CN", "请给我一杯加冰的水", "多加冰", "确认模拟订单", "模拟收据"],
]) test(`${language}: fixture interpretation, review, receipt and mobile layout`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/interpret", async route => {
    const req = route.request().postDataJSON() as ParseRequest;
    expect(req.language).toBe(language);
    await route.fulfill({ json: { v: API_VERSION, menuVersion: MENU_VERSION, requestId: req.requestId, baseRevision: req.baseRevision, parser: "fixture", fallbackReason: null, result: { kind: "proposal", ops: [{ type: "ADD", itemId: "water", qty: 1, modifiers: [], note }] } } });
  });
  await page.goto("/");
  await page.getByTestId("dining-location").selectOption("demo");
  await page.getByTestId("language-select").selectOption(language);
  await page.getByTestId("text-input").fill(text);
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("cart")).toContainText(note);
  await expect(page.getByTestId("total")).toHaveText("$1.50");
  await expect(page.getByTestId("badge-parser")).toContainText("fixture");
  await page.getByTestId("review").click();
  await expect(page.getByTestId("confirm")).toContainText(confirm);
  await expect(page.getByTestId("review-total")).toHaveText("$1.50");
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("ticket")).toContainText(receipt);
  await expect(page.getByTestId("ticket")).toContainText(note);
  await expect(page.getByTestId("ticket")).toContainText("$1.50");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
