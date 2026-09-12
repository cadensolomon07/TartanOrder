import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
async function mockRecorder(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
    class Recorder {
      static isTypeSupported() { return true; }
      state = "inactive"; mimeType = "audio/webm";
      ondataavailable: ((e: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null;
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["explicit mock audio"]) }); this.onstop?.(); }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: Recorder });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: class { constructor() { throw new Error("Non-English must use Gemini audio"); } } });
  });
}
for (const [language, text, note] of [["es-ES", "Un agua con hielo extra", "hielo extra"], ["zh-CN", "请给我一杯加冰的水", "加冰"]]) {
  test(`${language}: mocked recording/transcription reaches guarded order, review and receipt`, async ({ page }) => {
    await mockRecorder(page);
    let uploads = 0; let interpretations = 0;
    await page.route("**/api/transcribe", async route => {
      uploads++;
      expect(route.request().headers()["x-audio-language"]).toBe(language);
      expect(route.request().postDataBuffer()!.byteLength).toBeGreaterThan(0);
      await route.fulfill({ json: { v: 1, language, transcriber: "gemini", text } });
    });
    await page.route("**/api/interpret", async route => {
      interpretations++; const req = route.request().postDataJSON();
      expect(req).toMatchObject({ language, text, source: "voice", asrConfidence: null });
      await route.fulfill({ json: { v: req.v, menuVersion: req.menuVersion, requestId: req.requestId, baseRevision: req.baseRevision, parser: "fixture", fallbackReason: null, result: { kind: "proposal", ops: [{ type: "ADD", itemId: "water", qty: 1, modifiers: [], note }] } } });
    });
    await page.goto("/"); await page.getByTestId("dining-location").selectOption("demo"); await page.getByTestId("language-select").selectOption(language);
    await page.getByTestId("talk").click(); await expect(page.getByTestId("review")).toBeDisabled(); await page.getByTestId("stop-talk").click();
    await expect(page.getByTestId("cart")).toContainText(note); await expect(page.getByTestId("total")).toHaveText("$1.50");
    await page.getByTestId("review").click(); await page.getByTestId("confirm").click(); await expect(page.getByTestId("ticket")).toContainText(note);
    expect(uploads).toBe(1); expect(interpretations).toBe(1);
  });
}
test("switching language while transcription is pending discards the late transcript and keeps the old review invalid", async ({ page }) => {
  await mockRecorder(page); let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let interpretCalls = 0;
  await page.route("**/api/transcribe", async route => { await pending; await route.fulfill({ json: { v: 1, language: "es-ES", transcriber: "gemini", text: "Un agua" } }).catch(() => {}); });
  await page.route("**/api/interpret", route => { interpretCalls++; return route.abort(); });
  await page.goto("/"); await page.getByTestId("dining-location").selectOption("demo"); await page.getByTestId("language-select").selectOption("es-ES");
  await page.getByTestId("menu-fries").click(); await page.getByTestId("review").click(); await expect(page.getByTestId("confirm")).toBeVisible();
  await page.getByTestId("talk").click(); await page.getByTestId("stop-talk").click(); await expect(page.getByTestId("transcribing")).toBeVisible();
  await expect(page.getByTestId("confirm")).toHaveCount(0); await expect(page.getByTestId("review")).toBeDisabled();
  await page.getByTestId("language-select").selectOption("zh-CN"); release();
  await expect(page.getByTestId("transcribing")).toHaveCount(0); await expect(page.getByTestId("review")).toBeEnabled(); await expect(page.getByTestId("total")).toHaveText("$3.00"); expect(interpretCalls).toBe(0);
});
