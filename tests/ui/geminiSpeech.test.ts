// @vitest-environment jsdom
// Mock microphone and transport; no human speech accuracy claim.
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGeminiSpeech } from "@/voice/useGeminiSpeech";
import { AUDIO_LIMITS } from "@/contracts/audio";
class Recorder {
  static instances: Recorder[] = []; static isTypeSupported = () => true;
  mimeType = "audio/webm"; state = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor() { Recorder.instances.push(this); }
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["audio"]) }); this.onstop?.(); }
}
let track: { stop: ReturnType<typeof vi.fn> };
const getMedia = vi.fn();
beforeEach(() => {
  track = { stop: vi.fn() }; Recorder.instances = []; getMedia.mockReset().mockResolvedValue({ getTracks: () => [track] });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: getMedia } });
  vi.stubGlobal("MediaRecorder", Recorder); vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const options = () => ({ language: "es-ES" as const, localOnly: false, onFinal: vi.fn(), onFail: vi.fn() });
it("records once, transcribes once after Stop, and submits the native transcript with null confidence", async () => {
  const opts = options(); vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ v: 1, language: "es-ES", transcriber: "gemini", text: "Un agua" })));
  const { result } = renderHook(() => useGeminiSpeech(opts));
  await act(async () => { result.current.start(); result.current.start(); });
  expect(getMedia).toHaveBeenCalledTimes(1); expect(result.current.listening).toBe(true);
  await act(async () => { result.current.stop(); result.current.stop(); });
  expect(fetch).toHaveBeenCalledTimes(1); expect(opts.onFinal).toHaveBeenCalledExactlyOnceWith("Un agua", null);
  expect(track.stop).toHaveBeenCalled(); expect(result.current.active).toBe(false);
});
it("discards a late upload response after cancellation", async () => {
  let resolve!: (value: Response) => void; vi.mocked(fetch).mockImplementation(() => new Promise(r => { resolve = r; }));
  const opts = options(); const { result } = renderHook(() => useGeminiSpeech(opts));
  await act(async () => { result.current.start(); }); await act(async () => { result.current.stop(); });
  expect(result.current.transcribing).toBe(true);
  const signal = vi.mocked(fetch).mock.calls[0][1]!.signal;
  act(() => result.current.abort()); expect(signal!.aborted).toBe(true);
  await act(async () => resolve(new Response(JSON.stringify({ v: 1, language: "es-ES", transcriber: "gemini", text: "late" }))));
  expect(opts.onFinal).not.toHaveBeenCalled(); expect(opts.onFail).not.toHaveBeenCalled();
});
it("releases a microphone granted after cancellation and never uploads it", async () => {
  let resolve!: (stream: unknown) => void; getMedia.mockImplementation(() => new Promise(r => { resolve = r; }));
  const opts = options(); const { result } = renderHook(() => useGeminiSpeech(opts));
  act(() => { result.current.start(); result.current.abort(); });
  await act(async () => resolve({ getTracks: () => [track] }));
  expect(track.stop).toHaveBeenCalled(); expect(Recorder.instances).toHaveLength(0); expect(fetch).not.toHaveBeenCalled();
});
it("discards overlong capture, releases input through onFail and never auto-submits a truncated order", async () => {
  vi.useFakeTimers(); const opts = options(); const { result } = renderHook(() => useGeminiSpeech(opts));
  await act(async () => { result.current.start(); });
  act(() => vi.advanceTimersByTime(AUDIO_LIMITS.recordingMs));
  expect(opts.onFail).toHaveBeenCalledWith("RECORDING_TOO_LONG"); expect(opts.onFinal).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled(); expect(track.stop).toHaveBeenCalled();
});
