import { describe, expect, it } from "vitest";
import { API_VERSION, MENU_VERSION, OrderViewSchema, type ItemId, type Op, type ParseResponse, type RequirementChange, type UiAction, type WaitEngineConfig } from "@/contracts";
import { createEngine, exportLog, getView, reduceEngine, replayLog, type EngineState } from "@/core/engine";
import { swapCandidates } from "@/core/waits";

const ui = (state: EngineState, action: UiAction) => reduceEngine(state, { type: "UI", action });
const manual = (state: EngineState, ...ops: Op[]) => ui(state, { type: "MANUAL", ops });
const add = (itemId: ItemId = "burger", note?: string): Op => ({ type: "ADD", itemId, qty: 1, modifiers: [], ...(note === undefined ? {} : { note }) });
const set = (note: string): Op => ({ type: "SET_NOTE", ref: { by: "last" }, note });
const changes = (state: EngineState, ...values: RequirementChange[]) => ui(state, { type: "REQUIREMENTS", locationId: "demo", changes: values });
const receive = (state: EngineState, result: ParseResponse["result"], requestId = "note-response") => reduceEngine(state, { type: "PARSE_RECEIVED", response: { v: API_VERSION, menuVersion: MENU_VERSION, requestId, baseRevision: state.view.revision, parser: "fixture", fallbackReason: null, result } });
const verify = (state: EngineState) => { expect(OrderViewSchema.safeParse(getView(state)).success).toBe(true); expect(replayLog(exportLog(state))).toEqual(getView(state)); };
const decision = (state: EngineState, choiceId: string) => { const pending = state.view.requirements!.decision!; return ui(state, { type: "DECIDE_REQUIREMENTS", pendingId: pending.id, revision: pending.revision, choiceId }); };

describe("item notes as reversible staff requests", () => {
  it("adds and updates trimmed notes without changing item, price or supported modifiers", () => {
    let state = manual(createEngine("notes"), add("burger", "  Please cut in half  "));
    expect(state.view.lines[0]).toMatchObject({ itemId: "burger", note: "Please cut in half", modifiers: [], qty: 1 });
    expect(state.view.totalCents).toBe(800);
    state = manual(state, set("  Please serve ketchup separately  "));
    expect(state.view.lines[0].note).toBe("Please serve ketchup separately"); expect(state.view.totalCents).toBe(800);
    state = manual(state, { type: "SET_QTY", ref: { by: "last" }, qty: 2 }, { type: "MOD", ref: { by: "last" }, modifier: "double", enabled: true });
    expect(state.view.lines[0].note).toBe("Please serve ketchup separately"); expect(state.view.totalCents).toBe(2100); verify(state);
  });

  it("clears by omitting the field and Undo restores note and last referent", () => {
    let state = manual(createEngine("note-clear"), add("burger", "Cut in half"), add("fries")); const last = state.view.lastLineId;
    state = manual(state, { type: "SET_NOTE", ref: { by: "item", itemId: "burger" }, note: "  " });
    expect(state.view.lines[0]).not.toHaveProperty("note"); expect(state.view.lastLineId).toBe(state.view.lines[0].lineId);
    const revision = state.view.revision;
    state = ui(state, { type: "UNDO" }); expect(state.view.lines[0].note).toBe("Cut in half"); expect(state.view.lastLineId).toBe(last); expect(state.view.revision).toBeGreaterThan(revision); verify(state);
  });

  it("rolls back a whole batch when its late note is too long or another operation is invalid", () => {
    const original = manual(createEngine("notes-atomic"), add("burger", "Original"));
    for (const ops of [[add("fries"), set("n".repeat(161))], [set("Changed"), { type: "MOD", ref: { by: "item", itemId: "burger" }, modifier: "no_ice", enabled: true }] as Op[]] ) {
      const next = manual(original, ...ops); expect(next.lastOutcome).toBe("rejected"); expect(next.view.lines).toEqual(original.view.lines); expect(next.history).toEqual(original.history); verify(next);
    }
  });

  it("resolves notes sequentially and asks which repeated item instead of guessing", () => {
    const original = manual(createEngine("note-ambiguity"), add(), add());
    let state = manual(original, { type: "SET_NOTE", ref: { by: "item", itemId: "burger" }, note: "Cut this one" });
    expect(state.lastCode).toBe("AMBIGUOUS_REFERENCE"); expect(state.view.lines).toEqual(original.view.lines);
    const pending = state.view.pending!; expect(pending.choices).toHaveLength(2);
    state = ui(state, { type: "CHOOSE", pendingId: pending.id, choiceId: pending.choices[1].id });
    expect(state.view.lines[0]).not.toHaveProperty("note"); expect(state.view.lines[1].note).toBe("Cut this one"); verify(state);
    const next = manual(createEngine("note-sequence"), add(), set("A separate request")); expect(next.view.lines[0].note).toBe("A separate request");
    expect(manual(createEngine("note-none"), set("No target")).lastCode).toBe("UNKNOWN_REFERENCE");
    expect(manual(original, { type: "SET_NOTE", ref: { by: "line", lineId: "missing" }, note: "No target" }).lastCode).toBe("UNKNOWN_REFERENCE");
  });

  it("keeps note changes guarded by request revision and duplicate IDs", () => {
    const original = manual(createEngine("note-requests"), add());
    let state = receive(original, { kind: "proposal", ops: [set("Parsed request")] }); expect(state.view.lines[0].note).toBe("Parsed request");
    state = receive(state, { kind: "proposal", ops: [set("Duplicate request")] }); expect(state.lastCode).toBe("STALE_RESPONSE"); expect(state.view.lines[0].note).toBe("Parsed request"); verify(state);
  });

  it("invalidates review on a note edit and retains an immutable complete simulated receipt", () => {
    let state = manual(createEngine("note-receipt"), add("burger", "Cut in half")); state = ui(state, { type: "REVIEW" }); const old = state.view.review!;
    state = manual(state, set("Wrap separately")); expect(old.lines[0].note).toBe("Cut in half"); expect(state.view.review).toBeNull();
    state = ui(state, { type: "CONFIRM", reviewId: old.id, revision: old.revision }); expect(state.view.receipt).toBeNull();
    state = ui(state, { type: "REVIEW" }); const review = state.view.review!; state = ui(state, { type: "CONFIRM", reviewId: review.id, revision: review.revision });
    expect(state.view.receipt!.lines[0].note).toBe("Wrap separately"); expect(state.view.receipt!.totalCents).toBe(800);
    const exposed = getView(state); exposed.receipt!.lines[0].note = "Changed externally";
    expect(state.view.receipt!.lines[0].note).toBe("Wrap separately"); expect(manual(state, set("Too late")).lastCode).toBe("SESSION_COMMITTED"); verify(state);
  });

  it("never interprets a note as permission to bypass allergy or modifier validation", () => {
    const restricted = changes(createEngine("note-allergy"), { type: "ADD_ALLERGY", allergen: "sesame" });
    const blocked = manual(restricted, add("burger", "No sesame; allergy-safe please"));
    expect(blocked.lastCode).toBe("STAFF_REVIEW_REQUIRED"); expect(blocked.view.lines).toEqual([]);
    expect(blocked.view.requirements!.profile.allergies).toEqual(["sesame"]); verify(blocked);
    let existing = manual(createEngine("note-existing-allergy"), add()); existing = changes(existing, { type: "ADD_ALLERGY", allergen: "sesame" });
    existing = manual(existing, set("Please remove sesame")); expect(existing.view.lines[0].note).toBe("Please remove sesame");
    expect(ui(existing, { type: "REVIEW" }).lastCode).toBe("STAFF_REVIEW_REQUIRED");
    const forged = manual(createEngine("note-modifier"), { type: "ADD", itemId: "lemonade", qty: 1, modifiers: ["double"], note: "Staff can do this" });
    expect(forged.lastCode).toBe("INVALID_MODIFIER"); expect(forged.view.lines).toEqual([]);
  });

  it("preserves notes on same-item meal rebuilds without transferring them to replacement food", () => {
    let state = changes(createEngine("note-meal"), { type: "SET_BUDGET", budgetCents: 1200 }, { type: "SELECT_ITEM", itemId: "fries", modifiers: [], locked: true }, { type: "SELECT_ITEM", itemId: "lemonade", modifiers: [], locked: true });
    state = manual(state, { type: "SET_NOTE", ref: { by: "item", itemId: "grilled_cheese" }, note: "Cut in triangles" }, { type: "SET_NOTE", ref: { by: "item", itemId: "fries" }, note: "Separate bag" });
    state = changes(state, { type: "SET_BUDGET", budgetCents: 1500 }); expect(state.view.lines[0].note).toBe("Cut in triangles"); expect(state.view.lines[1].note).toBe("Separate bag");
    state = changes(state, { type: "SELECT_ITEM", itemId: "chicken_sandwich", modifiers: [], locked: false });
    expect(state.view.lines[0].itemId).toBe("chicken_sandwich"); expect(state.view.lines[0]).not.toHaveProperty("note"); expect(state.view.lines[1].note).toBe("Separate bag");
    state = ui(state, { type: "UNDO" }); expect(state.view.lines[0].note).toBe("Cut in triangles"); verify(state);
  });

  it("retains notes from mixed requirement operations in accepted and pending meal snapshots", () => {
    let state = receive(createEngine("note-mixed-meal"), { kind: "requirements", locationId: "demo", changes: [{ type: "SET_BUDGET", budgetCents: 1100 }], ops: [add("fries", "Separate bag")] });
    expect(state.view.lines.find(line => line.itemId === "fries")!.note).toBe("Separate bag");
    state = receive(state, { kind: "requirements", locationId: "demo", changes: [{ type: "SET_BUDGET", budgetCents: 1000 }], ops: [{ type: "SET_NOTE", ref: { by: "item", itemId: "fries" }, note: "No paper liner please" }] }, "mixed-followup");
    expect(state.view.lines.find(line => line.itemId === "fries")!.note).toBe("Separate bag");
    expect(state.view.requirements!.decision!.proposedLines.find(line => line.itemId === "fries")!.note).toBe("No paper liner please");
    state = decision(state, "raise_budget"); expect(state.view.lines.find(line => line.itemId === "fries")!.note).toBe("No paper liner please"); verify(state);
  });

  it("withholds wait swaps for a noted item and rejects the offer invalidated by adding a note", () => {
    const first = "cmu_114_bottled-water"; const second = "cmu_92_bottled-water";
    const config: WaitEngineConfig = { snapshot: { id: "note-wait-fixture", source: "seeded", asOf: "2026-09-12T14:00:00.000Z", waits: { "114": 20, "92": 10 } }, available: true, unavailableReason: null, evaluatedAt: "2026-09-12T14:00:00.000Z", groups: [{ id: "test-water", itemIds: [first, second], differences: { [first]: "Fixture water A", [second]: "Fixture water B" } }], nearbyPairs: [{ vendors: ["114", "92"], sourceUrl: "https://www.cmu.edu/", note: "Synthetic fixture pairing" }], swapThresholdMinutes: 5, priceToleranceCents: 100 };
    const noted = manual(createEngine("note-swap", config), add(first, "Room temperature please"));
    expect(noted.view.swapOffer).toBeNull(); expect(swapCandidates(noted.view.lines, config, [noted.view.lines[0].lineId])).toEqual([]);
    let state = manual(createEngine("note-swap-stale", config), add(first)); const offer = state.view.swapOffer!; expect(offer).not.toBeNull();
    state = manual(state, set("Room temperature please")); state = ui(state, { type: "ACCEPT_SWAP", offerId: offer.offerId, revision: offer.revision });
    expect(state.lastCode).toBe("STALE_OFFER"); expect(state.view.lines[0]).toMatchObject({ itemId: first, note: "Room temperature please" }); verify(state);
  });
});
