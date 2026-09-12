// @vitest-environment jsdom
// MOCKED speech engine. This is not a real microphone test.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpeech } from "@/voice/useSpeech";

type Handler = ((e: unknown) => void) | null;
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  // When true, abort() does NOT fire onend synchronously — the browser delivers
  // error("aborted")/end later, which is the realistic ordering.
  static asyncEnd = false;
  lang = ""; interimResults = false; continuous = false; maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onresult: Handler = null;
  onerror: Handler = null;
  onend: (() => void) | null = null;
  started = false; aborted = false;
  constructor() { FakeRecognition.instances.push(this); }
  start() { this.started = true; this.onstart?.(); }
  stop() { this.onend?.(); }
  abort() { this.aborted = true; if (!FakeRecognition.asyncEnd) this.onend?.(); }
  emit(transcript: string, isFinal: boolean, confidence = 0.9) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal, 0: { transcript, confidence } }] });
  }
}

beforeEach(() => {
  FakeRecognition.instances = [];
  FakeRecognition.asyncEnd = false;
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
    act(() => { rec.emit("a burger and fries", true, 0.87); rec.emit("a burger and fries", true, 0.87); rec.onend?.(); });
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith("a burger and fries", 0.87);
    expect(onFail).not.toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
  });

  it("reports empty capture once when recognition ends with no result", () => {
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    act(() => FakeRecognition.instances[0].onend?.());
    expect(onFinal).not.toHaveBeenCalled();
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail).toHaveBeenCalledWith("empty");
  });

  it("maps permission errors and does not double-report", () => {
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];
    act(() => { rec.onerror?.({ error: "not-allowed" }); rec.onend?.(); });
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail).toHaveBeenCalledWith("not-allowed");
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
    const { result } = renderHook(() => useSpeech({ onFinal: vi.fn(), onFail: vi.fn() }));
    act(() => result.current.start());
    expect((window.speechSynthesis.cancel as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it("events from an aborted instance cannot fail, end or submit the NEXT capture", () => {
    FakeRecognition.asyncEnd = true;
    const onFinal = vi.fn(); const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal, onFail }));
    act(() => result.current.start());
    const r1 = FakeRecognition.instances[0];
    act(() => result.current.abort());          // user cancelled; r1's end event is still in flight
    act(() => { expect(result.current.start()).toBe(true); }); // new capture r2
    const r2 = FakeRecognition.instances[1];
    expect(r2).not.toBe(r1);
    // r1's late events arrive now.
    act(() => { r1.onerror?.({ error: "aborted" }); r1.onend?.(); r1.emit("late words from r1", true); r1.onstart?.(); });
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

  it("reports unsupported when no engine exists", () => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    const onFail = vi.fn();
    const { result } = renderHook(() => useSpeech({ onFinal: vi.fn(), onFail }));
    expect(result.current.supported).toBe(false);
    act(() => result.current.start());
    expect(onFail).toHaveBeenCalledWith("unsupported");
  });
});
