// End-to-end flows against the running app (A's real controller, rules parser).
// VOICE EVENTS ARE MOCKED via an injected SpeechRecognition; nothing here
// exercises a real microphone. Run: npx playwright test tests/e2e
import { test, expect, type Page } from "@playwright/test";
import { API_VERSION, MENU_VERSION } from "../../src/contracts/index";

const BURGER = "cmu_188_smash_d_burger";
const FRIES = "cmu_188_fresh_cut_fries";
const COLESLAW = "cmu_188_coleslaw";

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

async function open(page: Page, localOnly = true) {
  await page.addInitScript(FAKE_SR);
  await page.goto("/");
  await expect(page.getByTestId("dining-location")).toHaveValue("188");
  await expect(page.getByTestId("disclosure")).toBeVisible();
  if (localOnly) await chooseLocalRules(page);
}

async function chooseLocalRules(page: Page) {
  await page.getByTestId("eng-toggle").click();
  await page.getByTestId("local-only").check();
  await page.getByTestId("eng-toggle").click();
}

async function type(page: Page, text: string) {
  await page.getByTestId("text-input").fill(text);
  await page.getByTestId("submit").click();
}

async function addThree(page: Page) {
  // The offline campus grammar takes one exact named item per turn.
  await type(page, "one Smash'd Burger");
  await expect(page.getByTestId("total")).toHaveText("$9.20");
  await type(page, "Fresh Cut Fries");
  await expect(page.getByTestId("total")).toHaveText("$12.65");
  await type(page, "Coleslaw");
  await expect(page.getByTestId("total")).toHaveText("$16.10");
}

test("three-item campus text order through real local rules", async ({ page }) => {
  await open(page);
  await addThree(page);
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(3);
  await expect(page.getByTestId("cart")).toContainText("Stack'd Underground");
});

test("quantity change via campus text and undo", async ({ page }) => {
  await open(page);
  await addThree(page);
  await type(page, "make the Fresh Cut Fries two");
  await expect(page.getByTestId("total")).toHaveText("$19.55");
  await expect(page.getByTestId("cart").getByLabel("quantity 2")).toBeVisible();
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("total")).toHaveText("$16.10");
  await expect(page.getByTestId("cart").getByLabel("quantity 2")).toHaveCount(0);
});

test("separate burger ADDs -> ambiguity -> remove only second -> undo preserves line IDs", async ({ page }) => {
  await open(page);
  await addThree(page);
  await type(page, "add a Smash'd Burger");
  const cart = page.getByTestId("cart");
  await expect(cart.locator("li")).toHaveCount(4);
  const before = await cart.locator("li").evaluateAll(rows => rows.map(row => row.getAttribute("data-line-id")));
  await type(page, "remove the Smash'd Burger");
  await expect(page.getByTestId("clarify")).toBeVisible();
  await expect(cart.getByText(/Smash'd Burger.*\(line 1\)/)).toBeVisible();
  await expect(cart.getByText(/Smash'd Burger.*\(line 2\)/)).toBeVisible();
  await expect(cart.locator("li")).toHaveCount(4);
  await page.getByTestId("clarify").getByRole("button").nth(1).click();
  await expect(cart.locator("li")).toHaveCount(3);
  expect(await cart.locator("li").evaluateAll(rows => rows.map(row => row.getAttribute("data-line-id")))).toEqual(before.slice(0, 3));
  await expect(page.getByTestId("total")).toHaveText("$16.10");
  await page.getByTestId("undo").click();
  await expect(cart.locator("li")).toHaveCount(4);
  expect(await cart.locator("li").evaluateAll(rows => rows.map(row => row.getAttribute("data-line-id")))).toEqual(before);
  await expect(page.getByTestId("total")).toHaveText("$25.30");
});

test("quantity over the limit is rejected, never clamped; campus cart unchanged", async ({ page }) => {
  await open(page);
  await addThree(page);
  await type(page, "6 Fresh Cut Fries");
  await expect(page.getByTestId("notice")).toContainText(/1 to 5|quantit/i);
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(3);
  await expect(page.getByTestId("total")).toHaveText("$16.10");
});

test("an extreme quantity is rejected; campus cart unchanged", async ({ page }) => {
  await open(page);
  await addThree(page);
  await type(page, "18,000 Fresh Cut Fries");
  await expect(page.getByTestId("notice")).toBeVisible();
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(3);
  await expect(page.getByTestId("total")).toHaveText("$16.10");
});

test("an unsent typed draft during editing blocks Review (busy) until discarded or erased", async ({ page }) => {
  await open(page);
  await page.getByTestId(`menu-${FRIES}`).click();
  await expect(page.getByTestId("total")).toHaveText("$3.45");
  await expect(page.getByTestId("review")).toBeEnabled();
  await page.getByTestId("text-input").fill("Coleslaw"); // begun, not submitted
  await expect(page.getByTestId("review")).toBeDisabled();
  await expect(page.getByTestId("badge-busy")).toHaveText("typing");
  await page.getByTestId("discard").click();
  await expect(page.getByTestId("review")).toBeEnabled();
  await page.getByTestId("text-input").fill("c");
  await expect(page.getByTestId("review")).toBeDisabled();
  await page.getByTestId("text-input").fill(""); // erased
  await expect(page.getByTestId("review")).toBeEnabled();
});

test("edit invalidates prior review; confirm needs a fresh review", async ({ page }) => {
  await open(page);
  await addThree(page);
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
  await type(page, "Fresh Cut Fries");
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
  await page.evaluate(() => (window as unknown as { __say: (t: string) => void }).__say("one Smash'd Burger"));
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(1);
  await expect(page.getByTestId("total")).toHaveText("$9.20");
  await expect(page.getByTestId("badge-input")).toContainText("voice");
  await page.getByTestId("eng-toggle").click();
  await expect(page.getByTestId("audit").locator("li").filter({ hasText: /parse rules → proposal — applied/ })).toHaveCount(1);
});

// MOCKED recognizer: the cloud path fails with "network" (what keyless Chromium
// builds and blocked networks produce); the on-device pack reports "available".
const FAKE_SR_NETWORK_THEN_LOCAL = `
  class FakeSR {
    constructor(){ window.__sr = this; this.processLocally = false; }
    start(){ const self = this; setTimeout(() => {
      if (!self.processLocally) { self.onerror && self.onerror({ error: 'network' }); self.onend && self.onend(); return; }
      self.onstart && self.onstart();
      setTimeout(() => { self.onresult && self.onresult({ resultIndex:0, results:[{ isFinal:true, 0:{ transcript:'fresh cut fries', confidence:0.9 } }] }); self.onend && self.onend(); }, 150);
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
  await expect(page.getByTestId("dining-location")).toHaveValue("188");
  await chooseLocalRules(page);
  await page.getByTestId("talk").click();
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(1);
  await expect(page.getByTestId("total")).toHaveText("$3.45");
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
  await expect(page.getByTestId("dining-location")).toHaveValue("188");
  await chooseLocalRules(page);
  await page.getByTestId("talk").click();
  await expect(page.getByTestId("mic-notice")).toContainText(/speech service/i);
  await expect(page.getByTestId("mic-notice")).not.toContainText(/internet|wi-?fi/i);
  await expect(page.getByTestId("badge-busy")).toHaveCount(0); // lock released
  await type(page, "Coleslaw");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(1);
});

test("denied mic -> typed recovery", async ({ page }) => {
  // Override BOTH names: modern Chromium exposes unprefixed SpeechRecognition too.
  await page.addInitScript(`window.SpeechRecognition = window.webkitSpeechRecognition = class { start(){ this.onerror && this.onerror({error:'not-allowed'}); this.onend && this.onend(); } stop(){} abort(){} };`);
  await page.goto("/");
  await expect(page.getByTestId("dining-location")).toHaveValue("188");
  await chooseLocalRules(page);
  await page.getByTestId("talk").click();
  await expect(page.getByTestId("mic-notice")).toContainText("blocked");
  await type(page, "Coleslaw");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(1);
});

test("provider 503 -> visibly falls back to rules (HTTP response mocked)", async ({ page }) => {
  await open(page, false);
  // Local only must be OFF for the client to go over HTTP at all.
  await page.getByTestId("eng-toggle").click();
  await page.getByTestId("local-only").uncheck();
  // Simulate an unavailable cloud provider at the HTTP boundary. The client
  // adapter must answer with rules mode and say so; the cart still updates.
  let requested = 0;
  await page.route("**/api/interpret", (route) => {
    requested += 1;
    const request = route.request().postDataJSON();
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ v: request.v, requestId: request.requestId, error: { code: "PROVIDER_UNAVAILABLE", message: "down", retryable: true } }),
    });
  });
  await type(page, "Fresh Cut Fries");
  await expect(page.getByTestId("badge-parser")).toContainText("rules");
  expect(requested).toBe(1);
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(1);
  await expect(page.getByTestId("badge-parser")).toContainText("rules");
  await expect(page.getByTestId("notice")).toContainText(/local rules|unavailable/i);
});

test("online is the default even with a legacy saved Local-only preference", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("tartanorder.localOnly", "on"));
  await open(page, false);
  await page.getByTestId("eng-toggle").click();
  await expect(page.getByTestId("local-only")).not.toBeChecked();
  await expect(page.getByTestId("badge-parser")).toContainText("none");
  // Explicit local selection permits the deterministic offline grammar.
  await page.getByTestId("local-only").check();
  await type(page, "Fresh Cut Fries");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(1);
  await expect(page.getByTestId("badge-parser")).toContainText("rules");
  await page.reload();
  await page.getByTestId("eng-toggle").click();
  await expect(page.getByTestId("local-only")).not.toBeChecked();
});

test("MOCKED Gemini campus reply is applied and reviewed through the ordinary controller", async ({ page }) => {
  await open(page, false);
  let requestCount = 0;
  await page.route("**/api/interpret", (route) => {
    requestCount += 1;
    const request = route.request().postDataJSON();
    expect(request.context.lines).toEqual([]);
    expect(request.locationId).toBe("188");
    expect(request.v).toBe(API_VERSION);
    expect(request.menuVersion).toBe(MENU_VERSION);
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        v: API_VERSION, menuVersion: MENU_VERSION, requestId: request.requestId,
        baseRevision: request.baseRevision, parser: "gemini", fallbackReason: null,
        result: { kind: "proposal", ops: [
          { type: "ADD", itemId: BURGER, qty: 1, modifiers: [] },
          { type: "ADD", itemId: FRIES, qty: 2, modifiers: [] },
          { type: "ADD", itemId: COLESLAW, qty: 1, modifiers: [] },
        ] },
      }),
    });
  });
  await type(page, "I’ll take a Smash'd Burger, Fresh Cut Fries and Coleslaw. Actually, two fries.");
  await expect(page.getByTestId("total")).toHaveText("$19.55");
  await expect(page.getByTestId("cart").getByLabel("quantity 2")).toBeVisible();
  await expect(page.getByTestId("badge-parser")).toContainText("gemini");
  await expect(page.getByTestId("assistant-response")).toContainText(/smash'd burger/i);
  await expect(page.getByTestId("assistant-response")).toContainText(/2 fresh cut fries/i);
  expect(requestCount).toBe(1);
  await page.getByTestId("review").click();
  await expect(page.getByTestId("review")).toContainText("2× Fresh Cut Fries");
  await expect(page.getByTestId("review-total")).toHaveText("$19.55");
  await expect(page.getByTestId("ticket")).toHaveCount(0);
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("ticket")).toContainText("2× Fresh Cut Fries");
  await expect(page.getByTestId("ticket")).toContainText("$19.55");
});

test("MOCKED late unsupported campus modifier rejects the entire batch and invalidates review", async ({ page }) => {
  await open(page, false);
  await page.getByTestId(`menu-${BURGER}`).click();
  const initialLine = await page.getByTestId("cart").locator("li").getAttribute("data-line-id");
  await page.getByTestId("review").click();
  let requests = 0;
  await page.route("**/api/interpret", route => {
    requests += 1;
    const request = route.request().postDataJSON();
    expect(request.menuVersion).toBe(MENU_VERSION);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      v: API_VERSION, menuVersion: MENU_VERSION, requestId: request.requestId, baseRevision: request.baseRevision,
      parser: "gemini", fallbackReason: null, result: { kind: "proposal", ops: [
        { type: "ADD", itemId: FRIES, qty: 1, modifiers: [] },
        { type: "MOD", ref: { by: "item", itemId: BURGER }, modifier: "double", enabled: true },
      ] },
    }) });
  });
  await type(page, "Add Fresh Cut Fries and make the Smash'd Burger a double.");
  await expect(page.getByTestId("notice")).toContainText(/option.*not available|cart was not changed/i);
  await expect(page.getByTestId("confirm")).toHaveCount(0);
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(1);
  await expect(page.getByTestId("cart").locator("li")).toHaveAttribute("data-line-id", initialLine!);
  await expect(page.getByTestId("cart")).not.toContainText("Fresh Cut Fries");
  await expect(page.getByTestId("total")).toHaveText("$9.20");
  await expect(page.getByTestId("review")).toBeEnabled();
  expect(requests).toBe(1);
});

test("reset returns to an empty cart in under five seconds", async ({ page }) => {
  await open(page);
  await type(page, "Fresh Cut Fries");
  const t0 = Date.now();
  await page.getByTestId("reset").click();
  await expect(page.getByTestId("cart-empty")).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(5000);
});

test("keyboard-only path to review", async ({ page }) => {
  await open(page);
  await page.getByTestId("text-input").focus();
  await page.keyboard.type("one Smash'd Burger");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(1);
  await page.keyboard.type("Fresh Cut Fries");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("cart").locator("li")).toHaveCount(2);
  await expect(page.getByTestId("total")).toHaveText("$12.65");
  await page.getByTestId("review").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("confirm")).toBeVisible();
});

test("390px layout still shows menu, input and cart", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.getByTestId(`menu-${BURGER}`)).toBeVisible();
  await expect(page.getByTestId("text-input")).toBeVisible();
  await expect(page.getByTestId("cart-empty")).toBeVisible();
});
