import { afterEach, describe, expect, it } from "vitest";
import {
  API_VERSION, MENU_VERSION, type InterpretOptions, type ItemId, type LocationId, type Op,
  type ParseRequest, type ParseResponse, type ParseResult,
} from "@/contracts";
import { createOrderController } from "@/controller/controller";
import { createEngine, exportLog, getView, reduceEngine, replayLog } from "@/core/engine";

const burger = "cmu_188_smash_d_burger";
const fries = "cmu_188_fresh_cut_fries";
const add = (itemId: ItemId): Op => ({ type: "ADD", itemId, qty: 1, modifiers: [] });

// These deterministic fixture envelopes verify integration, not live parser accuracy.
function envelope(request: ParseRequest, result: ParseResult): ParseResponse {
  return { v: API_VERSION, menuVersion: MENU_VERSION, requestId: request.requestId, baseRevision: request.baseRevision, parser: "fixture", fallbackReason: null, result };
}

const stores: ReturnType<typeof createOrderController>[] = [];
afterEach(() => { stores.splice(0).forEach(store => store.dispose()); });

function deferredController(locationId: LocationId = "188") {
  const calls: { request: ParseRequest; options: InterpretOptions; resolve: (response: ParseResponse) => void }[] = [];
  const store = createOrderController({
    sessionId: () => "campus-controller", locationId,
    interpret: (request, options) => new Promise<ParseResponse>(resolve => { calls.push({ request, options, resolve }); }),
  });
  stores.push(store);
  return { store, calls };
}

describe("campus order transaction", () => {
  it("reviews, confirms once, and deterministically replays a $12.65 Stack'd burger and fries", () => {
    let engine = createEngine("campus-receipt");
    engine = reduceEngine(engine, { type: "UI", action: { type: "MANUAL", ops: [add(burger), add(fries)] } });
    expect(getView(engine).totalCents).toBe(1265);
    expect(getView(engine).lines.map(line => line.itemId)).toEqual([burger, fries]);
    engine = reduceEngine(engine, { type: "UI", action: { type: "REVIEW" } });
    const review = getView(engine).review!;
    expect(review.totalCents).toBe(1265);
    const confirm = { type: "UI", action: { type: "CONFIRM", reviewId: review.id, revision: review.revision } } as const;
    engine = reduceEngine(engine, confirm);
    const receipt = getView(engine).receipt;
    expect(receipt).toMatchObject({ reviewId: review.id, lines: review.lines, totalCents: 1265, simulated: true });
    engine = reduceEngine(engine, confirm);
    expect(getView(engine).receipt).toEqual(receipt);
    expect(getView(engine).phase).toBe("committed");
    expect(replayLog(exportLog(engine))).toEqual(getView(engine));
  });

  it("rejects a forged campus double modifier without applying an earlier valid operation in its batch", () => {
    let engine = createEngine("campus-atomic");
    engine = reduceEngine(engine, { type: "UI", action: { type: "MANUAL", ops: [add(burger)] } });
    const before = getView(engine);
    engine = reduceEngine(engine, { type: "UI", action: { type: "MANUAL", ops: [
      add(fries), { type: "MOD", ref: { by: "item", itemId: burger }, modifier: "double", enabled: true },
    ] } });
    expect(engine.lastOutcome).toBe("rejected");
    expect(engine.lastCode).toBe("INVALID_MODIFIER");
    expect(getView(engine).lines).toEqual(before.lines);
    expect(getView(engine).lastLineId).toBe(before.lastLineId);
    expect(getView(engine).totalCents).toBe(920);
    expect(replayLog(exportLog(engine))).toEqual(getView(engine));
    engine = reduceEngine(engine, { type: "UI", action: { type: "UNDO" } });
    expect(getView(engine).lines).toEqual([]);
  });

  it("keeps equal food names from different counters as distinct items with their own published prices", () => {
    let engine = createEngine("campus-water");
    engine = reduceEngine(engine, { type: "UI", action: { type: "MANUAL", ops: [
      add("cmu_114_bottled-water"), add("cmu_92_bottled-water"),
    ] } });
    expect(getView(engine).lines.map(line => line.itemId)).toEqual(["cmu_114_bottled-water", "cmu_92_bottled-water"]);
    expect(getView(engine).totalCents).toBe(430);
    engine = reduceEngine(engine, { type: "UI", action: { type: "MANUAL", ops: [{ type: "REMOVE", ref: { by: "item", itemId: "cmu_114_bottled-water" } }] } });
    expect(getView(engine).totalCents).toBe(235);
    expect(getView(engine).lines.map(line => line.itemId)).toEqual(["cmu_92_bottled-water"]);
    expect(replayLog(exportLog(engine))).toEqual(getView(engine));
  });

  it("preserves the cart while a counter change cancels capture, invalidates review, and ignores a late parse", async () => {
    const { store, calls } = deferredController();
    store.getSnapshot().act({ type: "MANUAL", ops: [add(burger)] });
    store.getSnapshot().act({ type: "REVIEW" });
    const before = store.getSnapshot().state;
    const review = before.review!;
    store.getSnapshot().setLocation("92");
    expect(store.getSnapshot().locationId).toBe("92");
    expect(store.getSnapshot().state.lines).toEqual(before.lines);
    expect(store.getSnapshot().state.review).toBeNull();
    expect(store.getSnapshot().state.revision).toBeGreaterThan(review.revision);
    store.getSnapshot().act({ type: "CONFIRM", reviewId: review.id, revision: review.revision });
    expect(store.getSnapshot().state.receipt).toBeNull();

    const submitting = store.getSnapshot().submit("A bottled water", "fixture", null);
    expect(calls[0].request.locationId).toBe("92");
    expect(calls[0].request.context?.lines).toEqual(before.lines);
    expect(store.getSnapshot().busy).toBe(true);
    store.getSnapshot().setLocation("114");
    expect(calls[0].options.signal?.aborted).toBe(true);
    expect(store.getSnapshot().busy).toBe(false);
    const switched = store.getSnapshot().state;
    calls[0].resolve(envelope(calls[0].request, { kind: "proposal", ops: [add("cmu_92_bottled-water")] }));
    await submitting;
    expect(store.getSnapshot().state).toEqual(switched);
    expect(store.getSnapshot().state.lines).toEqual(before.lines);
    expect(store.getSnapshot().parser).toBe("none");

    store.getSnapshot().startInput();
    expect(store.getSnapshot().busy).toBe(true);
    store.getSnapshot().setLocation("188");
    expect(store.getSnapshot().busy).toBe(false);
    expect(store.getSnapshot().state.lines).toEqual(before.lines);
    expect(replayLog(store.getSnapshot().exportLog())).toEqual(store.getSnapshot().state);
  });

  it("cannot revive a pending choice after switching away and back, including a hidden draft continuation", async () => {
    const { store, calls } = deferredController();
    store.getSnapshot().act({ type: "MANUAL", ops: [add(burger), add(burger)] });
    const before = store.getSnapshot().state.lines;
    const first = store.getSnapshot().submit("Remove one burger", "fixture", null);
    calls[0].resolve(envelope(calls[0].request, { kind: "proposal", ops: [{ type: "REMOVE", ref: { by: "item", itemId: burger } }] }));
    await first;
    const pending = store.getSnapshot().state.pending!;
    expect(pending.choices).toHaveLength(2);
    store.getSnapshot().startInput();
    expect(store.getSnapshot().state.pending).toBeNull();
    store.getSnapshot().setLocation("92");
    store.getSnapshot().setLocation("188");
    const resolution = store.getSnapshot().submit("The second one", "fixture", null);
    expect(calls[1].request.locationId).toBe("188");
    expect(calls[1].request.context?.pending).toBeNull();
    expect(calls[1].request.context?.recent).toEqual([]);
    calls[1].resolve(envelope(calls[1].request, { kind: "resolve", pendingId: pending.id, choiceId: pending.choices[1].id }));
    await resolution;
    expect(store.getSnapshot().state.lines).toEqual(before);
    expect(store.getSnapshot().state.pending).toBeNull();
    expect(store.getSnapshot().state.audit.at(-1)).toMatchObject({ outcome: "rejected", code: "NO_PENDING" });
    expect(store.getSnapshot().state.audit.filter(entry => entry.event.type === "INPUT_STARTED" && entry.event.discardContinuation)).toHaveLength(2);
    expect(replayLog(store.getSnapshot().exportLog())).toEqual(store.getSnapshot().state);
  });

  it("rejects an unknown counter at construction and on runtime selection without changing a valid review", () => {
    expect(() => createOrderController({ locationId: "invented-counter" as LocationId })).toThrow();
    const { store, calls } = deferredController();
    store.getSnapshot().act({ type: "MANUAL", ops: [add(burger)] });
    store.getSnapshot().act({ type: "REVIEW" });
    const before = store.getSnapshot().state;
    store.getSnapshot().setLocation("invented-counter" as LocationId);
    expect(store.getSnapshot().locationId).toBe("188");
    expect(store.getSnapshot().state).toEqual(before);
    expect(store.getSnapshot().notice).toMatch(/did not match the order format/i);
    expect(calls).toHaveLength(0);
  });
});
