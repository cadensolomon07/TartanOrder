// @vitest-environment jsdom
// MOCKED speech engine. This is not a real microphone test.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpeech, INSTALL_TIMEOUT_MS, HANDOVER_TIMEOUT_MS, STOP_TIMEOUT_MS } from "@/voice/useSpeech";

type Handler = ((e: unknown) => void) | null;
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  // Chrome 139+ on-device API (static). Tests set these per scenario.
  static availableResult: string | undefined = undefined; // undefined => static method absent
  static installResult: boolean | "hang" = true;
  static installCalls = 0;
  static available?: (o: { langs: string[]; processLocally?: boolean }) => Promise<string>;
  static install?: (o: { langs: string[]; processLocally?: boolean }) => Promise<boolean>;
  processLocally = false;
  // When true, abort() does NOT fire onend synchronously — the browser delivers
  // error("aborted")/end later, which is the realistic ordering.
  static asyncEnd = false;
  lang = ""; interimResults = false; continuous = false; maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onresult: Handler = null;
  onerror: Handler = null;
  onend: (() => void) | null = null;
  started = false; aborted = false; stopCalls = 0;
  constructor() { FakeRecognition.instances.push(this); }
  start() { this.started = true; this.onstart?.(); }
  stop() { this.stopCalls += 1; if (!FakeRecognition.asyncEnd) this.onend?.(); }
  abort() { this.aborted = true; if (!FakeRecognition.asyncEnd) this.onend?.(); }
  emit(transcript: string, isFinal: boolean, confidence = 0.9) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal, 0: { transcript, confidence } }] });
  }
  emitChunks(chunks: { text: string; final: boolean; confidence?: number }[], resultIndex = 0) {
    this.onresult?.({ resultIndex, results: chunks.map((chunk) => ({ isFinal: chunk.final, 0: { transcript: chunk.text, confidence: chunk.confidence ?? 0.9 } })) });
  }
}

beforeEach(() => {
  FakeRecognition.instances = [];
  FakeRecognition.asyncEnd = false;
  FakeRecognition.installCalls = 0;
  FakeRecognition.installResult = true;
  FakeRecognition.availableResult = undefined;
  delete (FakeRecognition as { available?: unknown }).available;
  delete (FakeRecognition as { install?: unknown }).install;
  delete (navigator as unknown as { brave?: unknown }).brave;
  (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition;
  (window as unknown as { speechSynthesis: unknown }).speechSynthesis = { cancel: vi.fn(), speak: vi.fn() };
});

describe("useSpeech (mocked engine)", () => {
  it("calls onFinal exactly once even if two final results arrive", () => {
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];
    act(() => { rec.emit("a burger", false); });
    expect(result.current.interim).toBe("a burger");
    act(() => { rec.emit("a burger and fries", true, 0.87); rec.emit("a burger and fries", true, 0.87); });
    expect(onFinal).not.toHaveBeenCalled();
    expect(result.current.active).toBe(true);
    act(() => { rec.onend?.(); });
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith("a burger and fries", 0.87);
    expect(onFail).not.toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
  });

  it("accumulates every final chunk and submits the complete utterance once after Stop and end", () => {
    FakeRecognition.asyncEnd = true;
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];
    expect(rec.continuous).toBe(true);
    const first = { text: "Hi I would like to order a burger", final: true, confidence: 0.9 };
    const second = { text: "and um also some fries and a lemonade too", final: true, confidence: 0.8 };
    const third = { text: "actually wait can you make it a double burger with no lettuce", final: true, confidence: 0.7 };
    act(() => rec.emitChunks([first, { text: "and um also", final: false }]));
    act(() => rec.emitChunks([first, second, { text: "actually wait", final: false }], 1));
    expect(onFinal).not.toHaveBeenCalled();
    expect(result.current.interim).toBe(`${first.text} ${second.text} actually wait`);
    act(() => { result.current.stop(); result.current.stop(); });
    expect(rec.stopCalls).toBe(1);
    expect(result.current.active).toBe(true);
    act(() => { rec.emitChunks([first, second, third], 2); rec.emitChunks([first, second, third], 2); });
    expect(onFinal).not.toHaveBeenCalled();
    const queuedEnd = rec.onend;
    act(() => { queuedEnd?.(); queuedEnd?.(); });
    expect(onFinal).toHaveBeenCalledExactlyOnceWith(`${first.text} ${second.text} ${third.text}`, null);
    expect(onFail).not.toHaveBeenCalled();
    expect(result.current.active).toBe(false);
  });

  it("natural end submits all finalized chunks without including stale interim hypotheses", () => {
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];
    act(() => rec.emitChunks([{ text: "a burger", final: true }, { text: "and lemon", final: false }]));
    act(() => rec.emitChunks([{ text: "a burger", final: true }, { text: "and lemonade", final: true }], 1));
    act(() => rec.onend?.());
    expect(onFinal).toHaveBeenCalledExactlyOnceWith("a burger and lemonade", null);
    expect(onFail).not.toHaveBeenCalled();
  });

  it("does not submit a finalized prefix when recognition ends with an unfinished trailing segment", () => {
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];
    act(() => rec.emitChunks([{ text: "a burger", final: true }, { text: "actually replace", final: false }]));
    act(() => rec.onend?.());
    expect(onFinal).not.toHaveBeenCalled();
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail.mock.calls[0][0]).toBe("error");
    expect(result.current.active).toBe(false);
  });

  it("reports empty capture once when recognition ends with no result", () => {
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    act(() => FakeRecognition.instances[0].onend?.());
    expect(onFinal).not.toHaveBeenCalled();
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail.mock.calls[0][0]).toBe("empty");
  });

  it("maps permission errors and does not double-report", () => {
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];
    act(() => { rec.onerror?.({ error: "not-allowed" }); rec.onend?.(); });
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail.mock.calls[0][0]).toBe("not-allowed");
  });

  it("abort() swallows a late final result", () => {
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];
    act(() => result.current.abort());
    act(() => { rec.emit("late words", true); rec.onend?.(); });
    expect(onFinal).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
    expect(rec.aborted).toBe(true);
  });

  it("cancels text-to-speech before opening the mic", () => {
    const start = vi.spyOn(FakeRecognition.prototype, "start");
    const { result } = renderHook(() => useSpeech({ onFinal: vi.fn(), onFail: vi.fn() }));
    act(() => result.current.start());
    const cancel = window.speechSynthesis.cancel as unknown as ReturnType<typeof vi.fn>;
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(start.mock.invocationCallOrder[0]);
    start.mockRestore();
  });

  it("events from an aborted instance cannot fail, end or submit the NEXT capture", () => {
    FakeRecognition.asyncEnd = true;
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const r1 = FakeRecognition.instances[0];
    act(() => r1.emit("cancelled prefix", true));
    const queued = { error: r1.onerror, end: r1.onend, result: r1.onresult, start: r1.onstart };
    act(() => result.current.abort());          // user cancelled; r1's end event is still in flight
    act(() => { expect(result.current.start()).toBe(true); }); // new capture r2
    const r2 = FakeRecognition.instances[1];
    expect(r2).not.toBe(r1);
    // r1's late events arrive now.
    act(() => {
      queued.error?.({ error: "aborted" }); queued.end?.(); queued.start?.();
      queued.result?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "late words from r1", confidence: 0.9 } }] });
    });
    expect(onFail).not.toHaveBeenCalled();
    expect(onFinal).not.toHaveBeenCalled();
    expect(result.current.active).toBe(true);   // r2 is still the live capture
    // r2's real result still goes through.
    act(() => { r2.emit("a burger", true, 0.9); r2.onend?.(); });
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith("a burger", 0.9);
    expect(result.current.active).toBe(false);
  });

  it("a late onstart after abort() cannot leave the hook 'listening'", () => {
    FakeRecognition.asyncEnd = true;
    const { result } = renderHook(() => useSpeech({ onFinal: vi.fn(), onFail: vi.fn() }));
    act(() => result.current.start());
    const r1 = FakeRecognition.instances[0];
    act(() => result.current.abort());
    act(() => { r1.onstart?.(); });
    expect(result.current.listening).toBe(false);
    expect(result.current.active).toBe(false);
  });

  it("start() while a capture is live returns false and opens nothing", () => {
    const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal: vi.fn(), onFail }));
    act(() => { expect(result.current.start()).toBe(true); });
    act(() => { expect(result.current.start()).toBe(false); });
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(onFail).not.toHaveBeenCalled();
  });

  it("never probes on-device availability at mount — only after a cloud network error", async () => {
    let availableCalls = 0;
    FakeRecognition.available = async () => { availableCalls++; return "unavailable"; };
    const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal: vi.fn(), onFail }));
    await act(async () => {});
    expect(availableCalls).toBe(0);
    expect(result.current.onDevice).toBe("unknown");
    act(() => result.current.start());
    expect(availableCalls).toBe(0); // a successful cloud capture never asks either
    const r1 = FakeRecognition.instances[0];
    expect(r1.processLocally).toBe(false);
    await act(async () => { r1.onerror?.({ error: "network" }); r1.onend?.(); });
    expect(availableCalls).toBe(1);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail.mock.calls[0][0]).toBe("network");
    expect(onFail.mock.calls[0][1]).toMatchObject({ engine: "cloud", onDevice: "unavailable" });
    expect(result.current.active).toBe(false);
  });

  it("no on-device API at all: a cloud network error is reported with onDevice=unsupported", async () => {
    const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal: vi.fn(), onFail }));
    act(() => result.current.start());
    const r1 = FakeRecognition.instances[0];
    await act(async () => { r1.onerror?.({ error: "network" }); r1.onend?.(); });
    expect(onFail.mock.calls[0][0]).toBe("network");
    expect(onFail.mock.calls[0][1]).toMatchObject({ onDevice: "unsupported" });
    expect(result.current.engine).toBe("cloud");
  });

  it("cloud network error + on-device pack installed: retries the SAME capture on-device, one final result", async () => {
    FakeRecognition.available = async () => "available";
    FakeRecognition.install = async () => true;
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const r1 = FakeRecognition.instances[0];
    expect(r1.processLocally).toBe(false); // first try: cloud
    await act(async () => { r1.onerror?.({ error: "network" }); r1.onend?.(); });
    expect(onFail).not.toHaveBeenCalled();
    expect(result.current.active).toBe(true); // still the same Talk press
    const r2 = FakeRecognition.instances[1];
    expect(r2.processLocally).toBe(true);
    expect(result.current.engine).toBe("on-device");
    act(() => { r2.emit("a burger", true, 0.9); r2.onend?.(); });
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith("a burger", 0.9);
    // Later captures go on-device first.
    act(() => result.current.start());
    expect(FakeRecognition.instances[2].processLocally).toBe(true);
  });

  it("a new Talk press during the engine hand-over is refused (no double capture)", async () => {
    let resolveAvail: (s: string) => void = () => {};
    FakeRecognition.available = () => new Promise<string>((res) => { resolveAvail = res; });
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const r1 = FakeRecognition.instances[0];
    act(() => { r1.onerror?.({ error: "network" }); r1.onend?.(); });
    expect(result.current.active).toBe(true);
    act(() => { expect(result.current.start()).toBe(false); }); // hand-over in progress
    expect(FakeRecognition.instances).toHaveLength(1);
    await act(async () => { resolveAvail("available"); });
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(FakeRecognition.instances[1].processLocally).toBe(true);
  });

  it("abort() during the engine hand-over drops it: nothing opens, nothing is reported", async () => {
    let resolveAvail: (s: string) => void = () => {};
    FakeRecognition.available = () => new Promise<string>((res) => { resolveAvail = res; });
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const r1 = FakeRecognition.instances[0];
    act(() => { r1.onerror?.({ error: "network" }); r1.onend?.(); });
    act(() => result.current.abort());
    await act(async () => { resolveAvail("available"); });
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(onFail).not.toHaveBeenCalled();
    expect(onFinal).not.toHaveBeenCalled();
    expect(result.current.active).toBe(false);
  });

  it("cloud network error + pack downloadable: reports network as 'downloading', starts the download once with processLocally", async () => {
    let avail = "downloadable";
    const availOpts: unknown[] = []; const installOpts: unknown[] = [];
    FakeRecognition.available = async (o: unknown) => { availOpts.push(o); return avail; };
    FakeRecognition.install = async (o: unknown) => { installOpts.push(o); FakeRecognition.installCalls++; avail = "available"; return true; };
    const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal: vi.fn(), onFail }));
    act(() => result.current.start());
    const r1 = FakeRecognition.instances[0];
    await act(async () => { r1.onerror?.({ error: "network" }); r1.onend?.(); });
    expect(onFail.mock.calls[0][0]).toBe("network");
    // The download is started before the failure is reported, so the report says so.
    expect(onFail.mock.calls[0][1]).toMatchObject({ onDevice: "downloading" });
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(availOpts[0]).toEqual({ langs: ["en-US"], processLocally: true });
    await act(async () => {});
    expect(FakeRecognition.installCalls).toBe(1);
    expect(installOpts[0]).toEqual({ langs: ["en-US"], processLocally: true });
    expect(result.current.onDevice).toBe("available"); // the pack landed; the next Talk goes on-device
    act(() => result.current.start());
    expect(FakeRecognition.instances[1].processLocally).toBe(true);
  });

  it("the on-device retry staying silent is 'empty', not 'network' (only an engine failure is remapped)", async () => {
    FakeRecognition.available = async () => "available";
    FakeRecognition.install = async () => true;
    const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal: vi.fn(), onFail }));
    act(() => result.current.start());
    const r1 = FakeRecognition.instances[0];
    await act(async () => { r1.onerror?.({ error: "network" }); r1.onend?.(); });
    const r2 = FakeRecognition.instances[1];
    expect(r2.processLocally).toBe(true);
    act(() => { r2.onerror?.({ error: "no-speech" }); r2.onend?.(); });
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail.mock.calls[0][0]).toBe("no-speech");
    expect(onFail.mock.calls[0][1]).toMatchObject({ engine: "on-device" });
  });

  it("on-device without its pack (language-not-supported) falls back to cloud within the same capture", async () => {
    FakeRecognition.available = async () => "available"; // browser claims the pack, then refuses it
    FakeRecognition.install = async () => true;
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    // Capture 1: cloud fails -> on-device succeeds -> on-device preferred from now on.
    act(() => result.current.start());
    const r1 = FakeRecognition.instances[0];
    await act(async () => { r1.onerror?.({ error: "network" }); r1.onend?.(); });
    const r2 = FakeRecognition.instances[1];
    act(() => { r2.emit("lemonade", true, 0.9); r2.onend?.(); });
    // Capture 2: on-device first; pack turns out missing -> cloud once.
    act(() => result.current.start());
    const r3 = FakeRecognition.instances[2];
    expect(r3.processLocally).toBe(true);
    act(() => { r3.onerror?.({ error: "language-not-supported" }); r3.onend?.(); });
    expect(onFail).not.toHaveBeenCalled();
    const r4 = FakeRecognition.instances[3];
    expect(r4.processLocally).toBe(false);
    expect(result.current.onDevice).toBe("downloadable");
    act(() => { r4.emit("fries", true, 0.8); r4.onend?.(); });
    expect(onFinal).toHaveBeenLastCalledWith("fries", 0.8);
    expect(onFinal).toHaveBeenCalledTimes(2);
  });

  it("Stop on an on-device capture prevents a delayed language error from reopening cloud recognition", async () => {
    FakeRecognition.available = async () => "available";
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    await act(async () => FakeRecognition.instances[0].onerror?.({ error: "network" }));
    act(() => { FakeRecognition.instances[1].emit("lemonade", true); FakeRecognition.instances[1].onend?.(); });
    act(() => result.current.start());
    const rec = FakeRecognition.instances[2];
    expect(rec.processLocally).toBe(true);
    FakeRecognition.asyncEnd = true;
    const queuedResult = rec.onresult;
    act(() => result.current.stop());
    act(() => rec.onerror?.({ error: "language-not-supported" }));
    act(() => queuedResult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "fries", confidence: 0.9 } }] }));
    expect(FakeRecognition.instances).toHaveLength(3);
    expect(onFinal).toHaveBeenCalledExactlyOnceWith("lemonade", 0.9);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(result.current.active).toBe(false);
  });

  it("a service error after speech began fails the whole capture rather than restarting with a partial order", async () => {
    FakeRecognition.available = async () => "available";
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];
    act(() => rec.emit("a burger", true));
    await act(async () => rec.onerror?.({ error: "network" }));
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(onFinal).not.toHaveBeenCalled();
    expect(onFail.mock.calls[0][0]).toBe("network");
    expect(result.current.active).toBe(false);
  });

  it("a stalled Stop releases capture without submitting a prefix and ignores late completion", async () => {
    vi.useFakeTimers();
    FakeRecognition.asyncEnd = true;
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result, unmount } = renderHook(() => useSpeech({ onFinal, onFail }));
    try {
      act(() => result.current.start());
      const rec = FakeRecognition.instances[0];
      act(() => rec.emit("a burger", true));
      const queuedEnd = rec.onend;
      act(() => result.current.stop());
      await act(async () => vi.advanceTimersByTimeAsync(STOP_TIMEOUT_MS));
      act(() => queuedEnd?.());
      expect(onFinal).not.toHaveBeenCalled();
      expect(onFail.mock.calls[0][0]).toBe("error");
      expect(rec.aborted).toBe(true);
      expect(result.current.active).toBe(false);
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it("Stop pressed DURING the engine hand-over settles the capture at once: no ghost mic, one failure", async () => {
    let resolveAvail: (s: string) => void = () => {};
    FakeRecognition.available = () => new Promise<string>((res) => { resolveAvail = res; });
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const r1 = FakeRecognition.instances[0];
    act(() => { r1.onerror?.({ error: "network" }); r1.onend?.(); });
    expect(result.current.active).toBe(true);
    act(() => result.current.stop()); // "Stop — I'm done" while the probe is pending
    expect(result.current.active).toBe(false);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail.mock.calls[0][0]).toBe("network");
    await act(async () => { resolveAvail("available"); });
    expect(FakeRecognition.instances).toHaveLength(1); // the late answer opens nothing
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFinal).not.toHaveBeenCalled();
  });

  it("a hand-over probe that never answers is bounded: the capture fails with network after the deadline", async () => {
    vi.useFakeTimers();
    try {
      FakeRecognition.available = () => new Promise<string>(() => {}); // never resolves
      const onFail = vi.fn();
      const { result } = renderHook(() => useSpeech({ onFinal: vi.fn(), onFail }));
      act(() => result.current.start());
      const r1 = FakeRecognition.instances[0];
      act(() => { r1.onerror?.({ error: "network" }); r1.onend?.(); });
      expect(result.current.active).toBe(true);
      await act(async () => { await vi.advanceTimersByTimeAsync(HANDOVER_TIMEOUT_MS + 1); });
      expect(result.current.active).toBe(false);
      expect(onFail).toHaveBeenCalledTimes(1);
      expect(onFail.mock.calls[0][0]).toBe("network");
      expect(FakeRecognition.instances).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("an error arriving after the capture settled cannot open a ghost recognizer", () => {
    FakeRecognition.available = async () => "available";
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const r1 = FakeRecognition.instances[0];
    act(() => { r1.emit("a burger", true, 0.9); r1.onend?.(); }); // settled by end, never a chunk
    act(() => { r1.onerror?.({ error: "language-not-supported" }); r1.onend?.(); });
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFail).not.toHaveBeenCalled();
  });

  it("Stop pressed, then the cloud reports network: no silent re-open of the mic; status learned for next time", async () => {
    FakeRecognition.available = async () => "available";
    FakeRecognition.install = async () => true;
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const r1 = FakeRecognition.instances[0];
    r1.onend = null; // the fake's stop() would end synchronously; the browser answers later
    act(() => result.current.stop());
    await act(async () => { r1.onerror?.({ error: "network" }); });
    expect(FakeRecognition.instances).toHaveLength(1); // nothing re-opened
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail.mock.calls[0][0]).toBe("network");
    expect(result.current.onDevice).toBe("available");
    expect(result.current.active).toBe(false);
    // The next Talk goes on-device directly.
    act(() => result.current.start());
    expect(FakeRecognition.instances[1].processLocally).toBe(true);
  });

  it("a hung install() is bounded: after the deadline the status is re-asked, never left at 'downloading'", async () => {
    vi.useFakeTimers();
    try {
      FakeRecognition.available = async () => "downloadable";
      FakeRecognition.install = () => new Promise<boolean>(() => {}); // never resolves
      const { result } = renderHook(() => useSpeech({ onFinal: vi.fn(), onFail: vi.fn() }));
      let status: string | undefined;
      let p!: Promise<string>;
      await act(async () => { p = result.current.installOnDevice(); });
      expect(result.current.onDevice).toBe("downloading");
      await act(async () => { await vi.advanceTimersByTimeAsync(INSTALL_TIMEOUT_MS + 1); status = await p; });
      expect(status).toBe("downloadable");
      expect(result.current.onDevice).toBe("downloadable");
    } finally {
      vi.useRealTimers();
    }
  });

  it("installOnDevice() probes lazily and reports the resulting status", async () => {
    let avail = "downloadable";
    FakeRecognition.available = async () => avail;
    FakeRecognition.install = async () => { avail = "available"; return true; };
    const { result } = renderHook(() => useSpeech({ onFinal: vi.fn(), onFail: vi.fn() }));
    expect(result.current.onDevice).toBe("unknown");
    let status = "";
    await act(async () => { status = await result.current.installOnDevice(); });
    expect(status).toBe("available");
    expect(result.current.onDevice).toBe("available");
  });

  it("reports unsupported when no engine exists", () => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal: vi.fn(), onFail }));
    expect(result.current.supported).toBe(false);
    act(() => result.current.start());
    expect(onFail.mock.calls[0][0]).toBe("unsupported");
  });
});

it("rechecks the selected locale rather than reusing another language's installed pack (mocked)", async () => {
  FakeRecognition.available = vi.fn(async ({ langs }) => langs[0] === "es-ES" ? "available" : "unavailable");
  FakeRecognition.install = vi.fn(async () => true);
  const { result, rerender } = renderHook(({ lang }) => useSpeech({ lang, onFinal: vi.fn(), onFail: vi.fn() }), { initialProps: { lang: "es-ES" } });
  await act(async () => { expect(await result.current.installOnDevice()).toBe("available"); });
  rerender({ lang: "zh-CN" });
  await act(async () => { expect(await result.current.installOnDevice()).toBe("unavailable"); });
  expect(FakeRecognition.available).toHaveBeenCalledWith({ langs: ["zh-CN"], processLocally: true });
});
