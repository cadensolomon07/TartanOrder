// Explicitly opt-in recording against a real configured server. No HTTP mocks,
// fake recognizer, automatic retry, or provider fallback is accepted as success.
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ParseRequestSchema, ParseResponseSchema, type ParseResponse } from "../../src/contracts";

test.skip(
  process.env.GEMINI_LIVE !== "1" || process.env.RECORDING_PARSER !== "gemini" || !process.env.PLAYWRIGHT_BASE_URL,
  "Requires GEMINI_LIVE=1, RECORDING_PARSER=gemini and an explicit PLAYWRIGHT_BASE_URL; real provider usage.",
);

const OUTPUT = resolve("test-results/demo-recording");
const LONG_ORDER = "Hi I would like to order a burger and um also some fries and a lemonade too, actually wait can you make it a double burger with no lettuce.";

async function stage(page: Page, title: string) {
  await page.evaluate((value) => {
    let element = document.querySelector<HTMLDivElement>("[data-recording-banner]");
    if (!element) {
      element = document.createElement("div");
      element.dataset.recordingBanner = "true";
      Object.assign(element.style, {
        position: "fixed", inset: "0 0 auto", zIndex: "99999", padding: "9px 14px",
        color: "white", background: "#221c18", textAlign: "center", font: "600 14px system-ui",
      });
      document.body.appendChild(element);
      document.body.style.paddingTop = "58px";
    }
    element.textContent = `RECORDED DEMO — not live · typed input · no microphone | ${value}`;
  }, title);
  await page.getByTestId("disclosure").scrollIntoViewIfNeeded();
}

test("record actual typed Gemini understanding, reversible edits and explicit confirmation", async ({ page }, testInfo) => {
  const recordingStarted = Date.now();
  const evidence: { text: string; httpStatus: number; response: ParseResponse }[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  let requests = 0;
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/interpret") requests += 1; });
  const video = page.video();
  expect(video, "Run using record.config.ts so the video is retained").not.toBeNull();

  async function say(text: string, label: string) {
    await stage(page, label);
    const input = page.getByTestId("text-input");
    await input.fill("");
    await input.pressSequentially(text, { delay: 38 });
    const responsePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/interpret" && response.request().method() === "POST",
    );
    await page.getByTestId("submit").click();
    const http = await responsePromise;
    expect(http.status()).toBe(200);
    const request = ParseRequestSchema.parse(http.request().postDataJSON());
    const response = ParseResponseSchema.parse(await http.json());
    expect(response.requestId).toBe(request.requestId);
    expect(response.baseRevision).toBe(request.baseRevision);
    expect(response.menuVersion).toBe(request.menuVersion);
    expect(response.parser, "A rules fallback cannot pass this Gemini recording").toBe("gemini");
    expect(response.fallbackReason).toBeNull();
    evidence.push({ text, httpStatus: http.status(), response });
    await expect(page.getByTestId("badge-parser")).toContainText("gemini");
    await expect(page.getByTestId("badge-busy")).toHaveCount(0);
    await expect(page.getByTestId("assistant-response")).not.toHaveText("");
    await stage(page, `${label} · real Gemini response received`);
    // Deliberate presentation pacing; assertions, never the pause, await state.
    await page.waitForTimeout(4000);
  }

  await page.goto("/");
  await page.getByTestId("dining-location").selectOption("demo");
  await expect(page.getByTestId("disclosure")).toBeVisible();
  await page.getByTestId("eng-toggle").click();
  await expect(page.getByTestId("local-only")).not.toBeChecked();
  await page.getByTestId("eng-toggle").click();
  // Playwright video is silent. Keep visual replies, without implying audio capture.
  const readReplies = page.getByLabel("Read replies aloud");
  if (await readReplies.count()) await readReplies.uncheck();
  await stage(page, "A demonstration menu. Prices and tickets belong to the application.");
  await page.waitForTimeout(5000);

  await say(LONG_ORDER, "Natural language, filler words and a correction in one request");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(3);
  await expect(page.getByTestId("total")).toHaveText("$16.00");
  const burger = page.getByTestId("cart").locator("li").filter({ hasText: "Burger" });
  await expect(burger).toHaveCount(1);
  await expect(burger.locator('[aria-label="quantity 1"]')).toBeVisible();
  await expect(burger.getByRole("button", { name: "Double", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(burger.getByRole("button", { name: "No lettuce", exact: true })).toHaveAttribute("aria-pressed", "true");

  await say("Actually make that two lemonades and put the lettuce back on the burger", "The next turn understands the current cart");
  await expect(page.getByTestId("total")).toHaveText("$18.50");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(3);
  await expect(burger.getByRole("button", { name: "No lettuce", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(burger.getByRole("button", { name: "Double", exact: true })).toHaveAttribute("aria-pressed", "true");
  await stage(page, "Undo restores the previous accepted batch");
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("total")).toHaveText("$16.00");
  await expect(burger.getByRole("button", { name: "No lettuce", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(5000);

  await page.getByTestId("reset").click();
  await expect(page.getByTestId("cart-empty")).toBeVisible();
  await say("Can I get a pizza, a burger, and a lemonade?", "Supported items are added; unavailable pizza is explained");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(2);
  await expect(page.getByTestId("total")).toHaveText("$10.50");
  await expect(page.getByTestId("assistant-response")).toContainText(/pizza/i);
  await expect(page.getByTestId("cart")).not.toContainText(/pizza/i);

  await page.getByTestId("menu-burger").click();
  await expect(page.getByTestId("total")).toHaveText("$18.50");
  await say("Remove the burger", "Two burgers: a targeted question instead of a guess");
  await expect(page.getByTestId("clarify")).toBeVisible();
  await expect(page.getByTestId("total")).toHaveText("$18.50");
  const secondBurgerId = await page.getByTestId("cart").locator("li").filter({ hasText: "Burger (line 2)" }).getAttribute("data-line-id");
  expect(secondBurgerId).toBeTruthy();
  await say("The second burger, please", "The answer resolves the pending choice");
  await expect(page.getByTestId("clarify")).toHaveCount(0);
  await expect(page.getByTestId("total")).toHaveText("$10.50");
  await expect(page.getByTestId(`line-${secondBurgerId}`)).toHaveCount(0);

  await stage(page, "Review is an immutable snapshot; nothing has been confirmed yet");
  await page.getByTestId("review").click();
  await expect(page.getByTestId("review-total")).toHaveText("$10.50");
  await expect(page.getByTestId("ticket")).toHaveCount(0);
  await page.waitForTimeout(7000);
  await stage(page, "An explicit click creates one simulated ticket — no real purchase");
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("ticket")).toBeVisible();
  await expect(page.getByTestId("ticket")).toContainText("$10.50");
  await page.waitForTimeout(5000);
  await stage(page, "Gemini proposes intent. The deterministic engine owns validation, totals, undo and confirmation.");
  const remaining = 145_000 - (Date.now() - recordingStarted);
  if (remaining > 0) await page.waitForTimeout(remaining);
  expect(pageErrors).toEqual([]);
  expect(requests).toBe(evidence.length);
  expect(evidence).toHaveLength(5);
  expect(Date.now() - recordingStarted, "Keep the backup demonstration under three minutes").toBeLessThan(180_000);
  mkdirSync(OUTPUT, { recursive: true });
  const report = { baseURL: process.env.PLAYWRIGHT_BASE_URL, typed: true, microphoneTested: false, mocked: false, requests: evidence };
  writeFileSync(resolve(OUTPUT, "tartanorder-gemini-evidence.json"), JSON.stringify(report, null, 2));
  await testInfo.attach("real-gemini-responses", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
  await page.close();
  await video!.saveAs(resolve(OUTPUT, "tartanorder-gemini.webm"));
});
