import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { MENU_VERSION, OrderViewSchema, type AuditEvent, type ItemId, type ModifierId, type Op, type ParseResponse } from "@/contracts";
import { MENU, MODIFIERS } from "@/contracts/menu";
import { createEngine, exportLog, getView, reduceEngine, replayLog, type EngineState } from "@/core/engine";

// Reproduce this run with: npm test -- tests/core/engine.property.test.ts
export const PROPERTY_SEED = 20260912;
const ITEMS: ItemId[] = ["burger", "fries", "lemonade"];
const MODIFIERS_IDS: ModifierId[] = ["no_onions", "double", "extra_cheese"];
type Descriptor = { kind: number; item: number; qty: number; modifier: number; flag: boolean };
const descriptor = fc.record({
  kind: fc.integer({ min: 0, max: 15 }),
  item: fc.integer({ min: 0, max: 2 }),
  qty: fc.integer({ min: -1, max: 7 }),
  modifier: fc.integer({ min: 0, max: 2 }),
  flag: fc.boolean(),
});

function add(itemId: ItemId, qty = 1): Op {
  return { type: "ADD", itemId, qty, modifiers: [] };
}

function envelope(state: EngineState, requestId: string, ops: Op[]): ParseResponse {
  return {
    v: 1, menuVersion: MENU_VERSION, requestId, baseRevision: state.view.revision,
    parser: "rules", fallbackReason: null, result: { kind: "proposal", ops },
  };
}

function assertTransition(before: EngineState, event: AuditEvent): EngineState {
  const saved = structuredClone(before);
  const savedEvent = structuredClone(event);
  const state = reduceEngine(before, event);
  expect(before).toEqual(saved);
  expect(event).toEqual(savedEvent);
  const view = getView(state);
  expect(OrderViewSchema.safeParse(view).success).toBe(true);
  expect(view.revision).toBeGreaterThanOrEqual(before.view.revision);
  expect(view.audit.slice(0, before.view.audit.length)).toEqual(before.view.audit);
  expect(view.lines.length).toBeLessThanOrEqual(5);
  expect(view.lines.reduce((sum, line) => sum + line.qty, 0)).toBeLessThanOrEqual(10);
  expect(new Set(view.lines.map((line) => line.lineId)).size).toBe(view.lines.length);
  expect(view.lastLineId === null || view.lines.some((line) => line.lineId === view.lastLineId)).toBe(true);
  let expectedTotal = 0;
  for (const line of view.lines) {
    expect(Number.isInteger(line.qty) && line.qty >= 1 && line.qty <= 5).toBe(true);
    expect(new Set(line.modifiers).size).toBe(line.modifiers.length);
    expect(line.modifiers.every((modifier) => MENU[line.itemId].allowedModifiers.includes(modifier))).toBe(true);
    expectedTotal += line.qty * (MENU[line.itemId].priceCents + line.modifiers.reduce((sum, modifier) => sum + MODIFIERS[modifier].priceCents, 0));
  }
  expect(view.totalCents).toBe(expectedTotal);
  if (state.lastOutcome === "rejected" || state.lastOutcome === "ignored" || state.lastOutcome === "clarify") {
    expect(view.lines).toEqual(before.view.lines);
    expect(view.lastLineId).toBe(before.view.lastLineId);
  }
  if (view.phase === "reviewing" || view.phase === "committed") {
    expect(view.review?.lines).toEqual(view.lines);
    expect(view.review?.revision).toBe(view.revision);
    expect(view.review?.totalCents).toBe(view.totalCents);
  } else {
    expect(view.review).toBeNull();
  }
  if (view.phase === "committed") {
    expect(view.receipt?.simulated).toBe(true);
    expect(view.receipt?.lines).toEqual(view.review?.lines);
    expect(view.receipt?.totalCents).toBe(view.review?.totalCents);
  }
  if (before.view.receipt) expect(view.receipt).toEqual(before.view.receipt);
  return state;
}

function runSequence(descriptors: Descriptor[]) {
  let state = createEngine("property-session");
  let latestResponse: ParseResponse | undefined;
  let counter = 0;
  const advance = (event: AuditEvent) => { state = assertTransition(state, event); counter += 1; };

  // Every generated sequence includes a late invalid operation, malformed
  // quantity, stale response and duplicate response; the random tail explores
  // their interaction with review, undo, pending choices and commitment.
  advance({ type: "UI", action: { type: "MANUAL", ops: [add("burger"), add("lemonade")] } });
  advance({ type: "UI", action: { type: "MANUAL", ops: [add("fries"), {
    type: "MOD", ref: { by: "item", itemId: "lemonade" }, modifier: "double", enabled: true,
  }] } });
  advance({ type: "UI", action: { type: "MANUAL", ops: [add("lemonade", 18000)] } });
  advance({ type: "PARSE_RECEIVED", response: { ...envelope(state, "stale-prefix", [add("fries")]), baseRevision: 200 } });
  latestResponse = envelope(state, "duplicate-prefix", [add("burger")]);
  advance({ type: "PARSE_RECEIVED", response: latestResponse });
  advance({ type: "PARSE_RECEIVED", response: latestResponse });
  advance({ type: "INPUT_STARTED" });

  for (const spec of descriptors) {
    const itemId = ITEMS[spec.item];
    const modifier = MODIFIERS_IDS[spec.modifier];
    const ref = spec.flag ? { by: "item" as const, itemId } : { by: "last" as const };
    let event: AuditEvent;
    switch (spec.kind) {
      case 0: event = { type: "INPUT_STARTED" }; break;
      case 1: event = { type: "UI", action: { type: "MANUAL", ops: [add(itemId, spec.qty)] } }; break;
      case 2: event = { type: "UI", action: { type: "MANUAL", ops: [{ type: "REMOVE", ref }] } }; break;
      case 3: event = { type: "UI", action: { type: "MANUAL", ops: [{ type: "SET_QTY", ref, qty: spec.qty }] } }; break;
      case 4: event = { type: "UI", action: { type: "MANUAL", ops: [{ type: "MOD", ref, modifier, enabled: spec.flag }] } }; break;
      case 5: event = { type: "UI", action: { type: "UNDO" } }; break;
      case 6: event = { type: "UI", action: { type: "CLEAR" } }; break;
      case 7: event = { type: "UI", action: { type: "REVIEW" } }; break;
      case 8: event = { type: "UI", action: {
        type: "CONFIRM", reviewId: state.view.review?.id ?? "missing",
        revision: spec.flag ? state.view.revision : state.view.revision + 1,
      } }; break;
      case 9: event = { type: "UI", action: {
        type: "CHOOSE", pendingId: state.view.pending?.id ?? "missing",
        choiceId: spec.flag ? state.view.pending?.choices[0]?.id ?? "missing" : "unknown-choice",
      } }; break;
      case 10:
        latestResponse = envelope(state, `current-${counter}`, [add(itemId, Math.max(1, Math.min(5, spec.qty)))]);
        event = { type: "PARSE_RECEIVED", response: latestResponse };
        break;
      case 11:
        latestResponse = { ...envelope(state, `stale-${counter}`, [add(itemId)]), baseRevision: state.view.revision + 1 };
        event = { type: "PARSE_RECEIVED", response: latestResponse };
        break;
      case 12: event = { type: "PARSE_RECEIVED", response: latestResponse }; break;
      case 13: event = { type: "PARSE_RECEIVED", response: { ...envelope(state, `malformed-${counter}`, [add(itemId)]), v: 2 } as unknown as ParseResponse }; break;
      case 14: event = { type: "PARSE_RECEIVED", response: {
        ...envelope(state, `clarify-${counter}`, [add(itemId)]),
        result: { kind: "clarify", question: "Which menu item?", choices: [
          { id: "burger", label: "Burger", ops: [add("burger")] },
          { id: "fries", label: "Fries", ops: [add("fries")] },
        ] },
      } }; break;
      default: event = { type: "UI", action: { type: "MANUAL", ops: [
        add(itemId), { type: "MOD", ref: { by: "last" }, modifier, enabled: true },
      ] } };
    }
    advance(event);
  }
  expect(counter).toBeLessThanOrEqual(50);
  const live = getView(state);
  const replay = replayLog(exportLog(state));
  expect(replay).toEqual(live);
  if (replay.lines.length) replay.lines[0].qty = 5;
  replay.audit.length = 0;
  expect(getView(state)).toEqual(live);
}

describe(`generated transaction evidence (seed ${PROPERTY_SEED})`, () => {
  it("verifies 1,000 generated sequences up to 50 events including invalid, stale, and duplicate events", () => {
    const fullLength: Descriptor[] = Array.from({ length: 43 }, (_, index) => ({
      kind: index % 16, item: index % 3, qty: (index % 9) - 1, modifier: index % 3, flag: index % 2 === 0,
    }));
    fc.assert(fc.property(fc.array(descriptor, { minLength: 0, maxLength: 43 }), runSequence), {
      seed: PROPERTY_SEED,
      numRuns: 1000,
      examples: [[fullLength]],
      endOnFailure: true,
    });
  }, 60000);
});
