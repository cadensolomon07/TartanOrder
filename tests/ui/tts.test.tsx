// @vitest-environment jsdom
// Browser speech synthesis is mocked. These are lifecycle checks, not audio evidence.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { cancelSpeech, speak, useSpeaking } from "@/voice/tts";

let utterances: SpeechSynthesisUtterance[];
function Status() { return <span data-testid="speaking">{String(useSpeaking())}</span>; }

beforeEach(() => {
  utterances = [];
  vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} lang = ""; rate = 1; });
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
    cancel: vi.fn(), speak: vi.fn((u: SpeechSynthesisUtterance) => utterances.push(u)),
  } });
});
afterEach(() => { cleanup(); cancelSpeech(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("optional TTS (mocked)", () => {
  it("reports responding while queued and returns ready on completion", () => {
    render(<Status />);
    expect(screen.getByTestId("speaking").textContent).toBe("false");
    act(() => { expect(speak("Added fries.")).toBe(true); });
    expect(screen.getByTestId("speaking").textContent).toBe("true");
    act(() => { utterances[0].onend?.({} as SpeechSynthesisEvent); });
    expect(screen.getByTestId("speaking").textContent).toBe("false");
  });

  it("cancellation and late completion cannot settle a newer utterance", () => {
    render(<Status />);
    act(() => { speak("Old reply."); });
    const oldEnd = utterances[0].onend!;
    act(() => { cancelSpeech(); speak("New reply."); oldEnd.call(utterances[0], {} as SpeechSynthesisEvent); });
    expect(screen.getByTestId("speaking").textContent).toBe("true");
    act(() => { utterances[1].onerror?.({} as SpeechSynthesisErrorEvent); });
    expect(screen.getByTestId("speaking").textContent).toBe("false");
  });

  it("a browser that throws or omits completion cannot strand responding", () => {
    vi.useFakeTimers();
    render(<Status />);
    vi.mocked(window.speechSynthesis.speak).mockImplementationOnce(() => { throw new Error("unavailable"); });
    act(() => { expect(speak("First reply.")).toBe(false); });
    expect(screen.getByTestId("speaking").textContent).toBe("false");
    act(() => { speak("Second reply."); vi.advanceTimersByTime(15_000); });
    expect(screen.getByTestId("speaking").textContent).toBe("false");
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });
});

it("selects a matching installed Spanish voice and never substitutes English for missing Mandarin (mocked)", () => {
  const spanish = { lang: "es-MX", name: "Spanish" } as SpeechSynthesisVoice;
  Object.defineProperty(window.speechSynthesis, "getVoices", { value: () => [{ lang: "en-US" }, spanish] });
  expect(speak("Tu pedido", "es-ES")).toBe(true);
  expect(utterances[0].lang).toBe("es-ES");
  expect(utterances[0].voice).toBe(spanish);
  expect(speak("您的订单", "zh-CN")).toBe(false);
  expect(utterances).toHaveLength(1);
});
