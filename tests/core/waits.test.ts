import { describe, expect, it } from "vitest";
import { OrderViewSchema, type ItemId, type Line, type LocationId, type ModifierId, type Op, type UiAction, type WaitEngineConfig } from "@/contracts";
import { CATALOG, MENU } from "../helpers/catalog";
import { createEngine, exportLog, getView, reduceEngine, replayLog, type EngineState } from "@/core/engine";
import { deriveWaitView, swapCandidates, transferModifiers } from "@/core/waits";

const india = "cmu_114_bottled-water";
const millies = "cmu_136_millies-bottled-water";
const exchange = "cmu_92_bottled-water";
const rohr = "cmu_115_la-prima-rohr-bottled-water";
const wean = "cmu_94_la-prima-wean-bottled-water";
const asOf = "2026-09-12T14:00:00.000Z";
const line = (itemId: ItemId, lineId = "line-1", qty = 1, modifiers: ModifierId[] = []): Line => ({ lineId, itemId, qty, modifiers });
const add = (itemId: ItemId, qty = 1, modifiers: ModifierId[] = []): Op => ({ type: "ADD", itemId, qty, modifiers });
const act = (state: EngineState, action: UiAction) => reduceEngine(state, { type: "UI", action });

// Explicit synthetic eligibility/waits isolate transaction rules; these pairs are
// fixtures, not a claim about measured campus waits or walking distances.
function configuration(overrides: Partial<WaitEngineConfig> = {}): WaitEngineConfig {
  const itemIds: ItemId[] = [india, millies, exchange, rohr, wean];
  return {
    snapshot: { id: "wait-fixture-1", source: "seeded", asOf, waits: { "114": 20, "136": 10, "92": 8, "115": 10, "94": 10 } },
    available: true, unavailableReason: null, evaluatedAt: asOf,
    groups: [{ id: "fixture-water", itemIds, differences: Object.fromEntries(itemIds.map(id => [id, `${MENU.item(id)!.label} at ${MENU.item(id)!.locationId}; packaging may differ.`])) }],
    nearbyPairs: [
      { vendors: ["114", "136"], sourceUrl: "https://www.cmu.edu/", note: "Fixture nearby pair." },
      { vendors: ["114", "92"], sourceUrl: "https://www.cmu.edu/", note: "Fixture nearby pair." },
      { vendors: ["114", "115"], sourceUrl: "https://www.cmu.edu/", note: "Fixture nearby pair." },
      { vendors: ["114", "94"], sourceUrl: "https://www.cmu.edu/", note: "Fixture nearby pair." },
      { vendors: ["92", "136"], sourceUrl: "https://www.cmu.edu/", note: "Fixture nearby pair." },
    ],
    swapThresholdMinutes: 5, priceToleranceCents: 100, ...overrides,
  };
}

function onlyPair(original: ItemId, alternative: ItemId, originalWait = 20, alternativeWait = 10): WaitEngineConfig {
  const first = MENU.item(original)!.locationId as LocationId;
  const second = MENU.item(alternative)!.locationId as LocationId;
  return configuration({
    snapshot: { id: "pair-fixture", source: "seeded", asOf, waits: { [first]: originalWait, [second]: alternativeWait } },
    groups: [{ id: "fixture-pair", itemIds: [original, alternative], differences: { [original]: MENU.item(original)!.label, [alternative]: MENU.item(alternative)!.label } }],
    nearbyPairs: [{ vendors: [first, second], sourceUrl: "https://www.cmu.edu/", note: "Fixture eligibility only." }],
  });
}

describe("deterministic cart waits", () => {
  it("uses the slowest vendor once rather than summing rows or multiplying quantities", () => {
    const view = deriveWaitView([line(india, "one", 3), line(india, "two", 2), line(millies, "three")], configuration(), CATALOG);
    expect(view).toMatchObject({ status: "known", estimateMinutes: 20, lineWaits: { one: 20, two: 20, three: 10 }, source: "seeded", snapshotId: "wait-fixture-1", asOf });
    expect(deriveWaitView([], configuration(), CATALOG)).toMatchObject({ status: "empty", estimateMinutes: null, lineWaits: {} });
  });

  it("does not present a complete estimate when even one vendor wait is missing or null", () => {
    for (const waits of [{ "114": 20 }, { "114": 20, "92": null }]) {
      const config = configuration({ snapshot: { id: "partial", source: "seeded", asOf, waits } });
      expect(deriveWaitView([line(india, "known"), line(exchange, "unknown")], config, CATALOG)).toMatchObject({ status: "unavailable", estimateMinutes: null, lineWaits: { known: 20, unknown: null } });
    }
    const unavailable = configuration({ available: false, unavailableReason: "Provider unavailable" });
    expect(deriveWaitView([line(india)], unavailable, CATALOG)).toMatchObject({ status: "unavailable", estimateMinutes: null, lineWaits: { "line-1": null } });
    expect(swapCandidates([line(india)], unavailable, ["line-1"], CATALOG)).toEqual([]);
  });

  it.each([
    ["2026-09-12T14:05:00.000Z", true],
    ["2026-09-12T14:05:00.001Z", false],
    ["2026-09-12T13:59:59.999Z", false],
  ])("checks API freshness only against recorded evaluation time %s", (evaluatedAt, known) => {
    const config = configuration({ evaluatedAt, snapshot: { ...configuration().snapshot, source: "api" } });
    expect(deriveWaitView([line(india)], config, CATALOG).status).toBe(known ? "known" : "unavailable");
    expect(swapCandidates([line(india)], config, ["line-1"], CATALOG).length > 0).toBe(known);
  });

  it("keeps legacy engine views/exports unchanged and isolates its optional configuration from callers", () => {
    const legacy = createEngine("legacy", { catalog: CATALOG });
    expect(getView(legacy)).not.toHaveProperty("wait");
    expect(getView(legacy)).not.toHaveProperty("swapOffer");
    expect(JSON.parse(exportLog(legacy))).not.toHaveProperty("waitConfig");
    const config = configuration();
    let state = createEngine("snapshot-copy", { catalog: CATALOG, waitConfig: config });
    config.snapshot.waits["114"] = 999;
    state = act(state, { type: "MANUAL", ops: [add(india)] });
    expect(getView(state).wait?.estimateMinutes).toBe(20);
    expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state));
  });
});

describe("curated swap candidate boundaries", () => {
  it("includes exactly five minutes of item reduction and excludes anything below it", () => {
    expect(swapCandidates([line(india)], onlyPair(india, millies, 20, 15), ["line-1"], CATALOG)).toHaveLength(1);
    expect(swapCandidates([line(india)], onlyPair(india, millies, 20, 15.01), ["line-1"], CATALOG)).toEqual([]);
    expect(swapCandidates([line(india)], onlyPair(india, millies, 10, 20), ["line-1"], CATALOG)).toEqual([]);
  });

  it("applies the inclusive one-dollar tolerance per unit and discloses the quantity-scaled price change", () => {
    const original = "cmu_136_millies-hot-latte-12-oz";
    const alternative = "cmu_204_de-fer-hunt-cookie-butter-latte-12-oz";
    const config = onlyPair(original, alternative);
    const candidate = swapCandidates([line(original, "latte", 3)], config, ["latte"], CATALOG)[0];
    expect(candidate).toMatchObject({ quantity: 3, original: { unitPriceCents: 500 }, alternative: { unitPriceCents: 600 }, priceDifferenceCents: 300 });
    expect(candidate.differences.join(" ")).toMatch(/Cookie Butter/i);
    expect(swapCandidates([line(original)], { ...config, priceToleranceCents: 99 }, ["line-1"], CATALOG)).toEqual([]);
    const reverse = swapCandidates([line(alternative, "latte", 3)], onlyPair(alternative, original), ["latte"], CATALOG)[0];
    expect(reverse.priceDifferenceCents).toBe(-300);
  });

  it("requires explicit comparable groups, descriptions, nearby pairs, and different vendors", () => {
    expect(swapCandidates([line(india)], configuration({ groups: [] }), ["line-1"], CATALOG)).toEqual([]);
    expect(swapCandidates([line(india)], configuration({ nearbyPairs: [] }), ["line-1"], CATALOG)).toEqual([]);
    const config = onlyPair(india, millies);
    config.groups[0].differences = { [india]: "Original only" };
    expect(swapCandidates([line(india)], config, ["line-1"], CATALOG)).toEqual([]);
    expect(swapCandidates([line("burger")], onlyPair("burger", "chicken_sandwich"), ["line-1"], CATALOG)).toEqual([]);
    expect(swapCandidates([line(india)], configuration(), [], CATALOG)).toEqual([]);
  });

  it("ranks overall reduction before item reduction, then price and stable item ID", () => {
    const config = configuration({ snapshot: { ...configuration().snapshot, waits: { "114": 20, "136": 10, "92": 30, "115": 10, "94": 10 } } });
    const candidates = swapCandidates([line(india, "india"), line(exchange, "exchange")], config, ["india", "exchange"], CATALOG);
    expect(candidates[0]).toMatchObject({ originalLineId: "exchange", alternative: { itemId: millies }, itemWaitReductionMinutes: 20, cartWaitReductionMinutes: 10 });
    expect(candidates.find(candidate => candidate.originalLineId === "india")).toMatchObject({ cartWaitReductionMinutes: 0, currentCartEstimateMinutes: 30, projectedCartEstimateMinutes: 30 });
    const tied = swapCandidates([line(india)], configuration({ snapshot: { ...configuration().snapshot, waits: { "114": 20, "136": 10, "115": 10, "94": 10 } } }), ["line-1"], CATALOG);
    expect(tied.map(candidate => candidate.alternative.itemId)).toEqual([millies, rohr, wean]);
  });

  it("keeps maximum-length curated differences within the strict generated offer contract", () => {
    const config = onlyPair(india, millies);
    config.groups[0].differences = { [india]: "a".repeat(300), [millies]: "b".repeat(300) };
    const state = act(createEngine("bounded-offer", { catalog: CATALOG, waitConfig: config }), { type: "MANUAL", ops: [add(india)] });
    expect(getView(state).swapOffer?.differences).toEqual(["a".repeat(300), "b".repeat(300)]);
    expect(OrderViewSchema.safeParse(getView(state)).success).toBe(true);
    expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state));
  });

  it("reports only item savings if another counter prevents a complete cart estimate", () => {
    const config = onlyPair(india, millies);
    const candidate = swapCandidates([line(india, "known"), line(exchange, "unknown")], config, ["known"], CATALOG)[0];
    expect(candidate).toMatchObject({ itemWaitReductionMinutes: 10, currentCartEstimateMinutes: null, projectedCartEstimateMinutes: null, cartWaitReductionMinutes: null });
  });

  it("preserves every supported option and never drops requested exclusions", () => {
    expect(transferModifiers(["no_onions", "double", "extra_cheese"], ["no_onions", "extra_cheese"])).toEqual({ retained: ["no_onions", "extra_cheese"], removed: ["double"] });
    for (const modifier of ["no_onions", "no_lettuce", "no_mayo", "no_ice", "dressing_on_side"] as const) {
      expect(transferModifiers([modifier], [])).toBeNull();
      expect(transferModifiers([modifier], [modifier])).toEqual({ retained: [modifier], removed: [] });
    }
    expect(swapCandidates([line("burger", "burger", 1, ["no_onions"])], onlyPair("burger", "cmu_109_cheeseburger"), ["burger"], CATALOG)).toEqual([]);
  });
});

describe("revision-bound swap transaction", () => {
  it("accepts atomically with quantity and row identity preserved, discloses removed paid options, then undoes and replays", () => {
    const config = onlyPair("burger", "cmu_188_smash_d_bacon_burger");
    let state = act(createEngine("swap-accept", { catalog: CATALOG, waitConfig: config }), { type: "MANUAL", ops: [add("burger", 3, ["double"])] });
    const before = getView(state);
    const offer = before.swapOffer!;
    expect(offer).toMatchObject({ quantity: 3, removedModifiers: ["double"], retainedModifiers: [], priceDifferenceCents: 0, original: { unitPriceCents: 1050 }, alternative: { unitPriceCents: 1050 } });
    expect(offer.differences.join(" ")).toMatch(/removes double/i);
    state = act(state, { type: "ACCEPT_SWAP", offerId: offer.offerId, revision: offer.revision });
    expect(state.lastOutcome).toBe("applied");
    expect(getView(state).lines).toEqual([{ ...before.lines[0], itemId: "cmu_188_smash_d_bacon_burger", modifiers: [] }]);
    expect(getView(state).totalCents).toBe(3150);
    expect(getView(state).wait?.estimateMinutes).toBe(10);
    expect(getView(state).swapOffer).toBeNull();
    expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state));
    state = act(state, { type: "UNDO" });
    expect(getView(state).lines).toEqual(before.lines);
    expect(getView(state).lastLineId).toBe(before.lastLineId);
    expect(getView(state).wait?.estimateMinutes).toBe(20);
    expect(getView(state).swapOffer).toBeNull();
    expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state));
  });

  it("offers at most one newly added line and never adds an offer for quantity edits or Undo", () => {
    let state = act(createEngine("new-lines", { catalog: CATALOG, waitConfig: configuration() }), { type: "MANUAL", ops: [add(india), add(india)] });
    expect(getView(state).swapOffer?.originalLineId).toBe(getView(state).lines[0].lineId);
    state = act(state, { type: "MANUAL", ops: [{ type: "SET_QTY", ref: { by: "last" }, qty: 2 }] });
    expect(getView(state).swapOffer).toBeNull();
    state = act(state, { type: "UNDO" });
    expect(getView(state).swapOffer).toBeNull();
    state = act(state, { type: "CLEAR" });
    expect(getView(state).wait).toMatchObject({ status: "empty", estimateMinutes: null, lineWaits: {} });
    expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state));
  });

  it.each(["input", "decline", "edit", "review"] as const)("dismisses on %s, rejects the old acceptance, and reproduces suppression during replay", (dismissal) => {
    let state = act(createEngine(`dismiss-${dismissal}`, { catalog: CATALOG, waitConfig: configuration() }), { type: "MANUAL", ops: [add(india)] });
    const offer = getView(state).swapOffer!;
    if (dismissal === "input") state = reduceEngine(state, { type: "INPUT_STARTED" });
    if (dismissal === "decline") state = act(state, { type: "DECLINE_SWAP", offerId: offer.offerId });
    if (dismissal === "edit") state = act(state, { type: "MANUAL", ops: [{ type: "SET_QTY", ref: { by: "last" }, qty: 2 }] });
    if (dismissal === "review") state = act(state, { type: "REVIEW" });
    const before = getView(state).lines;
    expect(getView(state).swapOffer).toBeNull();
    expect(state.suppressedLineIds).toContain(offer.originalLineId);
    state = act(state, { type: "ACCEPT_SWAP", offerId: offer.offerId, revision: offer.revision });
    expect(state.lastCode).toBe("STALE_OFFER");
    expect(getView(state).lines).toEqual(before);
    expect(getView(state).review).toBeNull();
    expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state));
  });

  it("rejects wrong offer IDs/revisions and a repeated acceptance without a second cart change", () => {
    for (const wrong of ["id", "revision"] as const) {
      let state = act(createEngine(`wrong-${wrong}`, { catalog: CATALOG, waitConfig: configuration() }), { type: "MANUAL", ops: [add(india)] });
      const before = getView(state);
      state = act(state, { type: "ACCEPT_SWAP", offerId: wrong === "id" ? "wrong" : before.swapOffer!.offerId, revision: before.revision + (wrong === "revision" ? 1 : 0) });
      expect(state.lastCode).toBe("STALE_OFFER");
      expect(getView(state).lines).toEqual(before.lines);
    }
    let state = act(createEngine("repeat", { catalog: CATALOG, waitConfig: configuration() }), { type: "MANUAL", ops: [add(india)] });
    const offer = getView(state).swapOffer!;
    const accept = { type: "ACCEPT_SWAP", offerId: offer.offerId, revision: offer.revision } as const;
    state = act(state, accept);
    const after = getView(state).lines;
    state = act(state, accept);
    expect(state.lastCode).toBe("STALE_OFFER");
    expect(getView(state).lines).toEqual(after);
    expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state));
  });

  it("recomputes the offer rather than trusting a changed snapshot, line, or displayed price", () => {
    const state = act(createEngine("revalidate", { catalog: CATALOG, waitConfig: configuration() }), { type: "MANUAL", ops: [add(india)] });
    const offer = getView(state).swapOffer!;
    for (const tampered of [
      { ...state, waitConfig: { ...state.waitConfig!, snapshot: { ...state.waitConfig!.snapshot, id: "changed" } } },
      { ...state, waitConfig: { ...state.waitConfig!, snapshot: { ...state.waitConfig!.snapshot, waits: {} } } },
      { ...state, view: { ...state.view, lines: state.view.lines.map(row => ({ ...row, qty: 2 })) } },
      { ...state, view: { ...state.view, swapOffer: { ...offer, priceDifferenceCents: -999 } } },
    ]) {
      const next = act(tampered, { type: "ACCEPT_SWAP", offerId: offer.offerId, revision: offer.revision });
      expect(next.lastCode).toBe("STALE_OFFER");
      expect(getView(next).lines).toEqual(tampered.view.lines);
    }
  });

  it("cannot leak a swap or new item out of a batch whose later operation is invalid", () => {
    let state = act(createEngine("failed-batch", { catalog: CATALOG, waitConfig: configuration() }), { type: "MANUAL", ops: [add("burger")] });
    const before = getView(state).lines;
    state = act(state, { type: "MANUAL", ops: [add(india), { type: "MOD", ref: { by: "item", itemId: india }, modifier: "double", enabled: true }] });
    expect(state.lastCode).toBe("INVALID_MODIFIER");
    expect(getView(state).lines).toEqual(before);
    expect(getView(state).swapOffer).toBeNull();
    expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state));
  });
});
