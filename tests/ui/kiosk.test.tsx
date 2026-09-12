// @vitest-environment jsdom
// Kiosk flows against the FAKE controller. Voice is mocked; this is not a
// microphone test. It verifies that the UI sends the right calls to A.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { useState } from "react";
import { Kiosk, micFailureMessage } from "@/ui/Kiosk";
import { makeFake, type FakeController } from "./fakeController";
import { editingThree, clarifyingBurgers, reviewingThree, committedThree } from "./fixtures";
import type { OrderView } from "@/contracts";

class FakeRecognition {
  static last: FakeRecognition | null = null;
  static instances: FakeRecognition[] = [];
  // Chrome 139+ on-device API; tests set these per scenario (absent by default).
  static available?: () => Promise<string>;
  static install?: () => Promise<boolean>;
  lang = ""; interimResults = false; continuous = false; maxAlternatives = 1; processLocally = false;
  onstart: (() => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() { FakeRecognition.last = this; FakeRecognition.instances.push(this); }
  start() { this.onstart?.(); }
  stop() { this.onend?.(); }
  abort() { this.onend?.(); }
  final(t: string, c = 0.8) { this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: t, confidence: c } }] }); }
}

// Harness: re-renders Kiosk whenever the fake mutates.
function mount(initial: Partial<OrderView> = {}) {
  let ctrl!: FakeController;
  function Host() {
    const [, bump] = useState(0);
    if (!ctrl) ctrl = makeFake(initial, () => bump((n) => n + 1));
    return <Kiosk controller={ctrl} />;
  }
  const utils = render(<Host />);
  return { ...utils, ctrl: () => ctrl };
}

// A's Vitest config has no `globals`, so testing-library's automatic cleanup
// is not registered; unmount explicitly between tests.
afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear(); // the Local-only preference must never leak between tests
  FakeRecognition.instances = [];
  delete (FakeRecognition as { available?: unknown }).available;
  delete (FakeRecognition as { install?: unknown }).install;
  (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition;
  (window as unknown as { speechSynthesis: unknown }).speechSynthesis = { cancel: vi.fn(), speak: vi.fn() };
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class { constructor(public text: string) {} lang = ""; rate = 1; };
});

describe("Kiosk (fake controller, mocked voice)", () => {
  it("shows the required header text and badges", () => {
    mount();
    expect(screen.getByTestId("disclosure").textContent).toBe("TartanOrder Demo Counter · Seeded menu · No real purchase.");
    expect(screen.getByTestId("badge-parser").textContent).toContain("fixture");
  });

  it("typed three-item order submits once with source=text", async () => {
    const { ctrl } = mount();
    fireEvent.change(screen.getByTestId("text-input"), { target: { value: "a burger, fries and lemonade" } });
    fireEvent.click(screen.getByTestId("submit"));
    const subs = ctrl().calls.filter((c) => c.fn === "submit");
    expect(subs).toEqual([{ fn: "submit", text: "a burger, fries and lemonade", source: "text", asrConfidence: null }]);
  });

  it("renders three lines and total, manual + sends SET_QTY with a line ref", () => {
    const { ctrl } = mount(editingThree);
    expect(screen.getByTestId("total").textContent).toBe("$13.50");
    fireEvent.click(screen.getByLabelText("Increase Fries"));
    expect(ctrl().calls.at(-1)).toEqual({
      fn: "act",
      action: { type: "MANUAL", ops: [{ type: "SET_QTY", ref: { by: "line", lineId: "u1:1" }, qty: 2 }] },
    });
  });

  it("modifier chip sends MOD enabled=true, and Remove sends REMOVE", () => {
    const { ctrl } = mount(editingThree);
    fireEvent.click(screen.getByRole("button", { name: "Double" }));
    expect(ctrl().calls.at(-1)).toEqual({
      fn: "act",
      action: { type: "MANUAL", ops: [{ type: "MOD", ref: { by: "line", lineId: "u1:0" }, modifier: "double", enabled: true }] },
    });
    fireEvent.click(screen.getByLabelText("Remove Lemonade"));
    expect(ctrl().calls.at(-1)).toEqual({
      fn: "act",
      action: { type: "MANUAL", ops: [{ type: "REMOVE", ref: { by: "line", lineId: "u1:2" } }] },
    });
  });

  it("never sends quantity outside 1..5 from the +/- buttons", () => {
    const { ctrl } = mount({ ...editingThree, lines: [{ lineId: "u1:0", itemId: "burger", qty: 5, modifiers: [] }] });
    expect((screen.getByLabelText("Increase Burger") as HTMLButtonElement).disabled).toBe(true);
    mount({ ...editingThree, lines: [{ lineId: "u1:0", itemId: "burger", qty: 1, modifiers: [] }] });
    expect((screen.getAllByLabelText("Decrease Burger").at(-1) as HTMLButtonElement).disabled).toBe(true);
    expect(ctrl().calls.filter((c) => c.fn === "act")).toHaveLength(0);
  });

  it("ambiguity: distinct line labels, choose sends CHOOSE, undo sends UNDO", () => {
    const { ctrl } = mount(clarifyingBurgers);
    expect(screen.getByText("Burger (line 1)")).toBeTruthy();
    expect(screen.getByText("Burger (line 2)")).toBeTruthy();
    expect(screen.getByText("Which burger should I remove?")).toBeTruthy();
    fireEvent.click(screen.getByTestId("choice-c2"));
    expect(ctrl().calls.at(-1)).toEqual({ fn: "act", action: { type: "CHOOSE", pendingId: "p1", choiceId: "c2" } });
    fireEvent.click(screen.getByTestId("undo"));
    expect(ctrl().calls.at(-1)).toEqual({ fn: "act", action: { type: "UNDO" } });
    expect((screen.getByTestId("review") as HTMLButtonElement).disabled).toBe(true);
  });

  it("review shows every line and total; confirm sends exact reviewId+revision", () => {
    const { ctrl } = mount(reviewingThree);
    expect(screen.getByTestId("review-total").textContent).toBe("$13.50");
    fireEvent.click(screen.getByTestId("confirm"));
    expect(ctrl().calls.at(-1)).toEqual({ fn: "act", action: { type: "CONFIRM", reviewId: "s1:2", revision: 2 } });
  });

  it("editing the text field during review calls startInput once and invalidates the review", () => {
    const { ctrl } = mount(reviewingThree);
    fireEvent.change(screen.getByTestId("text-input"), { target: { value: "a" } });
    fireEvent.change(screen.getByTestId("text-input"), { target: { value: "ad" } });
    expect(ctrl().calls.filter((c) => c.fn === "startInput")).toHaveLength(1);
    expect(screen.queryByTestId("confirm")).toBeNull(); // fake cleared the review
    fireEvent.click(screen.getByTestId("discard"));
    expect(ctrl().calls.at(-1)).toEqual({ fn: "endInput" });
  });

  it("erasing a draft that was started during review releases capture (no stranded busy state)", () => {
    const { ctrl } = mount(reviewingThree);
    fireEvent.change(screen.getByTestId("text-input"), { target: { value: "a" } });
    expect(ctrl().busy).toBe(true);
    expect(screen.getByTestId("discard")).toBeTruthy();
    fireEvent.change(screen.getByTestId("text-input"), { target: { value: "" } });
    expect(ctrl().calls.at(-1)).toEqual({ fn: "endInput" });
    expect(ctrl().busy).toBe(false);
    expect((screen.getByTestId("review") as HTMLButtonElement).disabled).toBe(false);
  });

  it("Talk is idempotent while a capture is opening: one startInput for repeated presses", () => {
    const { ctrl } = mount(editingThree);
    fireEvent.click(screen.getByTestId("talk"));
    // The same element is now the Stop control; nothing else re-enters talk().
    expect(screen.queryByTestId("talk")).toBeNull();
    expect(screen.getByTestId("stop-talk")).toBeTruthy();
    expect(screen.getByTestId("stop-talk").textContent).toContain("Stop — I’m done");
    expect(ctrl().calls.filter((c) => c.fn === "startInput")).toHaveLength(1);
  });

  it("pressing Talk during review invalidates it (startInput) and a final result submits once", () => {
    const { ctrl } = mount(reviewingThree);
    fireEvent.click(screen.getByTestId("talk"));
    expect(ctrl().calls.at(-1)).toEqual({ fn: "startInput" });
    expect(screen.queryByTestId("confirm")).toBeNull();
    act(() => { FakeRecognition.last!.final("make the burger a double", 0.77); FakeRecognition.last!.final("make the burger a double", 0.77); FakeRecognition.last!.onend?.(); });
    const subs = ctrl().calls.filter((c) => c.fn === "submit");
    expect(subs).toEqual([{ fn: "submit", text: "make the burger a double", source: "voice", asrConfidence: 0.77 }]);
  });

  it("cancelled or empty capture releases the lock with endInput", () => {
    const { ctrl } = mount(editingThree);
    fireEvent.click(screen.getByTestId("talk"));
    fireEvent.click(screen.getByTestId("cancel-talk"));
    expect(ctrl().calls.at(-1)).toEqual({ fn: "endInput" });
    expect(screen.getByTestId("mic-notice").textContent).toContain("cancelled");
  });

  it("denied microphone shows recovery text and typing still works", () => {
    const { ctrl } = mount();
    fireEvent.click(screen.getByTestId("talk"));
    act(() => { FakeRecognition.last!.onerror?.({ error: "not-allowed" }); FakeRecognition.last!.onend?.(); });
    expect(screen.getByTestId("mic-notice").textContent).toContain("blocked");
    fireEvent.change(screen.getByTestId("text-input"), { target: { value: "fries" } });
    fireEvent.click(screen.getByTestId("submit"));
    expect(ctrl().calls.at(-1)).toEqual({ fn: "submit", text: "fries", source: "text", asrConfidence: null });
  });

  it("a manual click while listening aborts the capture first (no late result)", () => {
    const { ctrl } = mount(editingThree);
    fireEvent.click(screen.getByTestId("talk"));
    const rec = FakeRecognition.last!;
    fireEvent.click(screen.getByLabelText("Increase Fries"));
    act(() => { rec.final("late words"); });
    const kinds = ctrl().calls.map((c) => c.fn);
    expect(kinds).toEqual(["startInput", "endInput", "act"]);
  });

  it("busy blocks Review and Confirm but not Submit/Discard; parsing can be cancelled", () => {
    const { ctrl } = mount(editingThree);
    act(() => ctrl().setBusy(true));
    expect((screen.getByTestId("review") as HTMLButtonElement).disabled).toBe(true);
    // A running parse is cancelled with startInput() then endInput() (A's rule).
    fireEvent.click(screen.getByTestId("cancel-parsing"));
    expect(ctrl().calls.slice(-2).map((c) => c.fn)).toEqual(["startInput", "endInput"]);
    fireEvent.change(screen.getByTestId("text-input"), { target: { value: "x" } });
    expect((screen.getByTestId("submit") as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId("discard") as HTMLButtonElement).disabled).toBe(false);
  });

  it("provider fallback is visible in the parser badge", () => {
    const { ctrl } = mount(editingThree);
    act(() => { ctrl().parser = "rules"; ctrl().notice = "Cloud parser unavailable; using local rules."; ctrl().set({}); });
    expect(screen.getByTestId("badge-parser").textContent).toContain("rules");
    expect(screen.getByTestId("notice").textContent).toContain("local rules");
  });

  it("committed shows ticket with simulated tag; New order resets", () => {
    const { ctrl } = mount(committedThree);
    expect(screen.getByTestId("ticket")).toBeTruthy();
    expect(screen.getByTestId("ticket").textContent).toContain("sample price");
    expect(screen.getByTestId("assistant-response").textContent).toContain("Nothing was purchased or sent");
    expect(screen.queryByText(/Pick up at|Ready in about|Order placed/)).toBeNull();
    expect(screen.getByText("Simulated · no real purchase")).toBeTruthy();
    fireEvent.click(screen.getByTestId("new-order"));
    expect(ctrl().calls.at(-1)).toEqual({ fn: "reset" });
    expect(screen.getByTestId("cart-empty")).toBeTruthy();
  });

  it("cloud network error with the on-device pack installed: one startInput, busy stays, then exactly one submit", async () => {
    FakeRecognition.available = async () => "available";
    FakeRecognition.install = async () => true;
    const { ctrl } = mount(reviewingThree);
    fireEvent.click(screen.getByTestId("talk"));
    const r1 = FakeRecognition.instances[0];
    await act(async () => { r1.onerror?.({ error: "network" }); r1.onend?.(); });
    // Hand-over in progress: the capture is still open on A's side.
    expect(ctrl().calls.filter((c) => c.fn === "startInput")).toHaveLength(1);
    expect(ctrl().calls.filter((c) => c.fn === "endInput")).toHaveLength(0);
    expect(ctrl().busy).toBe(true);
    expect(screen.queryByTestId("confirm")).toBeNull(); // review was invalidated by startInput
    expect(screen.queryByTestId("mic-notice")).toBeNull(); // no failure shown
    const r2 = FakeRecognition.instances[1];
    expect(r2.processLocally).toBe(true);
    act(() => { r2.final("make the burger a double", 0.9); r2.onend?.(); });
    expect(ctrl().calls.filter((c) => c.fn === "submit")).toEqual([{ fn: "submit", text: "make the burger a double", source: "voice", asrConfidence: 0.9 }]);
    expect(ctrl().calls.filter((c) => c.fn === "endInput")).toHaveLength(0); // submit ends capture on A's side
    expect(screen.getByTestId("badge-input").textContent).toContain("voice (on-device)");
  });

  it("cloud network error with the pack only downloadable: exactly one endInput, honest notice, no submit", async () => {
    FakeRecognition.available = async () => "downloadable";
    FakeRecognition.install = () => new Promise(() => {}); // never resolves (keyless Chromium hang)
    const { ctrl } = mount(editingThree);
    fireEvent.click(screen.getByTestId("talk"));
    const r1 = FakeRecognition.instances[0];
    await act(async () => { r1.onerror?.({ error: "network" }); r1.onend?.(); });
    expect(ctrl().calls.filter((c) => c.fn === "startInput")).toHaveLength(1);
    expect(ctrl().calls.filter((c) => c.fn === "endInput")).toHaveLength(1);
    expect(ctrl().calls.filter((c) => c.fn === "submit")).toHaveLength(0);
    expect(ctrl().busy).toBe(false);
    expect(FakeRecognition.instances).toHaveLength(1);
    const notice = screen.getByTestId("mic-notice").textContent ?? "";
    expect(notice).toMatch(/speech service unreachable/i);
    expect(notice).not.toMatch(/internet|wi-?fi/i);
    // The user is not trapped: Talk is back and typing works.
    expect(screen.getByTestId("talk")).toBeTruthy();
    expect((screen.getByTestId("review") as HTMLButtonElement).disabled).toBe(false);
  });

  it("uses the controller mode and ignores a legacy saved Local-only preference", () => {
    window.localStorage.setItem("tartanorder.localOnly", "on");
    const { ctrl } = mount();
    expect(screen.queryByText("local only")).toBeNull();
    expect(ctrl().calls.filter((c) => c.fn === "setLocalOnly")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("eng-toggle"));
    expect((screen.getByTestId("local-only") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByTestId("local-only"));
    expect(ctrl().calls.at(-1)).toEqual({ fn: "setLocalOnly", value: true });
    expect((screen.getByTestId("local-only") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("local only")).toBeTruthy();
    act(() => { ctrl().localOnly = false; ctrl().set({}); });
    expect((screen.getByTestId("local-only") as HTMLInputElement).checked).toBe(false);
  });

  it("shows all eleven priced menu cards grouped by category", () => {
    mount();
    for (const category of ["Mains", "Sides", "Drinks"]) expect(screen.getByRole("group", { name: category })).toBeTruthy();
    expect(screen.getByTestId("menu-chicken_sandwich").textContent).toContain("$8.50");
    expect(screen.getByTestId("menu-water").textContent).toContain("$1.50");
    expect(screen.getAllByTestId(/^menu-/)).toHaveLength(11);
  });

  it("shows the accepted assistant reply as plain text and cancels it when typing starts", () => {
    const { ctrl } = mount();
    act(() => { ctrl().assistant = { id: "a1", text: "<b>Added fries.</b>" }; ctrl().set({}); });
    expect(screen.getByTestId("assistant-response").textContent).toBe("<b>Added fries.</b>");
    expect(document.querySelector("b")).toBeNull();
    expect(screen.getByTestId("conversation-status").textContent).toBe("Responding");
    fireEvent.change(screen.getByTestId("text-input"), { target: { value: "a" } });
    expect(screen.getByTestId("conversation-status").textContent).toBe("Ready");
    expect(screen.getByTestId("assistant-response").textContent).not.toContain("Added fries");
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it("Read replies aloud can be disabled while visual replies remain", () => {
    const { ctrl } = mount();
    fireEvent.click(screen.getByLabelText("Read replies aloud"));
    act(() => { ctrl().assistant = { id: "a1", text: "Added fries." }; ctrl().set({}); });
    expect(screen.getByTestId("assistant-response").textContent).toBe("Added fries.");
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    expect(screen.getByTestId("conversation-status").textContent).toBe("Ready");
  });

  it("a speech-service network error is explained (not blamed on the user's Wi-Fi), with next steps", () => {
    expect(micFailureMessage("network", { isBrave: true, onDevice: "unknown" })).toMatch(/Brave/);
    expect(micFailureMessage("network", { isBrave: false, onDevice: "downloadable" })).toMatch(/on-device/i);
    expect(micFailureMessage("network", { isBrave: false, onDevice: "unsupported" })).toMatch(/Chrome 139/);
    // A Chrome 139+ user whose browser reports no pack for this language must not be told to "use Chrome".
    expect(micFailureMessage("network", { isBrave: false, onDevice: "unavailable" })).not.toMatch(/use Chrome|Chrome 139/);
    for (const s of ["unknown", "unsupported", "unavailable", "downloadable", "downloading", "available"] as const) {
      expect(micFailureMessage("network", { isBrave: false, onDevice: s })).not.toMatch(/internet|wifi|wi-fi/i);
    }
  });

  it("model text is rendered as plain text, not HTML", () => {
    mount({ ...clarifyingBurgers, pending: { ...clarifyingBurgers.pending!, question: "<b>bold?</b>" } });
    expect(screen.getByText("<b>bold?</b>")).toBeTruthy();
    expect(document.querySelector("b")).toBeNull();
  });

  it("engineering panel shows asr confidence only there and local-only toggles the controller", () => {
    const { ctrl } = mount(editingThree);
    fireEvent.click(screen.getByTestId("eng-toggle"));
    expect(screen.getByTestId("eng-asr").textContent).toContain("—");
    // Online is the controller default; checking explicitly chooses local rules.
    expect((screen.getByTestId("local-only") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByTestId("local-only"));
    expect(ctrl().calls.at(-1)).toEqual({ fn: "setLocalOnly", value: true });
  });
});

it("passes the chosen language to recognition and cancels the old capture on language change (mocked)", () => {
  const { ctrl } = mount();
  fireEvent.change(screen.getByTestId("language-select"), { target: { value: "es-ES" } });
  expect(screen.getByTestId("talk").getAttribute("aria-label")).toContain("Hablar");
  fireEvent.click(screen.getByTestId("talk"));
  const old = FakeRecognition.last!;
  expect(old.lang).toBe("es-ES");
  fireEvent.change(screen.getByTestId("language-select"), { target: { value: "zh-CN" } });
  act(() => old.final("late Spanish result"));
  expect(ctrl().calls.filter(call => call.fn === "submit")).toHaveLength(0);
  fireEvent.click(screen.getByTestId("talk"));
  expect(FakeRecognition.last!.lang).toBe("zh-CN");
  expect(screen.getByTestId("language-voice-unavailable").textContent).toContain("未安装");
});

it("does not submit Enter used to compose a Mandarin character", () => {
  const { ctrl } = mount();
  fireEvent.change(screen.getByTestId("language-select"), { target: { value: "zh-CN" } });
  fireEvent.change(screen.getByTestId("text-input"), { target: { value: "水" } });
  fireEvent.keyDown(screen.getByTestId("text-input"), { key: "Enter", isComposing: true, keyCode: 229 });
  expect(ctrl().calls.filter(call => call.fn === "submit")).toHaveLength(0);
  fireEvent.keyDown(screen.getByTestId("text-input"), { key: "Enter", isComposing: false });
  expect(ctrl().calls.filter(call => call.fn === "submit")).toHaveLength(1);
});
