import { describe, expect, it, vi } from "vitest";
import { createTranscribeHandler } from "@/voice/transcribe.server";
import { AUDIO_LIMITS } from "@/contracts/audio";
const env = { GEMINI_API_KEY: "test-secret", GEMINI_MODEL: "gemini-test" };
const request = (language = "es-ES", body: BodyInit = new Uint8Array([1, 2, 3]), headers = {}) => new Request("http://localhost/api/transcribe", { method: "POST", headers: { "Content-Type": "audio/webm;codecs=opus", "X-Audio-Language": language, ...headers }, body });
const provider = (text: string) => new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ text }) }] } }] }));
describe("Gemini transcription transport (mock provider)", () => {
  it.each([["es-ES", "Un agua con hielo extra"], ["zh-CN", "请给我一杯水"]])("transcribes %s audio with no invented confidence or order operations", async (language, text) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => provider(text));
    const response = await createTranscribeHandler({ env, fetchImpl })(request(language));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ v: 1, language, transcriber: "gemini", text });
    const options = fetchImpl.mock.calls[0][1]!;
    const body = JSON.parse(options.body as string);
    expect(body.contents[0].parts[0].inlineData).toEqual({ mimeType: "audio/webm", data: "AQID" });
    expect(body.systemInstruction.parts[0].text).toContain("Do not translate to English");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("rejects unsupported locale/type, empty and oversized recordings before calling Gemini", async () => {
    const fetchImpl = vi.fn<typeof fetch>(); const handler = createTranscribeHandler({ env, fetchImpl });
    for (const req of [request("en-US"), request("es-ES", "data", { "Content-Type": "text/plain" }), request("es-ES", new Uint8Array()), request("es-ES", new Uint8Array(AUDIO_LIMITS.bytes + 1))]) expect((await handler(req)).status).toBeGreaterThanOrEqual(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("never turns silence, malformed output or provider failure into successful transcription", async () => {
    for (const result of [provider(""), provider("x".repeat(1501)), new Response("invalid"), new Response("quota", { status: 429 }), new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS" }] }))]) {
      const fetchImpl = vi.fn<typeof fetch>(async () => result);
      expect((await createTranscribeHandler({ env, fetchImpl })(request())).status).toBeGreaterThanOrEqual(400);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });
  it("honors cancellation even if the provider never settles", async () => {
    const abort = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const req = new Request(request(), { signal: abort.signal });
    const promise = createTranscribeHandler({ env, fetchImpl })(req);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    abort.abort(); expect((await promise).status).toBe(499);
  });
});
