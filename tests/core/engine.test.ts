import { describe, expect, it } from "vitest";
import { MENU_VERSION, OrderViewSchema, type AuditEvent, type Op, type ParseResponse, type UiAction } from "@/contracts";
import { createEngine, exportLog, getView, reduceEngine, replayLog, type EngineState } from "@/core/engine";

const add = (itemId: "burger" | "fries" | "lemonade", qty = 1): Op => ({ type: "ADD", itemId, qty, modifiers: [] });
const ui = (state: EngineState, action: UiAction) => reduceEngine(state, { type: "UI", action });
const manual = (state: EngineState, ...ops: Op[]) => ui(state, { type: "MANUAL", ops });
const input = (state: EngineState) => reduceEngine(state, { type: "INPUT_STARTED" });
const response = (state: EngineState, requestId: string, ops: Op[]): ParseResponse => ({
  v: 2, menuVersion: MENU_VERSION, requestId, baseRevision: state.view.revision,
  parser: "rules", fallbackReason: null, result: { kind: "proposal", ops },
});
const receive = (state: EngineState, result: ParseResponse) => reduceEngine(state, { type: "PARSE_RECEIVED", response: result });

function order(): EngineState {
  const initial = input(createEngine("test-session"));
  return receive(initial, response(initial, "u1", [add("burger"), add("fries"), add("lemonade")]));
}

describe("pure order transactions", () => {
  it("runs the shared 1350 → 1600 → undo 1350 journey with exact line IDs", () => {
    let state = order();
    expect(state.view.lines.map((line) => line.lineId)).toEqual(["u1:0", "u1:1", "u1:2"]);
    expect(state.view.totalCents).toBe(1350);
    state = input(state);
    state = receive(state, response(state, "u2", [{ type: "MOD", ref: { by: "item", itemId: "burger" }, modifier: "double", enabled: true }]));
    expect(state.view.totalCents).toBe(1600);
    const revision = state.view.revision;
    state = ui(state, { type: "UNDO" });
    expect(state.view.totalCents).toBe(1350);
    expect(state.view.lastLineId).toBe("u1:2");
    expect(state.view.revision).toBeGreaterThan(revision);
  });

  it("rejects an invalid operation at the end without applying earlier operations", () => {
    const state = order();
    const next = manual(state, add("burger"), { type: "MOD", ref: { by: "item", itemId: "lemonade" }, modifier: "double", enabled: true });
    expect(next.lastCode).toBe("INVALID_MODIFIER");
    expect(next.view.lines).toEqual(state.view.lines);
    expect(next.view.totalCents).toBe(1350);
    expect(next.history).toEqual(state.history);
  });

  it("rejects invalid ADD pairings, duplicates, off-menu IDs, and quantities without clamping", () => {
    const state = order();
    for (const op of [
      { type: "ADD", itemId: "lemonade", qty: 1, modifiers: ["double"] },
      { type: "ADD", itemId: "burger", qty: 1, modifiers: ["double", "double"] },
      { type: "ADD", itemId: "pizza", qty: 1, modifiers: [] },
      ...[0, -1, 6, 18000, 1.5].map((qty) => ({ type: "ADD", itemId: "lemonade", qty, modifiers: [] })),
    ]) {
      const next = manual(state, op as Op);
      expect(next.lastOutcome).toBe("rejected");
      expect(next.view.lines).toEqual(state.view.lines);
      expect(replayLog(exportLog(next))).toEqual(getView(next));
    }
  });

  it("keeps quantities at most five, cart at most five lines and ten total units", () => {
    const two = manual(createEngine("bounds"), add("burger", 5), add("fries", 5));
    expect(two.view.lines).toHaveLength(2);
    expect(manual(two, add("lemonade")).lastCode).toBe("CART_LIMIT");
    const five = manual(createEngine("lines"), ...Array.from({ length: 5 }, () => add("fries")));
    expect(five.view.lines).toHaveLength(5);
    expect(manual(five, add("fries")).lastCode).toBe("CART_LIMIT");
    const replace = manual(two, { type: "SET_QTY", ref: { by: "last" }, qty: 1 }, add("lemonade", 4));
    expect(replace.view.lines.reduce((sum, line) => sum + line.qty, 0)).toBe(10);
  });

  it("resolves references sequentially on the temporary cart", () => {
    const state = manual(createEngine("sequential"), add("burger"), {
      type: "MOD", ref: { by: "last" }, modifier: "double", enabled: true,
    }, { type: "SET_QTY", ref: { by: "item", itemId: "burger" }, qty: 2 });
    expect(state.view.lines).toEqual([{ lineId: "sequential:ui:1:0", itemId: "burger", qty: 2, modifiers: ["double"] }]);
    expect(state.view.totalCents).toBe(2100);
  });

  it("rejects zero matches and never guesses the last referent", () => {
    const state = createEngine("references");
    for (const ref of [{ by: "last" }, { by: "item", itemId: "burger" }, { by: "line", lineId: "missing" }] as const) {
      expect(manual(state, { type: "REMOVE", ref }).lastCode).toBe("UNKNOWN_REFERENCE");
    }
  });

  it("represents repeated ADDs separately and targets a selected ambiguous line", () => {
    let state = order();
    state = manual(state, add("burger"));
    const original = getView(state);
    const secondBurger = state.view.lines.at(-1)!.lineId;
    state = manual(state, { type: "REMOVE", ref: { by: "item", itemId: "burger" } });
    expect(state.lastOutcome).toBe("clarify");
    expect(state.view.lines).toEqual(original.lines);
    expect(state.view.pending?.choices).toHaveLength(2);
    const pending = state.view.pending!;
    expect(pending.choices[1].ops).toEqual([{ type: "REMOVE", ref: { by: "line", lineId: secondBurger } }]);
    state = ui(state, { type: "CHOOSE", pendingId: pending.id, choiceId: pending.choices[1].id });
    expect(state.view.lines.map((line) => line.lineId)).toEqual(["u1:0", "u1:1", "u1:2"]);
    expect(state.view.lastLineId).toBeNull();
    expect(state.view.pending).toBeNull();
  });

  it("preserves original ADD operation IDs when an entire ambiguous batch is selected", () => {
    let state = manual(createEngine("choice-ids"), add("burger"), add("burger"));
    state = input(state);
    state = receive(state, response(state, "ambiguous-request", [
      add("fries"), { type: "REMOVE", ref: { by: "item", itemId: "burger" } },
      { type: "SET_QTY", ref: { by: "line", lineId: "ambiguous-request:0" }, qty: 2 },
    ]));
    expect(state.view.lines).toHaveLength(2);
    const pending = state.view.pending!;
    expect(pending.choices[0].ops).toHaveLength(3);
    state = ui(state, { type: "CHOOSE", pendingId: pending.id, choiceId: pending.choices[0].id });
    expect(state.view.lines.at(-1)).toEqual({ lineId: "ambiguous-request:0", itemId: "fries", qty: 2, modifiers: [] });
    expect(replayLog(exportLog(state))).toEqual(getView(state));
  });

  it("rejects multiple ambiguities and more than three matching lines", () => {
    const state = manual(createEngine("multi"), add("burger"), add("burger"), add("fries"), add("fries"));
    const next = manual(state,
      { type: "REMOVE", ref: { by: "item", itemId: "burger" } },
      { type: "REMOVE", ref: { by: "item", itemId: "fries" } },
    );
    expect(next.lastCode).toBe("AMBIGUOUS_REFERENCE");
    expect(next.view.pending).toBeNull();
    expect(next.view.lines).toEqual(state.view.lines);
    const four = manual(createEngine("four"), ...Array.from({ length: 4 }, () => add("burger")));
    expect(manual(four, { type: "REMOVE", ref: { by: "item", itemId: "burger" } }).lastOutcome).toBe("rejected");
  });

  it("checks the full batch beyond ambiguity, rejecting a hidden invalid pairing", () => {
    const state = manual(createEngine("hidden"), add("burger"), add("burger"), add("lemonade"));
    const next = manual(state,
      { type: "REMOVE", ref: { by: "item", itemId: "burger" } },
      { type: "MOD", ref: { by: "item", itemId: "lemonade" }, modifier: "double", enabled: true },
    );
    expect(next.lastCode).toBe("INVALID_MODIFIER");
    expect(next.view.lines).toEqual(state.view.lines);
    expect(next.view.pending).toBeNull();
  });

  it("revalidates parser choices and invalidates them at the next input", () => {
    let state = order();
    state = input(state);
    const envelope = response(state, "parser-choice", [add("burger")]);
    envelope.result = { kind: "clarify", question: "Which edit?", choices: [
      { id: "bad", label: "Invalid lemonade", ops: [{ type: "MOD", ref: { by: "item", itemId: "lemonade" }, modifier: "double", enabled: true }] },
      { id: "good", label: "Fries", ops: [add("fries")] },
    ] };
    const pendingState = receive(state, envelope);
    const pending = pendingState.view.pending!;
    const rejected = ui(pendingState, { type: "CHOOSE", pendingId: pending.id, choiceId: "bad" });
    expect(rejected.lastCode).toBe("INVALID_MODIFIER");
    expect(rejected.view.lines).toEqual(state.view.lines);
    const abandoned = input(pendingState);
    expect(ui(abandoned, { type: "CHOOSE", pendingId: pending.id, choiceId: "good" }).lastCode).toBe("NO_PENDING");
  });

  it("can resolve one engine reference ambiguity after a parser choice but rejects two", () => {
    const state = manual(createEngine("nested"), add("burger"), add("burger"), add("fries"), add("fries"));
    const clarify = response(state, "nested-request", [add("burger")]);
    clarify.result = { kind: "clarify", question: "Which edit?", choices: [
      { id: "single", label: "Remove a burger", ops: [{ type: "REMOVE", ref: { by: "item", itemId: "burger" } }] },
      { id: "multiple", label: "Remove burger and fries", ops: [
        { type: "REMOVE", ref: { by: "item", itemId: "burger" } },
        { type: "REMOVE", ref: { by: "item", itemId: "fries" } },
      ] },
    ] };
    const pendingState = receive(state, clarify);
    const pending = pendingState.view.pending!;
    const single = ui(pendingState, { type: "CHOOSE", pendingId: pending.id, choiceId: "single" });
    expect(single.lastOutcome).toBe("clarify");
    expect(single.view.pending?.choices).toHaveLength(2);
    expect(single.view.lines).toEqual(state.view.lines);
    const resolved = ui(single, { type: "CHOOSE", pendingId: single.view.pending!.id, choiceId: "option-2" });
    expect(resolved.view.lines).toHaveLength(3);
    expect(replayLog(exportLog(resolved))).toEqual(getView(resolved));
    const multiple = ui(pendingState, { type: "CHOOSE", pendingId: pending.id, choiceId: "multiple" });
    expect(multiple.lastOutcome).toBe("rejected");
    expect(multiple.lastCode).toBe("AMBIGUOUS_REFERENCE");
    expect(multiple.view.pending).toBeNull();
  });

  it("advances revision on entering and resolving clarification", () => {
    let state = manual(createEngine("revisions"), add("burger"), add("burger"));
    const before = state.view.revision;
    state = manual(state, { type: "REMOVE", ref: { by: "item", itemId: "burger" } });
    expect(state.view.revision).toBe(before + 1);
    const pending = state.view.pending!;
    state = ui(state, { type: "CHOOSE", pendingId: pending.id, choiceId: "option-1" });
    expect(state.view.revision).toBe(before + 2);
  });

  it("undo restores the prior cart and referent while preserving append-only audit", () => {
    let state = order();
    state = manual(state, { type: "SET_QTY", ref: { by: "line", lineId: "u1:0" }, qty: 2 });
    const beforeRemove = getView(state);
    state = manual(state, { type: "REMOVE", ref: { by: "last" } });
    expect(state.view.lastLineId).toBeNull();
    const audit = getView(state).audit;
    const revision = state.view.revision;
    state = ui(state, { type: "UNDO" });
    expect(state.view.lines).toEqual(beforeRemove.lines);
    expect(state.view.lastLineId).toBe("u1:0");
    expect(state.view.revision).toBe(revision + 1);
    expect(state.view.audit.slice(0, -1)).toEqual(audit);
    state = ui(state, { type: "CLEAR" });
    expect(state.view.lines).toEqual([]);
    state = ui(state, { type: "UNDO" });
    expect(state.view.lines).toEqual(beforeRemove.lines);
    expect(state.view.lastLineId).toBe("u1:0");
  });

  it("does not restore stale review on undo and handles empty undo", () => {
    expect(ui(createEngine("undo"), { type: "UNDO" }).lastCode).toBe("NO_UNDO");
    let state = ui(order(), { type: "REVIEW" });
    state = manual(state, add("fries"));
    state = ui(state, { type: "UNDO" });
    expect(state.view.totalCents).toBe(1350);
    expect(state.view.review).toBeNull();
  });

  it("deduplicates applied, rejected, and stale response IDs", () => {
    const state = input(createEngine("dedup"));
    const proposal = response(state, "request", [add("burger")]);
    const accepted = receive(state, proposal);
    const duplicate = receive(accepted, proposal);
    expect(duplicate.lastOutcome).toBe("ignored");
    expect(duplicate.view.lines).toEqual(accepted.view.lines);
    expect(duplicate.view.revision).toBe(accepted.view.revision);
    const rejectedEnvelope = response(state, "rejected", [add("burger")]);
    rejectedEnvelope.result = { kind: "reject", code: "UNSUPPORTED", message: "Split the utterance." };
    const rejected = receive(state, rejectedEnvelope);
    expect(receive(rejected, rejectedEnvelope).lastCode).toBe("STALE_RESPONSE");
    const staleEnvelope = { ...proposal, requestId: "stale", baseRevision: state.view.revision + 1 };
    const stale = receive(state, staleEnvelope);
    expect(receive(input(stale), staleEnvelope).lastOutcome).toBe("ignored");
  });

  it("ignores stale responses after manual edits, new input, and reset", () => {
    const state = input(createEngine("old-session"));
    const late = response(state, "late", [add("burger")]);
    for (const changed of [input(state), manual(state, add("fries")), createEngine("new-session")]) {
      const next = receive(changed, late);
      expect(next.lastCode).toBe("STALE_RESPONSE");
      expect(next.view.lines).toEqual(changed.view.lines);
    }
  });

  it("rejects malformed envelopes and generated line IDs over the 100-character cap", () => {
    const state = input(createEngine("malformed"));
    for (const patch of [{ v: 999 }, { menuVersion: "different" }, { balances: 100 }, { requestId: "" }]) {
      const next = receive(state, { ...response(state, "valid", [add("burger")]), ...patch } as ParseResponse);
      expect(next.lastCode).toBe("INVALID_SCHEMA");
      expect(next.view.lines).toEqual([]);
      expect(replayLog(exportLog(next))).toEqual(getView(next));
    }
    expect(receive(state, response(state, "a".repeat(100), [add("burger")])).lastCode).toBe("INVALID_SCHEMA");
    const longest = manual(createEngine("s".repeat(100)), add("burger"));
    expect(longest.lastCode).toBe("INVALID_SCHEMA");
    expect(OrderViewSchema.safeParse(longest.view).success).toBe(true);
  });
});

describe("review and simulated confirmation", () => {
  it("requires a nonempty cart and an explicit review", () => {
    const empty = createEngine("empty");
    expect(ui(empty, { type: "REVIEW" }).lastCode).toBe("EMPTY_CART");
    expect(ui(order(), { type: "CONFIRM", reviewId: "invented", revision: 2 }).lastCode).toBe("REVIEW_REQUIRED");
    let ambiguous = manual(order(), add("burger"));
    ambiguous = manual(ambiguous, { type: "REMOVE", ref: { by: "item", itemId: "burger" } });
    expect(ui(ambiguous, { type: "REVIEW" }).lastOutcome).toBe("rejected");
  });

  it("invalidates review at input start before asynchronous parsing completes", () => {
    const reviewed = ui(order(), { type: "REVIEW" });
    const review = reviewed.view.review!;
    const capturing = input(reviewed);
    expect(capturing.view.review).toBeNull();
    expect(capturing.view.revision).toBe(reviewed.view.revision + 1);
    expect(ui(capturing, { type: "CONFIRM", reviewId: review.id, revision: review.revision }).lastCode).toBe("REVIEW_REQUIRED");
  });

  it("invalidates review even for rejected manual and malformed edit attempts", () => {
    const reviewed = ui(order(), { type: "REVIEW" });
    for (const next of [
      manual(reviewed, { type: "MOD", ref: { by: "item", itemId: "lemonade" }, modifier: "double", enabled: true }),
      manual(reviewed, add("burger", 18000)),
      ui(reviewed, { type: "CHOOSE", pendingId: "expired", choiceId: "expired" }),
    ]) {
      expect(next.lastOutcome).toBe("rejected");
      expect(next.view.review).toBeNull();
      expect(next.view.lines).toEqual(reviewed.view.lines);
      expect(next.view.revision).toBeGreaterThan(reviewed.view.revision);
      expect(replayLog(exportLog(next))).toEqual(getView(next));
    }
  });

  it("commits exactly the immutable review, returning one receipt for repeated confirmation", () => {
    const reviewed = ui(order(), { type: "REVIEW" });
    const publicView = getView(reviewed);
    const review = structuredClone(publicView.review!);
    publicView.review!.lines[0].qty = 5;
    publicView.lines[0].modifiers.push("double");
    publicView.audit.length = 0;
    const confirm: UiAction = { type: "CONFIRM", reviewId: review.id, revision: review.revision };
    const first = ui(reviewed, confirm);
    const second = ui(first, confirm);
    expect(first.view.receipt).toEqual({
      id: first.view.receipt!.id, reviewId: review.id, lines: review.lines,
      totalCents: 1350, simulated: true,
    });
    expect(second.view.receipt).toEqual(first.view.receipt);
    expect(second.view.revision).toBe(first.view.revision);
    expect(ui(second, { ...confirm, reviewId: "wrong" }).lastCode).toBe("REVIEW_REQUIRED");
    expect(ui(second, { ...confirm, revision: review.revision + 1 }).lastCode).toBe("REVIEW_REQUIRED");
    expect(replayLog(exportLog(second))).toEqual(getView(second));
  });

  it("does not allow committed sessions to be edited, undone, or cleared", () => {
    const reviewed = ui(order(), { type: "REVIEW" });
    const review = reviewed.view.review!;
    const committed = ui(reviewed, { type: "CONFIRM", reviewId: review.id, revision: review.revision });
    for (const event of [
      { type: "INPUT_STARTED" },
      { type: "UI", action: { type: "MANUAL", ops: [add("burger")] } },
      { type: "UI", action: { type: "UNDO" } },
      { type: "UI", action: { type: "CLEAR" } },
    ] as AuditEvent[]) {
      const next = reduceEngine(committed, event);
      expect(next.lastCode).toBe("SESSION_COMMITTED");
      expect(next.view.receipt).toEqual(committed.view.receipt);
      expect(next.view.lines).toEqual(committed.view.lines);
      expect(next.view.revision).toBe(committed.view.revision);
    }
    expect(createEngine("next-session").view.phase).toBe("editing");
  });
});

describe("audit export and deterministic read-only replay", () => {
  it("derives manual ADD IDs from session and recorded audit sequence", () => {
    let state = input(createEngine("deterministic"));
    state = manual(state, add("burger"));
    state = manual(state, add("fries"));
    expect(state.view.lines.map((line) => line.lineId)).toEqual(["deterministic:ui:2:0", "deterministic:ui:3:0"]);
    const before = getView(state);
    expect(replayLog(exportLog(state))).toEqual(before);
    expect(getView(state)).toEqual(before);
  });

  it("refuses forged outcomes, sequence gaps, unknown versions, and extra keys", () => {
    const raw = JSON.parse(exportLog(order()));
    for (const alter of [
      (log: typeof raw) => { log.audit[0].outcome = "ignored"; },
      (log: typeof raw) => { log.audit[1].seq = 5; },
      (log: typeof raw) => { log.menuVersion = "future"; },
      (log: typeof raw) => { log.price = 1; },
    ]) {
      const changed = structuredClone(raw);
      alter(changed);
      expect(() => replayLog(JSON.stringify(changed))).toThrow();
    }
  });

  it("refuses a different allowed rejection code even when the recorded outcome is unchanged", () => {
    const rejected = manual(createEngine("code-check"), {type:"REMOVE",ref:{by:"last"}});
    const log = JSON.parse(exportLog(rejected));
    expect(log.audit[0]).toMatchObject({outcome:"rejected",code:"UNKNOWN_REFERENCE"});
    log.audit[0].code = "NO_UNDO";
    expect(() => replayLog(JSON.stringify(log))).toThrow(/audit outcome differs/);
  });

  it("never mutates its incoming state or event", () => {
    const state = order();
    const event: AuditEvent = { type: "UI", action: { type: "MANUAL", ops: [add("burger")] } };
    const beforeState = structuredClone(state);
    const beforeEvent = structuredClone(event);
    const next = reduceEngine(state, event);
    expect(state).toEqual(beforeState);
    expect(event).toEqual(beforeEvent);
    if (event.action.type === "MANUAL") event.action.ops[0] = add("fries");
    expect(next.view.lines.at(-1)?.itemId).toBe("burger");
    expect(next.view.audit.at(-1)?.event).toEqual(beforeEvent);
  });
});
