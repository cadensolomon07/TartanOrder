// End-to-end flows against the running app (A's real controller, rules parser).
// VOICE EVENTS ARE MOCKED via an injected SpeechRecognition; nothing here
// exercises a real microphone. Run: npx playwright test tests/e2e
import { test, expect, type Page } from "@playwright/test";

const FAKE_SR = `
  class FakeSR {
    constructor(){ window.__sr = this; }
    start(){ this.onstart && this.onstart(); }
    stop(){ this.onend && this.onend(); }
    abort(){ this.onend && this.onend(); }
  }
  window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
  window.__say = (t, c) => { const r = window.__sr; if (!r) return;
    r.onresult && r.onresult({ resultIndex:0, results:[{ isFinal:true, 0:{ transcript:t, confidence:c ?? 0.8 } }] });
    r.onend && r.onend(); };
`;

async function open(page: Page) {
  await page.addInitScript(FAKE_SR);
  await page.goto("/");
  await expect(page.getByText("TartanOrder Demo Counter")).toBeVisible();
}

async function type(page: Page, text: string) {
  await page.getByTestId("text-input").fill(text);
  await page.getByTestId("submit").click();
}

test("three-item text order", async ({ page }) => {
  await open(page);
  await type(page, "a burger, fries and lemonade");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(3);
  await expect(page.getByTestId("total")).toHaveText("$13.50");
});

test("modifier change via text and undo", async ({ page }) => {
  await open(page);
  await type(page, "a burger, fries and lemonade");
  await type(page, "make the burger a double");
  await expect(page.getByTestId("total")).toHaveText("$16.00");
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("total")).toHaveText("$13.50");
});

test("ambiguity between burger lines -> choose second -> undo", async ({ page }) => {
  await open(page);
  await type(page, "a burger, fries and lemonade");
  await type(page, "add a burger"); // starter grammar: "add <item>", no "another" yet
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(4);
  await type(page, "remove the burger");
  await expect(page.getByTestId("clarify")).toBeVisible();
  await expect(page.getByText("Burger (line 1)")).toBeVisible();
  await expect(page.getByText("Burger (line 2)")).toBeVisible();
  await page.getByTestId("clarify").getByRole("button").nth(1).click();
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(3);
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(4);
});

test("quantity over the limit is rejected, never clamped; cart unchanged", async ({ page }) => {
  await open(page);
  await type(page, "a burger, fries and lemonade");
  // "6 lemonades" reaches the bootstrap grammar's quantity check (QUANTITY_LIMIT).
  await type(page, "6 lemonades");
  await expect(page.getByTestId("notice")).toContainText(/1 to 5|quantit/i);
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(3);
  await expect(page.getByTestId("total")).toHaveText("$13.50");
});

test("an unsupported phrase (18,000 lemonades under the bootstrap grammar) is rejected; cart unchanged", async ({ page }) => {
  await open(page);
  await type(page, "a burger, fries and lemonade");
  await type(page, "18,000 lemonades"); // the comma splits it; C's grammar will report QUANTITY_LIMIT
  await expect(page.getByTestId("notice")).toBeVisible();
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(3);
  await expect(page.getByTestId("total")).toHaveText("$13.50");
});

test("edit invalidates prior review; confirm needs a fresh review", async ({ page }) => {
  await open(page);
  await type(page, "a burger, fries and lemonade");
  await page.getByTestId("review").click();
  await expect(page.getByTestId("confirm")).toBeVisible();
  await page.getByTestId("text-input").fill("x");
  await expect(page.getByTestId("confirm")).toHaveCount(0);
  await page.getByTestId("discard").click();
  await page.getByTestId("review").click();
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("ticket")).toBeVisible();
});

test("a double click on Confirm delivers one CONFIRM: exactly one applied confirm in the audit", async ({ page }) => {
  // This proves the UI removes the control after the first click (the second
  // click has nothing to hit). Engine idempotence for a repeated CONFIRM is A's
  // tests' job, not this one's.
  await open(page);
  await type(page, "fries");
  await page.getByTestId("review").click();
  await page.getByTestId("confirm").dblclick();
  await expect(page.getByTestId("ticket")).toBeVisible();
  await page.getByTestId("eng-toggle").click();
  const rows = page.getByTestId("audit").locator("li");
  await expect(rows.filter({ hasText: /confirm — applied/ })).toHaveCount(1);
  await expect(rows.filter({ hasText: /REVIEW_REQUIRED|SESSION_COMMITTED/ })).toHaveCount(0);
});

test("mocked voice: final result applies exactly once", async ({ page }) => {
  await open(page);
  await page.getByTestId("talk").click();
  await page.evaluate(() => (window as unknown as { __say: (t: string) => void }).__say("a burger and fries"));
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(2);
  await expect(page.getByTestId("badge-input")).toContainText("voice");
});

// MOCKED recognizer: the cloud path fails with "network" (what keyless Chromium
// builds and blocked networks produce); the on-device pack reports "available".
const FAKE_SR_NETWORK_THEN_LOCAL = `
  class FakeSR {
    constructor(){ window.__sr = this; this.processLocally = false; }
    start(){ const self = this; setTimeout(() => {
      if (!self.processLocally) { self.onerror && self.onerror({ error: 'network' }); self.onend && self.onend(); return; }
      self.onstart && self.onstart();
      setTimeout(() => { self.onresult && self.onresult({ resultIndex:0, results:[{ isFinal:true, 0:{ transcript:'a burger and fries', confidence:0.9 } }] }); self.onend && self.onend(); }, 150);
    }, 30); }
    stop(){} abort(){}
    static available(){ return Promise.resolve('available'); }
    static install(){ return Promise.resolve(true); }
  }
  window.SpeechRecognition = window.webkitSpeechRecognition = FakeSR;
`;

test("cloud speech service unreachable -> same Talk press retried on-device, one submit (recognizer mocked)", async ({ page }) => {
  await page.addInitScript(FAKE_SR_NETWORK_THEN_LOCAL);
  await page.goto("/");
  await page.getByTestId("talk").click();
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(2);
  await expect(page.getByTestId("total")).toHaveText("$11.00");
  await expect(page.getByTestId("badge-input")).toContainText("voice (on-device)");
  await expect(page.getByTestId("mic-notice")).toHaveCount(0); // no failure shown: the retry succeeded
  await page.getByTestId("eng-toggle").click();
  await expect(page.getByTestId("eng-voice")).toContainText("on-device");
  await expect(page.getByTestId("eng-voice")).toContainText("pack: available");
  // Exactly one utterance reached the controller.
  const rows = page.getByTestId("audit").locator("li");
  await expect(rows.filter({ hasText: /parse rules → proposal — applied/ })).toHaveCount(1);
});

test("cloud speech service unreachable and no on-device support -> honest notice, typing works (recognizer mocked)", async ({ page }) => {
  await page.addInitScript(`window.SpeechRecognition = window.webkitSpeechRecognition = class { start(){ const s=this; setTimeout(() => { s.onerror && s.onerror({error:'network'}); s.onend && s.onend(); }, 20); } stop(){} abort(){} };`);
  await page.goto("/");
  await page.getByTestId("talk").click();
  await expect(page.getByTestId("mic-notice")).toContainText(/speech service/i);
  await expect(page.getByTestId("mic-notice")).not.toContainText(/internet|wi-?fi/i);
  await expect(page.getByTestId("badge-busy")).toHaveCount(0); // lock released
  await type(page, "lemonade");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(1);
});

test("denied mic -> typed recovery", async ({ page }) => {
  // Override BOTH names: modern Chromium exposes unprefixed SpeechRecognition too.
  await page.addInitScript(`window.SpeechRecognition = window.webkitSpeechRecognition = class { start(){ this.onerror && this.onerror({error:'not-allowed'}); this.onend && this.onend(); } stop(){} abort(){} };`);
  await page.goto("/");
  await page.getByTestId("talk").click();
  await expect(page.getByTestId("mic-notice")).toContainText("blocked");
  await type(page, "lemonade");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(1);
});

test("provider 503 -> visibly falls back to rules (network mocked)", async ({ page }) => {
  await open(page);
  // Local only must be OFF for the client to go over HTTP at all.
  await page.getByTestId("eng-toggle").click();
  await page.getByTestId("local-only").uncheck();
  // Simulate an unavailable cloud provider at the HTTP boundary. The client
  // adapter must answer with rules mode and say so; the cart still updates.
  let requested = false;
  await page.route("**/api/interpret", (route) => {
    requested = true;
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ v: 1, requestId: null, error: { code: "PROVIDER_UNAVAILABLE", message: "down", retryable: true } }),
    });
  });
  await type(page, "fries");
  await expect(page.getByTestId("badge-parser")).toContainText(/rules|gemini/);
  // The bootstrap client parses locally even with Local only off, so the route
  // is never hit; the assertion below is only meaningful once C's client lands.
  test.skip(!requested, "client never called /api/interpret (bootstrap client parses locally); re-enable with C's HTTP client");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(1);
  await expect(page.getByTestId("badge-parser")).toContainText("rules");
  await expect(page.getByTestId("notice")).toContainText(/local rules|unavailable/i);
});

test("Local only is on by default and the parser badge shows the real mode", async ({ page }) => {
  await open(page);
  await page.getByTestId("eng-toggle").click();
  await expect(page.getByTestId("local-only")).toBeChecked();
  await expect(page.getByTestId("badge-parser")).toContainText("none"); // nothing parsed yet
  await type(page, "fries");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(1);
  await expect(page.getByTestId("badge-parser")).toContainText("rules");
  // Turning Local only off is a mode change: A's controller invalidates review and says so.
  await page.getByTestId("local-only").uncheck();
  await expect(page.getByTestId("notice")).toBeVisible();
});

test("reset returns to an empty cart in under five seconds", async ({ page }) => {
  await open(page);
  await type(page, "fries");
  const t0 = Date.now();
  await page.getByTestId("reset").click();
  await expect(page.getByTestId("cart-empty")).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(5000);
});

test("keyboard-only path to review", async ({ page }) => {
  await open(page);
  await page.getByTestId("text-input").focus();
  await page.keyboard.type("a burger and fries");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(2);
  await page.getByTestId("review").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("confirm")).toBeVisible();
});

test("390px layout still shows menu, input and cart", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.getByTestId("menu-burger")).toBeVisible();
  await expect(page.getByTestId("text-input")).toBeVisible();
  await expect(page.getByTestId("cart-empty")).toBeVisible();
});
