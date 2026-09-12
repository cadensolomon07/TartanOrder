import { afterEach, describe, expect, it, vi } from "vitest";
import { API_VERSION, type ItemId, type LocationId, type Op, type ParseResult, type UiAction, type WaitEngineConfig } from "@/contracts";
import { CATALOG, MENU_VERSION } from "../helpers/catalog";
import { createEngine, exportLog, getView, reduceEngine, replayLog, type EngineState } from "@/core/engine";

const venues: readonly LocationId[] = ["110", "92", "174", "82", "188", "179", "113", "114", "155", "109", "108"];
const burger = "cmu_188_smash_d_burger";
const india = "cmu_114_bottled-water";
const archived = "cmu_136_millies-bottled-water";
const exchange = "cmu_92_bottled-water";
const add = (itemId: ItemId, qty = 1): Op => ({ type: "ADD", itemId, qty, modifiers: [] });
const act = (state: EngineState, action: UiAction) => reduceEngine(state, { type: "UI", action });
const receive = (state: EngineState, result: ParseResult) => reduceEngine(state, {
  type: "PARSE_RECEIVED", response: {
    v: API_VERSION, menuVersion: MENU_VERSION, requestId: `fixture-${state.view.audit.length}`,
    baseRevision: state.view.revision, parser: "fixture", fallbackReason: null, result,
  },
});

// Fixed synthetic waits and nearby pairs test eligibility, not live queue data.
const waits: WaitEngineConfig = {
  snapshot: { id: "catalog-policy-waits", source: "seeded", asOf: "2026-09-12T14:00:00Z", waits: { "114": 20, "136": 5, "92": 10 } },
  evaluatedAt: "2026-09-12T14:00:00Z", available: true, unavailableReason: null,
  groups: [{ id: "water", itemIds: [india, archived, exchange], differences: { [india]: "Taste of India bottled water.", [archived]: "Millie's bottled water.", [exchange]: "Exchange bottled water." } }],
  nearbyPairs: [
    { vendors: ["114", "136"], sourceUrl: "https://www.cmu.edu/", note: "Fixture pair." },
    { vendors: ["114", "92"], sourceUrl: "https://www.cmu.edu/", note: "Fixture pair." },
  ],
  swapThresholdMinutes: 5, priceToleranceCents: 100,
};

afterEach(() => vi.restoreAllMocks());

describe("recorded engine venue policy", () => {
  it("keeps internal demo/archive fixtures available only when no policy is supplied", () => {
    let state = act(createEngine("internal", { catalog: CATALOG }), { type: "MANUAL", ops: [add("burger"), add(archived)] });
    expect(state.lastOutcome).toBe("applied");
    expect(getView(state).totalCents).toBe(1000);
    expect(JSON.parse(exportLog(state))).not.toHaveProperty("allowedLocationIds");
    state = act(state, { type: "REVIEW" });
    const review = getView(state).review!;
    state = act(state, { type: "CONFIRM", reviewId: review.id, revision: review.revision });
    expect(getView(state).receipt?.totalCents).toBe(1000);
    expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state));
  });

  it.each(["burger", archived] as const)("rejects %s atomically after an allowed manual ADD and retains the previous Undo boundary", (itemId) => {
    let state = act(createEngine("manual-policy", { catalog: CATALOG, allowedLocationIds: venues }), { type: "MANUAL", ops: [add(burger)] });
    const before = getView(state);
    state = act(state, { type: "MANUAL", ops: [add(india), add(itemId)] });
    expect(state.lastCode).toBe("OFF_MENU");
    expect(state.lastOutcome).toBe("rejected");
    expect(getView(state).lines).toEqual(before.lines);
    expect(getView(state).lastLineId).toBe(before.lastLineId);
    expect(getView(state).totalCents).toBe(920);
    expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state));
    state = act(state, { type: "UNDO" });
    expect(getView(state).lines).toEqual([]);
  });

  it("rejects a late forbidden ADD in a parsed batch and invalidates an earlier review", () => {
    let state = act(createEngine("parser-policy", { catalog: CATALOG, allowedLocationIds: venues }), { type: "MANUAL", ops: [add(burger)] });
    state = act(state, { type: "REVIEW" });
    const before = getView(state).lines;
    state = reduceEngine(state, { type: "INPUT_STARTED" });
    state = receive(state, { kind: "proposal", ops: [add(india), add(archived)] });
    expect(state.lastCode).toBe("OFF_MENU");
    expect(getView(state).lines).toEqual(before);
    expect(getView(state).review).toBeNull();
    expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state));
  });

  it("cannot hide a forbidden ADD behind an engine-generated ambiguous reference", () => {
    let state = act(createEngine("ambiguous-policy", { catalog: CATALOG, allowedLocationIds: venues }), { type: "MANUAL", ops: [add(burger), add(burger)] });
    const before = getView(state).lines;
    state = receive(state, { kind: "proposal", ops: [{ type: "REMOVE", ref: { by: "item", itemId: burger } }, add(archived)] });
    expect(state.lastCode).toBe("OFF_MENU");
    expect(getView(state).lines).toEqual(before);
    expect(getView(state).pending).toBeNull();
    expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state));
  });

  it("rejects a parser clarification containing a forbidden choice before displaying any choice", () => {
    let state = act(createEngine("choice-policy", { catalog: CATALOG, allowedLocationIds: venues }), { type: "MANUAL", ops: [add(burger)] });
    const before = getView(state).lines;
    state = receive(state, { kind: "clarify", question: "Which water?", choices: [
      { id: "active", label: "Taste of India water", ops: [add(india)] },
      { id: "archived", label: "Millie's water", ops: [add(india), add(archived)] },
    ] });
    expect(state.lastCode).toBe("OFF_MENU");
    expect(getView(state).pending).toBeNull();
    expect(getView(state).lines).toEqual(before);
    expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state));
  });

  it.each(["CHOOSE", "resolve"] as const)("revalidates every ADD when resolving a stored batch through %s", (resolution) => {
    // A stored archive choice cannot bypass a policy applied to that engine state.
    let state = receive(createEngine("stored-choice", { catalog: CATALOG }), { kind: "clarify", question: "Which water?", choices: [
      { id: "water", label: "Water", ops: [add(india), add(archived)] },
    ] });
    const pending = getView(state).pending!;
    state = { ...state, allowedLocationIds: venues };
    state = resolution === "CHOOSE"
      ? act(state, { type: "CHOOSE", pendingId: pending.id, choiceId: "water" })
      : receive(state, { kind: "resolve", pendingId: pending.id, choiceId: "water" });
    expect(state.lastCode).toBe("OFF_MENU");
    expect(getView(state).lines).toEqual([]);
    // This deliberately reconstructed state did not originate from a policy-bearing audit.
    // Normal exported sessions below record the policy before their first event.
  });

  it("keeps stale-response priority and rejects the stale result without leaking its allowed first operation", () => {
    let state = createEngine("stale-policy", { catalog: CATALOG, allowedLocationIds: venues });
    const response = {
      v: API_VERSION, menuVersion: MENU_VERSION, requestId: "old", baseRevision: state.view.revision,
      parser: "fixture" as const, fallbackReason: null,
      result: { kind: "proposal" as const, ops: [add(india), add(archived)] },
    };
    state = act(state, { type: "MANUAL", ops: [add(burger)] });
    const before = getView(state).lines;
    state = reduceEngine(state, { type: "PARSE_RECEIVED", response });
    expect(state.lastOutcome).toBe("ignored");
    expect(state.lastCode).toBe("STALE_RESPONSE");
    expect(getView(state).lines).toEqual(before);
    expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state));
  });

  it("skips the fastest archived swap and selects the best permitted alternative", () => {
    const internal = act(createEngine("internal-swap", { catalog: CATALOG, waitConfig: waits }), { type: "MANUAL", ops: [add(india, 2)] });
    expect(getView(internal).swapOffer?.alternative.itemId).toBe(archived);
    let state = act(createEngine("public-swap", { catalog: CATALOG, waitConfig: waits, allowedLocationIds: venues }), { type: "MANUAL", ops: [add(india, 2)] });
    const offer = getView(state).swapOffer!;
    expect(offer.alternative.itemId).toBe(exchange);
    state = act(state, { type: "ACCEPT_SWAP", offerId: offer.offerId, revision: offer.revision });
    expect(state.lastOutcome).toBe("applied");
    expect(getView(state).lines.map(row => [row.itemId, row.qty])).toEqual([[exchange, 2]]);
    expect(getView(state).totalCents).toBe(470);
    expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state));
    const noAlternatives = act(createEngine("no-active-swap", { catalog: CATALOG, waitConfig: waits, allowedLocationIds: ["114"] }), { type: "MANUAL", ops: [add(india)] });
    expect(getView(noAlternatives).swapOffer).toBeNull();
  });

  it("rechecks a displayed archived alternative at acceptance and leaves the cart unchanged", () => {
    let state = act(createEngine("revalidate-swap", { catalog: CATALOG, waitConfig: waits }), { type: "MANUAL", ops: [add(india)] });
    const before = getView(state);
    const offer = before.swapOffer!;
    state = { ...state, allowedLocationIds: venues };
    state = act(state, { type: "ACCEPT_SWAP", offerId: offer.offerId, revision: offer.revision });
    expect(state.lastCode).toBe("STALE_OFFER");
    expect(getView(state).lines).toEqual(before.lines);
  });

  it("copies and validates the policy, then exports and replays it without any network calls", () => {
    const supplied: LocationId[] = [...venues];
    let state = createEngine("recorded-policy", { catalog: CATALOG, waitConfig: waits, allowedLocationIds: supplied });
    supplied.push("demo", "136");
    state = act(state, { type: "MANUAL", ops: [add(india)] });
    state = act(state, { type: "MANUAL", ops: [add(archived)] });
    expect(state.lastCode).toBe("OFF_MENU");
    const log = exportLog(state);
    expect(JSON.parse(log).allowedLocationIds).toEqual(venues);
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Replay must not call a provider."));
    expect(replayLog(log, CATALOG)).toEqual(getView(state));
    expect(fetch).not.toHaveBeenCalled();
    const widened = { ...JSON.parse(log), allowedLocationIds: [...venues, "136"] };
    expect(() => replayLog(JSON.stringify(widened), CATALOG)).toThrow(/audit outcome differs/);
    expect(() => createEngine("unknown-venue", { catalog: CATALOG, allowedLocationIds: ["not-a-venue" as LocationId] })).toThrow();
    expect(() => createEngine("unlisted-venue", { catalog: CATALOG, allowedLocationIds: ["999"] })).toThrow(/not in catalog/);
  });
});
