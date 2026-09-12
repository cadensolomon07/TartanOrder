// @vitest-environment jsdom
// Real Kiosk/controller/engine; recognition and TTS are browser mocks. The one
// delayed parser response is a labelled fixture, not provider or microphone evidence.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { API_VERSION, type InterpretOptions, type ParseRequest, type ParseResponse } from "@/contracts";
import { createOrderController } from "@/controller/controller";
import { Kiosk } from "@/ui/Kiosk";
import { reviewToSpeech } from "@/ui/reviewSpeech";
import { cancelSpeech } from "@/voice/tts";

const stores: ReturnType<typeof createOrderController>[] = [];
const utterances: SpeechSynthesisUtterance[] = [];
const recognizers: MockRecognition[] = [];
class MockRecognition {
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn();
  abort = vi.fn();
  constructor() { recognizers.push(this); }
}

beforeEach(() => {
  utterances.length = 0;
  recognizers.length = 0;
  vi.stubGlobal("webkitSpeechRecognition", MockRecognition);
  vi.stubGlobal("SpeechSynthesisUtterance", class {
    constructor(public text: string) {}
    lang = "";
    rate = 1;
  });
  vi.stubGlobal("speechSynthesis", {
    cancel: vi.fn(),
    speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
      utterances.push(utterance);
      utterance.onend?.(new Event("end") as SpeechSynthesisEvent);
    }),
  });
});
afterEach(() => {
  cleanup();
  cancelSpeech();
  for (const store of stores.splice(0)) store.dispose();
  vi.unstubAllGlobals();
});

function mount(interpret?: (req: ParseRequest, options: InterpretOptions) => Promise<ParseResponse>) {
  let session = 0;
  const parse = interpret ?? vi.fn(async () => { throw new Error("This manual test must not call a parser"); });
  const store = createOrderController({ sessionId: () => `note-ui-${++session}`, locationId: "demo", interpret: parse });
  stores.push(store);
  function Host() { return <Kiosk controller={useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)} />; }
  render(<Host />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Read replies aloud" }));
  fireEvent.click(screen.getByTestId("menu-water"));
  return store;
}
function openNote() { fireEvent.click(screen.getByRole("button", { name: /^(Add|Edit) note for Water$/ })); }
function typeNote(note: string) { fireEvent.change(screen.getByTestId("item-note-input"), { target: { value: note } }); }
function saveNote(note: string) { openNote(); typeNote(note); fireEvent.click(screen.getByTestId("save-item-note")); }
const reviewButton = () => screen.getByTestId("review") as HTMLButtonElement;

describe("cart special requests through the real controller", () => {
  it("opens a busy draft before typing; Save, edit, clear, Undo and Cancel keep the accepted note explicit", () => {
    const store = mount();
    const before = store.getSnapshot().state.revision;
    openNote();
    expect(store.getSnapshot().busy).toBe(true);
    expect(store.getSnapshot().state.revision).toBeGreaterThan(before);
    expect(reviewButton().disabled).toBe(true);
    act(() => store.getSnapshot().act({ type: "REVIEW" }));
    expect(store.getSnapshot().state.review).toBeNull();
    expect(store.getSnapshot().state.lines[0].note).toBeUndefined();
    typeNote("extra ice");
    fireEvent.click(screen.getByTestId("save-item-note"));
    expect(store.getSnapshot().busy).toBe(false);
    expect(store.getSnapshot().state.lines[0].note).toBe("extra ice");
    expect(screen.getByTestId("total").textContent).toBe("$1.50");
    expect(within(screen.getByTestId("cart")).getByTestId("item-note").textContent).toBe("Special request: extra ice");

    saveNote("no ice");
    expect(store.getSnapshot().state.lines[0].note).toBe("no ice");
    fireEvent.click(screen.getByTestId("undo"));
    expect(store.getSnapshot().state.lines[0].note).toBe("extra ice");
    openNote();
    typeNote("");
    expect(store.getSnapshot().busy).toBe(true); // Clearing an accepted note still needs Save.
    expect(store.getSnapshot().state.lines[0].note).toBe("extra ice");
    fireEvent.click(screen.getByTestId("save-item-note"));
    expect(store.getSnapshot().state.lines[0].note).toBeUndefined();
    expect(screen.queryByTestId("item-note")).toBeNull();
    fireEvent.click(screen.getByTestId("undo"));
    openNote();
    typeNote("unsaved request");
    fireEvent.click(screen.getByTestId("cancel-item-note"));
    expect(store.getSnapshot().state.lines[0].note).toBe("extra ice");
    expect(store.getSnapshot().busy).toBe(false);
    expect(screen.queryByTestId("item-note-input")).toBeNull();
    expect(reviewButton().disabled).toBe(false);
  });

  it("transfers draft ownership between notes, order text and requirements without leaving an unsaved note", () => {
    const store = mount();
    openNote(); typeNote("unsaved ice");
    fireEvent.change(screen.getByTestId("text-input"), { target: { value: "fries" } });
    expect(screen.queryByTestId("item-note-input")).toBeNull();
    expect(store.getSnapshot().busy).toBe(true);
    expect(reviewButton().disabled).toBe(true);
    expect(store.getSnapshot().state.lines[0].note).toBeUndefined();
    openNote();
    expect((screen.getByTestId("text-input") as HTMLInputElement).value).toBe("");
    expect((screen.getByTestId("item-note-input") as HTMLTextAreaElement).value).toBe("");
    fireEvent.click(screen.getByTestId("cancel-item-note"));
    expect(store.getSnapshot().busy).toBe(false);

    fireEvent.change(screen.getByTestId("dislike-input"), { target: { value: "onions" } });
    expect(screen.getByTestId("requirements-draft")).toBeTruthy();
    openNote();
    expect(screen.queryByTestId("requirements-draft")).toBeNull();
    expect((screen.getByTestId("dislike-input") as HTMLInputElement).value).toBe("");
    typeNote("extra ice");
    fireEvent.click(screen.getByTestId("save-item-note"));
    expect(store.getSnapshot().busy).toBe(false);
    expect(store.getSnapshot().state.requirements?.profile.dislikes ?? []).toEqual([]);
    expect(store.getSnapshot().state.lines[0].note).toBe("extra ice");
  });

  it.each(["manual edit", "parser mode", "location", "new order"] as const)("discards the note draft on %s", (action) => {
    const store = mount();
    const sessionId = store.getSnapshot().state.sessionId;
    openNote(); typeNote("do not apply this draft");
    if (action === "manual edit") fireEvent.click(screen.getByRole("button", { name: "Increase Water" }));
    if (action === "parser mode") {
      fireEvent.click(screen.getByTestId("eng-toggle"));
      fireEvent.click(screen.getByTestId("local-only"));
      expect(store.getSnapshot().localOnly).toBe(true);
    }
    if (action === "location") fireEvent.change(screen.getByTestId("dining-location"), { target: { value: "188" } });
    if (action === "new order") fireEvent.click(screen.getByTestId("reset"));
    expect(screen.queryByTestId("item-note-input")).toBeNull();
    expect(store.getSnapshot().busy).toBe(false);
    expect(store.getSnapshot().state.lines.every(line => line.note === undefined)).toBe(true);
    if (action === "manual edit") expect(store.getSnapshot().state.lines[0].qty).toBe(2);
    if (action === "location") expect(store.getSnapshot().locationId).toBe("188");
    if (action === "new order") {
      expect(store.getSnapshot().state.sessionId).not.toBe(sessionId);
      expect(store.getSnapshot().state.lines).toEqual([]);
    }
  });

  it("moves between a note draft and mocked microphone capture without releasing the newer input owner", () => {
    const store = mount();
    openNote(); typeNote("unsaved ice");
    fireEvent.click(screen.getByTestId("talk"));
    expect(screen.queryByTestId("item-note-input")).toBeNull();
    expect(screen.getByTestId("cancel-talk")).toBeTruthy();
    expect(store.getSnapshot().busy).toBe(true);
    const recognizer = recognizers.at(-1)!;
    const lateEnd = recognizer.onend;
    openNote();
    expect(recognizer.abort).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("cancel-talk")).toBeNull();
    act(() => lateEnd?.());
    expect(store.getSnapshot().busy).toBe(true);
    expect(reviewButton().disabled).toBe(true);
    fireEvent.click(screen.getByTestId("cancel-item-note"));
    expect(store.getSnapshot().busy).toBe(false);
    expect(store.getSnapshot().state.lines[0].note).toBeUndefined();
  });

  it("cancels an in-flight fixture parse when a note editor opens and ignores its late response", async () => {
    let pending!: { req: ParseRequest; options: InterpretOptions; resolve(response: ParseResponse): void };
    const store = mount((req, options) => new Promise(resolve => { pending = { req, options, resolve }; }));
    fireEvent.change(screen.getByTestId("text-input"), { target: { value: "add fries" } });
    fireEvent.click(screen.getByTestId("submit"));
    expect(pending.options.signal?.aborted).toBe(false);
    openNote();
    expect(pending.options.signal?.aborted).toBe(true);
    typeNote("extra ice");
    fireEvent.click(screen.getByTestId("save-item-note"));
    await act(async () => pending.resolve({
      v: API_VERSION, menuVersion: pending.req.menuVersion, requestId: pending.req.requestId,
      baseRevision: pending.req.baseRevision, parser: "fixture", fallbackReason: null,
      result: { kind: "proposal", ops: [{ type: "ADD", itemId: "fries", qty: 1, modifiers: [] }] },
    }));
    expect(store.getSnapshot().state.lines).toHaveLength(1);
    expect(store.getSnapshot().state.lines[0]).toMatchObject({ itemId: "water", note: "extra ice" });
    expect(store.getSnapshot().state.totalCents).toBe(150);
    expect(store.getSnapshot().busy).toBe(false);
  });

  it("escapes note text and reads the accepted request from the same review snapshot shown on the receipt", () => {
    const store = mount();
    const note = '<img src=x onerror="alert(1)"> & extra ice';
    saveNote(note);
    const cart = screen.getByTestId("cart");
    expect(cart.textContent).toContain(note);
    expect(cart.querySelector("img")).toBeNull();
    fireEvent.click(reviewButton());
    const review = store.getSnapshot().state.review!;
    expect(review.lines[0].note).toBe(note);
    expect(review.totalCents).toBe(150);
    expect(screen.getByTestId("review").textContent).toContain(`Special request: ${note}`);
    expect(screen.getByTestId("review").textContent).toContain("Availability and any extra charge are not confirmed.");
    expect(screen.getByTestId("review").querySelector("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Read it back" }));
    expect(utterances.at(-1)?.text).toBe(reviewToSpeech(review));
    expect(utterances.at(-1)?.text).toContain(`Special request: ${note}`);
    expect(utterances.at(-1)?.text).toContain("Special requests and any extra charge need counter confirmation.");
    fireEvent.click(screen.getByTestId("confirm"));
    expect(store.getSnapshot().state.receipt?.lines).toEqual(review.lines);
    expect(store.getSnapshot().state.receipt?.totalCents).toBe(150);
    const ticket = screen.getByTestId("ticket");
    expect(ticket.textContent).toContain(`Special request: ${note}`);
    expect(ticket.querySelector("img")).toBeNull();
    expect(ticket.textContent).toContain("$1.50");
  });
});
