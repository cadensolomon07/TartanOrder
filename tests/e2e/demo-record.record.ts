// Produces (1) a ~90s video of the scripted demo, visibly labeled as a
// recording, and (2) screenshots of every screen state. Typed input only;
// no microphone, no model. The banner is injected only for this recording.
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const SHOTS = "public/demo/shots";
const LABEL = process.env.RECORDING_LABEL ?? "RECORDED DEMO — not live · typed input · local rules parser";

// Injected AFTER hydration (React would discard a pre-hydration node).
async function banner(page: Page) {
  await page.evaluate((text: string) => {
    if (document.querySelector("[data-recording-banner]")) return;
    const b = document.createElement("div");
    b.textContent = text;
    b.setAttribute("data-recording-banner", "1");
    Object.assign(b.style, {
      position: "absolute", top: "0", left: "0", right: "0", zIndex: "99999", textAlign: "center",
      background: "#221c18", color: "#fff", font: "600 15px system-ui, sans-serif", padding: "6px 0",
    });
    document.body.appendChild(b);
    document.body.style.paddingTop = `${b.offsetHeight}px`;
  }, LABEL);
}

const beat = (page: Page, ms = 1800) => page.waitForTimeout(ms);

async function say(page: Page, text: string) {
  const input = page.getByTestId("text-input");
  await input.click();
  await input.pressSequentially(text, { delay: 45 });
  await beat(page, 500);
  await page.getByTestId("submit").click();
}

test("recorded demo + screenshots", async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  await page.goto("/");
  await page.getByTestId("dining-location").selectOption("demo");
  await expect(page.getByTestId("disclosure")).toBeVisible();
  await page.getByTestId("eng-toggle").click();
  await page.getByTestId("local-only").check();
  await page.getByTestId("eng-toggle").click();
  await banner(page);
  await page.screenshot({ path: `${SHOTS}/01-empty-1280.png` });
  await beat(page);

  await say(page, "a burger, fries and lemonade");
  await expect(page.getByTestId("total")).toHaveText("$13.50");
  await page.screenshot({ path: `${SHOTS}/02-three-items-1280.png` });
  await beat(page);

  await say(page, "make the burger a double");
  await expect(page.getByTestId("total")).toHaveText("$16.00");
  await page.screenshot({ path: `${SHOTS}/03-double-1280.png` });
  await beat(page);

  await say(page, "add a burger");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(4);
  await beat(page);

  await say(page, "remove the burger");
  await expect(page.getByTestId("clarify")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/04-clarify-1280.png` });
  await beat(page, 2500);

  await page.getByTestId("clarify").getByRole("button").nth(1).click();
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(3);
  await beat(page);
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(4);
  await page.screenshot({ path: `${SHOTS}/05-after-undo-1280.png` });
  await beat(page);

  await say(page, "18,000 lemonades");
  await expect(page.getByTestId("notice")).toBeVisible();
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(4);
  await page.screenshot({ path: `${SHOTS}/06-rejected-quantity-1280.png` });
  await beat(page, 2500);

  await page.getByTestId("review").click();
  await expect(page.getByTestId("confirm")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/07-review-1280.png` });
  await beat(page, 3000);

  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("ticket")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/08-ticket-1280.png` });
  await beat(page, 2500);

  await page.getByTestId("eng-toggle").click();
  await page.getByTestId("eng-body").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/09-engineering-1280.png`, fullPage: true });
  await beat(page, 3000);

  await page.getByTestId("reset").click();
  await expect(page.getByTestId("cart-empty")).toBeVisible();
  await beat(page, 1000);

  // Narrow layout shots (no video pacing needed).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByTestId("dining-location").selectOption("demo");
  await expect(page.getByTestId("disclosure")).toBeVisible();
  await page.getByTestId("eng-toggle").click();
  await page.getByTestId("local-only").check();
  await page.getByTestId("eng-toggle").click();
  await banner(page);
  await page.screenshot({ path: `${SHOTS}/10-empty-390.png`, fullPage: true });
  await say(page, "a burger, fries and lemonade");
  await expect(page.getByTestId("total")).toHaveText("$13.50");
  await page.screenshot({ path: `${SHOTS}/11-three-items-390.png`, fullPage: true });
  await page.getByTestId("review").click();
  await page.screenshot({ path: `${SHOTS}/12-review-390.png`, fullPage: true });
});
