// Test-only fake of A's OrderController. Uses the SHARED types; never a copy
// of production logic. Records every call so tests can assert on them.
import type { Line, OrderController, OrderView, ParseRequest, UiAction } from "@/contracts";

export type FakeCall =
  | { fn: "startInput" }
  | { fn: "endInput" }
  | { fn: "submit"; text: string; source: ParseRequest["source"]; asrConfidence: number | null }
  | { fn: "act"; action: UiAction }
  | { fn: "setLocalOnly"; value: boolean }
  | { fn: "reset" }
  | { fn: "exportLog" };

export type FakeController = OrderController & {
  calls: FakeCall[];
  set(patch: Partial<OrderView>): void;
  setBusy(v: boolean): void;
};

export const EMPTY: OrderView = {
  sessionId: "s1",
  revision: 0,
  phase: "editing",
  lines: [],
  lastLineId: null,
  pending: null,
  review: null,
  receipt: null,
  totalCents: 0,
  audit: [],
};

export const THREE_LINES: Line[] = [
  { lineId: "u1:0", itemId: "burger", qty: 1, modifiers: [] },
  { lineId: "u1:1", itemId: "fries", qty: 1, modifiers: [] },
  { lineId: "u1:2", itemId: "lemonade", qty: 1, modifiers: [] },
];

// onChange lets a React harness re-render when the fake mutates state.
export function makeFake(
  initial: Partial<OrderView> = {},
  onChange: () => void = () => {},
  overrides: Partial<OrderController> = {},
): FakeController {
  const fake: FakeController = {
    calls: [],
    state: { ...EMPTY, ...initial },
    busy: false,
    parser: "fixture",
    notice: null,
    set(patch) {
      fake.state = { ...fake.state, ...patch };
      onChange();
    },
    setBusy(v) {
      fake.busy = v;
      onChange();
    },
    startInput() {
      fake.calls.push({ fn: "startInput" });
      // Mirrors A's controller: committed sessions only get a notice; otherwise
      // review/pending are invalidated, revision advances and capture holds busy.
      if (fake.state.phase === "committed") {
        fake.notice = "This simulated order is complete. Start a new order to edit.";
        onChange();
        return;
      }
      fake.busy = true;
      fake.set({ review: null, pending: null, phase: "editing", revision: fake.state.revision + 1 });
    },
    endInput() {
      fake.calls.push({ fn: "endInput" });
      fake.busy = false;
      onChange();
    },
    async submit(text, source, asrConfidence) {
      fake.calls.push({ fn: "submit", text, source, asrConfidence });
      fake.busy = false; // capture ends; parsing would set it again in A's controller
      onChange();
    },
    act(action) {
      fake.calls.push({ fn: "act", action });
    },
    setLocalOnly(value) {
      fake.calls.push({ fn: "setLocalOnly", value });
    },
    reset() {
      fake.calls.push({ fn: "reset" });
      fake.set({ ...EMPTY, sessionId: `s${fake.calls.length}` });
    },
    exportLog() {
      fake.calls.push({ fn: "exportLog" });
      return JSON.stringify({ v: 1, menuVersion: "demo-v1", sessionId: fake.state.sessionId, audit: fake.state.audit });
    },
    ...overrides,
  };
  return fake;
}
