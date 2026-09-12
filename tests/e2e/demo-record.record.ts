// Produces (1) a scripted campus demo video, visibly labeled as a
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
  await input.fill("");
  await input.click();
  await input.pressSequentially(text, { delay: 45 });
  await beat(page, 500);
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("badge-busy")).toHaveCount(0);
  await expect(page.getByTestId("badge-parser")).toContainText("rules");
}

test("recorded demo + screenshots", async ({ page }) => {
  const parseRequests: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/interpret") parseRequests.push(request.url()); });
  mkdirSync(SHOTS, { recursive: true });
  await page.goto("/");
  await page.getByTestId("dining-location").selectOption("188");
  await expect(page.getByTestId("disclosure")).toBeVisible();
  await page.getByTestId("eng-toggle").click();
  await page.getByTestId("local-only").check();
  await page.getByTestId("eng-toggle").click();
  await banner(page);
  await page.screenshot({ path: `${SHOTS}/01-empty-1280.png` });
  await beat(page);

  // Campus rules accept one exact menu item at a time; no model is involved.
  await say(page, "a smashd burger");
  await expect(page.getByTestId("total")).toHaveText("$9.20");
  await say(page, "fresh cut fries");
  await expect(page.getByTestId("total")).toHaveText("$12.65");
  await say(page, "grilled cheese");
  await expect(page.getByTestId("total")).toHaveText("$20.45");
  await page.screenshot({ path: `${SHOTS}/02-three-items-1280.png` });
  await beat(page);

  await say(page, "make fresh cut fries 2");
  await expect(page.getByTestId("total")).toHaveText("$23.90");
  await page.screenshot({ path: `${SHOTS}/03-quantity-1280.png` });
  await beat(page);

  await say(page, "a smashd burger");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(4);
  await expect(page.getByTestId("total")).toHaveText("$33.10");
  await beat(page);

  await say(page, "remove smashd burger");
  await expect(page.getByTestId("clarify")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/04-clarify-1280.png` });
  await beat(page, 2500);

  await page.getByTestId("clarify").getByRole("button").nth(1).click();
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(3);
  await expect(page.getByTestId("total")).toHaveText("$23.90");
  await beat(page);
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(4);
  await expect(page.getByTestId("total")).toHaveText("$33.10");
  await page.screenshot({ path: `${SHOTS}/05-after-undo-1280.png` });
  await beat(page);

  await say(page, "18000 fresh cut fries");
  await expect(page.getByTestId("notice")).toBeVisible();
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(4);
  await expect(page.getByTestId("total")).toHaveText("$33.10");
  await page.screenshot({ path: `${SHOTS}/06-rejected-quantity-1280.png` });
  await beat(page, 2500);

  await page.getByTestId("review").click();
  await expect(page.getByTestId("confirm")).toBeVisible();
  await expect(page.getByTestId("review-total")).toHaveText("$33.10");
  await page.screenshot({ path: `${SHOTS}/07-review-1280.png` });
  await beat(page, 3000);

  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("ticket")).toBeVisible();
  await expect(page.getByTestId("ticket")).toContainText("$33.10");
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
  await page.getByTestId("dining-location").selectOption("188");
  await expect(page.getByTestId("disclosure")).toBeVisible();
  await page.getByTestId("eng-toggle").click();
  await page.getByTestId("local-only").check();
  await page.getByTestId("eng-toggle").click();
  await banner(page);
  await page.screenshot({ path: `${SHOTS}/10-empty-390.png`, fullPage: true });
  await say(page, "a smashd burger");
  await expect(page.getByTestId("total")).toHaveText("$9.20");
  await say(page, "fresh cut fries");
  await expect(page.getByTestId("total")).toHaveText("$12.65");
  await say(page, "grilled cheese");
  await expect(page.getByTestId("total")).toHaveText("$20.45");
  await page.screenshot({ path: `${SHOTS}/11-three-items-390.png`, fullPage: true });
  await page.getByTestId("review").click();
  await expect(page.getByTestId("review-total")).toHaveText("$20.45");
  await page.screenshot({ path: `${SHOTS}/12-review-390.png`, fullPage: true });
  expect(parseRequests, "The rules recording must never call the interpret API").toEqual([]);
});
