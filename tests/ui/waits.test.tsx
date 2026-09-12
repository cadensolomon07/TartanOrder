// @vitest-environment jsdom
// Speech and parsing are explicit fixtures; these tests do not claim live audio/provider evidence.
import { StrictMode, useState, useSyncExternalStore } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WAIT_FIXTURE_CONFIG, WAIT_FIXTURE_OFFER, FIXTURE_RESPONSE } from "@/contracts/fixtures";
import { SwapOfferSchema, type OrderView, type ParseRequest, type WaitView } from "@/contracts";
import { createOrderController } from "@/controller/controller";
import { Kiosk } from "@/ui/Kiosk";
import { SwapOfferPanel } from "@/ui/SwapOfferPanel";
import { WaitEstimate } from "@/ui/WaitEstimate";
import { cancelSpeech } from "@/voice/tts";
import { makeFake, type FakeController } from "./fakeController";

class Recognition {
  static last: Recognition | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;
  constructor() { Recognition.last = this; }
  start() { this.onstart?.(); }
  stop() { this.onend?.(); }
  abort = vi.fn(() => this.onend?.());
}

const initialWait: WaitView = {
  snapshotId: WAIT_FIXTURE_CONFIG.snapshot.id,
  source: WAIT_FIXTURE_CONFIG.snapshot.source,
  asOf: WAIT_FIXTURE_CONFIG.snapshot.asOf,
  status: "known", estimateMinutes: 14,
  lineWaits: { [WAIT_FIXTURE_OFFER.originalLineId]: 14 },
};
const initial: Partial<OrderView> = {
  revision: WAIT_FIXTURE_OFFER.revision,
  lines: [{ lineId: WAIT_FIXTURE_OFFER.originalLineId, itemId: WAIT_FIXTURE_OFFER.original.itemId, qty: 2, modifiers: [] }],
  lastLineId: WAIT_FIXTURE_OFFER.originalLineId,
  totalCents: 1840, wait: initialWait, swapOffer: WAIT_FIXTURE_OFFER,
};

function mountFake() {
  let controller!: FakeController;
  function Host() {
    const [, update] = useState(0);
    if (!controller) controller = makeFake(initial, () => update((value) => value + 1), {
      locationId: "188", assistant: { id: "added", text: "Added two Nashville sandwiches." },
    });
    return <Kiosk controller={controller} />;
  }
  render(<StrictMode><Host /></StrictMode>);
  return () => controller;
}

function mountReal() {
  const interpret = vi.fn(async (request: ParseRequest) => ({
    ...FIXTURE_RESPONSE, requestId: request.requestId, baseRevision: request.baseRevision,
    result: { kind: "proposal" as const, ops: [{ type: "ADD" as const, itemId: WAIT_FIXTURE_OFFER.original.itemId, qty: 2, modifiers: [] }] },
  }));
  const store = createOrderController({ sessionId: () => "wait-ui", locationId: "188", waitConfig: WAIT_FIXTURE_CONFIG, interpret });
  function Host() {
    const controller = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    return <Kiosk controller={controller} />;
  }
  const rendered = render(<Host />);
  return { store, interpret, ...rendered };
}

beforeEach(() => {
  Recognition.last = null;
  Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: Recognition });
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speak: vi.fn(), cancel: vi.fn() } });
  vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} lang = ""; rate = 1; });
});
afterEach(() => { cleanup(); cancelSpeech(); vi.unstubAllGlobals(); });

describe("wait and swap presentation", () => {
  it("renders shared food/vendor differences and the full quantity price, then sends the exact accept intent", async () => {
    const controller = mountFake();
    await act(async () => {});
    const offer = within(screen.getByTestId("swap-offer"));
    expect(offer.getByText("2× Fried Chicken Sandwich")).toBeTruthy();
    expect(offer.getByTestId("swap-price-change").textContent).toContain("$1.58 more for 2");
    expect(offer.getByTestId("swap-price-change").textContent).toContain("$9.20 → $9.99");
    for (const difference of WAIT_FIXTURE_OFFER.differences) expect(offer.getByText(difference)).toBeTruthy();
    expect(offer.getByTestId("swap-cart-change").textContent).toContain("14 → 4 min (10 min less)");
    expect(offer.getAllByText("Simulated wait times")).toHaveLength(2);
    fireEvent.click(offer.getByRole("button", { name: "Switch to The Grill at Scotty's" }));
    expect(controller().calls.at(-1)).toEqual({ fn: "act", action: { type: "ACCEPT_SWAP", offerId: "fixture-swap", revision: 2 } });
  });

  it("reads acknowledgment and offer in one utterance once, including under StrictMode and repeat renders", async () => {
    const controller = mountFake();
    await act(async () => {});
    const speak = vi.mocked(window.speechSynthesis.speak);
    expect(speak).toHaveBeenCalledTimes(1);
    const spoken = speak.mock.calls[0][0].text;
    expect(spoken).toContain("Added two Nashville sandwiches.");
    expect(spoken).toContain("Simulated wait times.");
    expect(spoken).toContain("The Grill at Scotty's");
    expect(spoken).toContain("$1.58 more for 2");
    expect(screen.getByTestId("conversation-status").textContent).toBe("Responding");
    expect(speak.mock.calls[0][0].onend).toBeTypeOf("function");
    act(() => controller().set({ ...controller().state }));
    expect(screen.getByTestId("conversation-status").textContent).toBe("Responding");
    fireEvent.click(screen.getByLabelText("Read replies aloud"));
    fireEvent.click(screen.getByLabelText("Read replies aloud"));
    await act(async () => {});
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("sends the exact decline intent without asking the UI to alter a cart", () => {
    const controller = mountFake();
    fireEvent.click(screen.getByTestId("decline-swap"));
    expect(controller().calls.at(-1)).toEqual({ fn: "act", action: { type: "DECLINE_SWAP", offerId: "fixture-swap" } });
    expect(controller().state.lines).toEqual(initial.lines);
  });

  it("does not claim a whole-order saving when another line still determines the wait", () => {
    const offer = SwapOfferSchema.parse({ ...WAIT_FIXTURE_OFFER, projectedCartEstimateMinutes: 14, cartWaitReductionMinutes: 0 });
    const { rerender } = render(<SwapOfferPanel offer={offer} source="seeded" disabled={false} onAction={vi.fn()} />);
    expect(screen.getByTestId("swap-cart-change").textContent).toContain("stays 14 min");
    expect(screen.getByTestId("swap-cart-change").textContent).toContain("complete order is not");
    expect(screen.getByTestId("swap-cart-change").textContent).not.toContain("10 min less");
    const unknown = SwapOfferSchema.parse({ ...WAIT_FIXTURE_OFFER, currentCartEstimateMinutes: null, projectedCartEstimateMinutes: null, cartWaitReductionMinutes: null });
    rerender(<SwapOfferPanel offer={unknown} source="seeded" disabled={false} onAction={vi.fn()} />);
    expect(screen.getByTestId("swap-cart-change").textContent).toContain("no whole-order wait reduction is claimed");
  });

  it("discloses the retained and removed modifier fields before a customer accepts", () => {
    // A schema-valid presentation variation, not a claim that this campus pair supports modifiers.
    const offer = SwapOfferSchema.parse({ ...WAIT_FIXTURE_OFFER, retainedModifiers: ["no_onions"], removedModifiers: ["extra_cheese"] });
    render(<SwapOfferPanel offer={offer} source="seeded" disabled={false} onAction={vi.fn()} />);
    expect(screen.getByText("Keeps: No onions.")).toBeTruthy();
    expect(screen.getByText("Removes: Extra cheese.")).toBeTruthy();
    expect(screen.getByTestId("accept-swap")).toBeTruthy();
  });

  it("shows unknown estimates honestly, no estimate for an empty cart, and no seeded label for unavailable API data", () => {
    const { rerender } = render(<WaitEstimate wait={{ ...initialWait, status: "empty", estimateMinutes: null, lineWaits: {} }} />);
    expect(screen.queryByTestId("wait-estimate")).toBeNull();
    rerender(<WaitEstimate wait={{ ...initialWait, source: "api", status: "unavailable", estimateMinutes: null, lineWaits: { "unknown:0": null } }} />);
    expect(screen.getByTestId("wait-estimate").textContent).toContain("Estimated preparation wait: unavailable");
    expect(screen.getByTestId("wait-estimate").textContent).not.toContain("0 min");
    expect(screen.queryByText("Simulated wait times")).toBeNull();
    expect(screen.getByText(/Excludes walking and pickup travel/)).toBeTruthy();
  });
});

describe("Kiosk with real controller and seeded wait configuration", () => {
  it("routes a fixture parse through offer, acceptance, updated vendor/estimate, undo, review and receipt", async () => {
    const { store, interpret } = mountReal();
    expect(screen.queryByTestId("wait-estimate")).toBeNull();
    fireEvent.change(screen.getByTestId("text-input"), { target: { value: "two Nashville Sandwich - Southern-style Fried Chicken" } });
    await act(async () => { fireEvent.click(screen.getByTestId("submit")); });
    expect(screen.getByTestId("badge-parser").textContent).toContain("fixture");
    expect(screen.getByTestId("wait-estimate").textContent).toContain("14 min");
    fireEvent.click(screen.getByTestId("accept-swap"));
    expect(screen.queryByTestId("swap-offer")).toBeNull();
    expect(screen.getByTestId("cart").textContent).toContain("Fried Chicken Sandwich · The Grill at Scotty's");
    expect(screen.getByTestId("total").textContent).toBe("$19.98");
    expect(screen.getByTestId("wait-estimate").textContent).toContain("4 min");
    expect(store.getSnapshot().state.lines[0].qty).toBe(2);
    fireEvent.click(screen.getByTestId("undo"));
    expect(screen.getByTestId("total").textContent).toBe("$18.40");
    expect(screen.getByTestId("wait-estimate").textContent).toContain("14 min");
    expect(screen.getByTestId("cart").textContent).toContain("Stack'd Underground");
    fireEvent.click(screen.getByTestId("review"));
    expect(screen.getByTestId("review").textContent).toContain("Stack'd Underground");
    expect(screen.getByTestId("wait-estimate").textContent).toContain("14 min");
    fireEvent.click(screen.getByTestId("confirm"));
    expect(screen.getByTestId("ticket").textContent).toContain("Stack'd Underground");
    expect(screen.getByTestId("ticket").textContent).toContain("Simulated wait times");
    expect(interpret).toHaveBeenCalledTimes(1);
    store.dispose();
  });

  it.each(["typing", "microphone", "whitespace"] as const)("dismisses the real offer on %s start and rejects its stale action", async (input) => {
    const { store, interpret } = mountReal();
    fireEvent.click(screen.getByTestId(`menu-${WAIT_FIXTURE_OFFER.original.itemId}`));
    await act(async () => {});
    const offer = store.getSnapshot().state.swapOffer!;
    const lines = store.getSnapshot().state.lines;
    if (input !== "microphone") fireEvent.change(screen.getByTestId("text-input"), { target: { value: input === "whitespace" ? " " : "actually" } });
    else fireEvent.click(screen.getByTestId("talk"));
    expect(screen.queryByTestId("swap-offer")).toBeNull();
    expect(store.getSnapshot().busy).toBe(true);
    act(() => store.getSnapshot().act({ type: "ACCEPT_SWAP", offerId: offer.offerId, revision: offer.revision }));
    expect(store.getSnapshot().state.lines).toEqual(lines);
    expect(store.getSnapshot().state.wait?.estimateMinutes).toBe(14);
    expect(interpret).not.toHaveBeenCalled();
    if (input === "whitespace") {
      fireEvent.change(screen.getByTestId("text-input"), { target: { value: "" } });
      expect(store.getSnapshot().busy).toBe(false);
      expect((screen.getByTestId("review") as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(screen.getByTestId("review"));
      expect(screen.getByTestId("confirm")).toBeTruthy();
      fireEvent.change(screen.getByTestId("text-input"), { target: { value: "actually" } });
      expect(screen.queryByTestId("confirm")).toBeNull();
      fireEvent.click(screen.getByTestId("discard"));
      expect(store.getSnapshot().busy).toBe(false);
    }
    store.dispose();
  });
});
