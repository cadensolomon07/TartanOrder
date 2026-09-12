import { describe, expect, it } from "vitest";
import { API_VERSION, OrderViewSchema, type ItemId, type Op, type ParseResponse, type RequirementChange, type UiAction } from "@/contracts";
import { createEngine, exportLog, getView, reduceEngine, replayLog, type EngineState } from "@/core/engine";
import { CATALOG, MENU, MENU_VERSION } from "../helpers/catalog";

const setup = () => createEngine("meal-lifecycle", { catalog: CATALOG, allowedLocationIds: MENU.publicLocationIds });
const ui = (state: EngineState, action: UiAction) => reduceEngine(state, { type: "UI", action });
const change = (state: EngineState, ...changes: RequirementChange[]) => ui(state, { type: "REQUIREMENTS", locationId: state.view.requirements?.locationId ?? "demo", changes });
const add = (itemId: ItemId, qty = 1): Op => ({ type: "ADD", itemId, qty, modifiers: [] });
const manual = (state: EngineState, ...ops: Op[]) => ui(state, { type: "MANUAL", ops });
const exactMeal = () => change(setup(), { type: "SET_BUDGET", budgetCents: 1200 }, { type: "SELECT_ITEM", itemId: "fries", modifiers: [], locked: true }, { type: "SELECT_ITEM", itemId: "lemonade", modifiers: [], locked: true });
const choose = (state: EngineState, choiceId: string) => { const pending = state.view.requirements!.decision!; return ui(state, { type: "DECIDE_REQUIREMENTS", pendingId: pending.id, revision: pending.revision, choiceId }); };
const chicken = (state: EngineState) => change(state, { type: "SELECT_ITEM", itemId: "chicken_sandwich", modifiers: [], locked: false });
const receive = (state: EngineState, result: ParseResponse["result"], requestId = "meal-response") => reduceEngine(state, { type: "PARSE_RECEIVED", response: { v: API_VERSION, menuVersion: MENU_VERSION, requestId, baseRevision: state.view.revision, parser: "fixture", fallbackReason: null, result } });
const verify = (state: EngineState) => { expect(OrderViewSchema.safeParse(getView(state)).success).toBe(true); expect(replayLog(exportLog(state), CATALOG)).toEqual(getView(state)); };

describe("meal and dietary transaction lifecycle", () => {
  it("retains the $12 meal until the computed $14 decision is explicitly accepted, then reviews and replays", () => {
    const accepted = exactMeal(); expect(accepted.view.totalCents).toBe(1200);
    let state = chicken(accepted); expect(state.view.lines).toEqual(accepted.view.lines); expect(state.view.requirements!.meal!.budgetCents).toBe(1200);
    expect(state.view.requirements!.decision!.minimumCents).toBe(1400); expect(state.view.requirements!.decision!.choices.map(choice => choice.id)).toEqual(["keep", "raise_budget"]); verify(state);
    state = choose(state, "raise_budget"); expect(state.view.totalCents).toBe(1400); expect(state.view.requirements!.meal!.budgetCents).toBe(1400);
    state = ui(state, { type: "REVIEW" }); const review = state.view.review!;
    state = ui(state, { type: "CONFIRM", reviewId: review.id, revision: review.revision }); const receipt = state.view.receipt;
    state = ui(state, { type: "CONFIRM", reviewId: review.id, revision: review.revision }); expect(state.view.receipt).toEqual(receipt); expect(receipt?.totalCents).toBe(1400); verify(state);
  });

  it("declines without changing accepted requirements and computes below-minimum proposals honestly", () => {
    const accepted = exactMeal(); const kept = choose(chicken(accepted), "keep");
    expect(kept.view.lines).toEqual(accepted.view.lines); expect(kept.view.requirements!.meal).toEqual(accepted.view.requirements!.meal);
    const low = change(kept, { type: "SET_BUDGET", budgetCents: 1100 });
    expect(low.view.requirements!.decision!.minimumCents).toBe(1200); expect(low.view.requirements!.meal!.budgetCents).toBe(1200); expect(low.view.totalCents).toBe(1200); verify(low);
  });

  it("validates a manual replacement as an atomic budget proposal", () => {
    const original = exactMeal(); const next = manual(original, { type: "REMOVE", ref: { by: "item", itemId: "grilled_cheese" } }, add("chicken_sandwich"));
    expect(next.view.lines).toEqual(original.view.lines); expect(next.view.requirements!.decision!.minimumCents).toBe(1400);
    expect(choose(next, "raise_budget").view.totalCents).toBe(1400); verify(next);
  });

  it("requires explicit permission before changing a locked configuration", () => {
    let state = change(exactMeal(), { type: "SET_BUDGET", budgetCents: 2000 }, { type: "SELECT_ITEM", itemId: "grilled_cheese", modifiers: [], locked: true });
    const original = state.view.lines;
    state = manual(state, { type: "MOD", ref: { by: "item", itemId: "grilled_cheese" }, modifier: "extra_cheese", enabled: true });
    expect(state.view.lines).toEqual(original); expect(state.view.requirements!.decision!.kind).toBe("locked_item");
    state = choose(state, "replace_locked"); expect(state.view.lines.find(line => line.itemId === "grilled_cheese")!.modifiers).toEqual(["extra_cheese"]); expect(state.view.requirements!.meal!.lockedItemIds).not.toContain("grilled_cheese"); verify(state);
  });

  it("keeps separate items and quantities when meal mode cannot represent the accepted cart", () => {
    for (const original of [manual(setup(), add("fries", 2)), manual(setup(), add("burger"), add("chicken_sandwich"))]) {
      const next = change(original, { type: "SET_BUDGET", budgetCents: 2000 });
      expect(next.lastCode).toBe("REQUIREMENT_CONFLICT"); expect(next.view.lines).toEqual(original.view.lines); expect(next.view.requirements!.meal).toBeNull(); verify(next);
    }
    const original = exactMeal(); const changed = manual(original, { type: "SET_QTY", ref: { by: "item", itemId: "fries" }, qty: 2 });
    expect(changed.view.lines).toEqual(original.view.lines); expect(changed.view.requirements!.decision!.choices).toHaveLength(1); verify(changed);
  });

  it("does not drop repeated additions from a mixed declaration and operation batch", () => {
    const state = receive(setup(), { kind: "requirements", locationId: "demo", changes: [{ type: "SET_BUDGET", budgetCents: 3000 }], ops: [add("burger"), add("chicken_sandwich")] });
    expect(state.lastCode).toBe("REQUIREMENT_CONFLICT"); expect(state.view.lines).toEqual([]); expect(state.view.requirements!.meal).toBeNull(); verify(state);
  });

  it("keeps allergies while undo restores the accepted cart, meal, and counter together", () => {
    let state = change(exactMeal(), { type: "ADD_ALLERGY", allergen: "sesame" });
    state = change(state, { type: "SWITCH_LOCATION", locationId: "188" }); state = choose(state, "switch_counter");
    expect(state.view.requirements!.locationId).toBe("188"); expect(state.view.requirements!.meal).toBeNull();
    state = ui(state, { type: "UNDO" }); expect(state.view.requirements!.locationId).toBe("demo"); expect(state.view.requirements!.meal!.locationId).toBe("demo"); expect(state.view.requirements!.profile.allergies).toEqual(["sesame"]); expect(state.view.totalCents).toBe(1200); verify(state);
    expect(setup().view.requirements).toBeUndefined();
  });

  it("invalidates old decision clicks and blocks review while a spoken continuation remains unresolved", () => {
    let state = chicken(exactMeal()); const pending = state.view.requirements!.decision!;
    state = reduceEngine(state, { type: "INPUT_STARTED" }); expect(state.view.requirements!.decision).toBeNull();
    state = ui(state, { type: "DECIDE_REQUIREMENTS", pendingId: pending.id, revision: pending.revision, choiceId: "raise_budget" }); expect(state.lastCode).toBe("STALE_DECISION");
    state = ui(state, { type: "REVIEW" }); expect(state.view.review).toBeNull(); expect(state.lastCode).toBe("REQUIREMENT_CONFLICT");
    state = receive(state, { kind: "decide_requirements", pendingId: pending.id, choiceId: "raise_budget" }); expect(state.view.totalCents).toBe(1400); verify(state);
  });

  it("applies a dietary declaration even when the simultaneous incompatible item fails", () => {
    let state = receive(setup(), { kind: "requirements", locationId: "demo", changes: [{ type: "SET_DIETARY", preference: "vegan" }], ops: [add("grilled_cheese")] });
    expect(state.view.lines).toEqual([]); expect(state.view.requirements!.profile.preference).toBe("vegan");
    expect(state.view.requirements!.decision!.choices.map(choice => choice.id)).toEqual(["keep", "allow_preference"]);
    state = choose(state, "allow_preference"); expect(state.view.lines[0].itemId).toBe("grilled_cheese"); expect(state.view.requirements!.profile.exceptions[0].preference).toBe("vegan");
    state = change(state, { type: "ADD_ALLERGY", allergen: "milk" }); expect(state.view.requirements!.checks[0].staffReview).toBe(true);
    state = ui(state, { type: "REVIEW" }); expect(state.view.review).toBeNull(); expect(state.lastCode).toBe("STAFF_REVIEW_REQUIRED"); verify(state);
  });

  it("restores abandoned-input decision controls with a fresh identity and no restored review", () => {
    let state = chicken(exactMeal()); const previous = state.view.requirements!.decision!;
    state = reduceEngine(state, { type: "INPUT_STARTED" });
    state = ui(state, { type: "RESUME_REQUIREMENTS_DECISION" }); const resumed = state.view.requirements!.decision!;
    expect(resumed.id).not.toBe(previous.id); expect(resumed.revision).toBeGreaterThan(previous.revision); expect(resumed.proposedLines).toEqual(previous.proposedLines); expect(state.view.review).toBeNull();
    state = ui(state, { type: "DECIDE_REQUIREMENTS", pendingId: previous.id, revision: previous.revision, choiceId: "raise_budget" }); expect(state.lastCode).toBe("STALE_DECISION");
    state = choose(state, "raise_budget"); expect(state.view.totalCents).toBe(1400); verify(state);
  });

  it("rejects an entire late dietary-conflicting batch and keeps later allergy declarations through Undo", () => {
    let state = change(setup(), { type: "SET_DIETARY", preference: "vegan" }); state = manual(state, add("veggie_wrap")); const original = state.view.lines;
    state = manual(state, add("fries"), { type: "MOD", ref: { by: "item", itemId: "veggie_wrap" }, modifier: "extra_cheese", enabled: true });
    expect(state.view.lines).toEqual(original); state = choose(state, "keep");
    state = change(state, { type: "ADD_ALLERGY", allergen: "wheat" }); const allergyHistory = state.history.length;
    state = manual(state, { type: "REMOVE", ref: { by: "item", itemId: "veggie_wrap" } }); expect(state.view.lines).toEqual([]); expect(state.history.length).toBe(allergyHistory + 1);
    state = ui(state, { type: "UNDO" }); expect(state.view.lines).toEqual(original); expect(state.view.requirements!.profile.allergies).toEqual(["wheat"]); expect(state.view.requirements!.checks[0].staffReview).toBe(true); verify(state);
  });

  it("offers no automatic allergy exception for conflicts or unknown preparation", () => {
    for (const [allergen, itemId] of [["sesame", "burger"], ["peanut", "onion_rings"], ["milk", "side_salad"], ["nuts", "water"]] as const) {
      const state = manual(change(setup(), { type: "ADD_ALLERGY", allergen }), add(itemId));
      expect(state.lastCode).toBe("STAFF_REVIEW_REQUIRED"); expect(state.view.lines).toEqual([]); expect(state.view.requirements!.decision!.choices.map(choice => choice.id)).toEqual(["keep"]); verify(state);
    }
  });

  it("canonicalizes aliases and only clarifies unresolved nuts, never renaming a diagnosed allergy", () => {
    let state = change(setup(), { type: "ADD_ALLERGY", allergen: "Dairy" }, { type: "SET_DISLIKE", ingredient: "Peanuts", enabled: true });
    expect(state.view.requirements!.profile.allergies).toEqual(["milk"]); expect(state.view.requirements!.profile.dislikes).toEqual(["peanut"]);
    state = change(state, { type: "REMOVE_ALLERGY", allergen: "milk" }, { type: "SET_DISLIKE", ingredient: "peanut", enabled: false }, { type: "ADD_ALLERGY", allergen: "nut" });
    state = change(state, { type: "RESOLVE_ALLERGEN", from: "nuts", to: ["peanuts", "tree nuts"] });
    expect(state.view.requirements!.profile.allergies).toEqual(["peanut", "tree nuts"]); expect(state.view.requirements!.profile.dislikes).toEqual([]);
    state = change(state, { type: "RESOLVE_ALLERGEN", from: "peanut", to: ["milk"] }); expect(state.lastCode).toBe("REQUIREMENT_CONFLICT"); expect(state.view.requirements!.profile.allergies).toEqual(["peanut", "tree nuts"]); verify(state);
  });

  it("rejects a requested item that is not in the loaded catalog without losing the declaration", () => {
    const state = change(setup(), { type: "SET_DIETARY", preference: "vegan" }, { type: "SELECT_ITEM", itemId: "unlisted_item", modifiers: [], locked: false });
    expect(state.lastCode).toBe("OFF_MENU"); expect(state.view.lines).toEqual([]); expect(state.view.requirements!.profile.preference).toBe("vegan"); expect(state.view.requirements!.meal).toBeNull(); verify(state);
  });

  it("rejects cumulative profile overflow explicitly and preserves every previously stored restriction", () => {
    for (const type of ["ADD_ALLERGY", "SET_DISLIKE"] as const) {
      let state = setup();
      for (let index = 0; index < 20; index++) state = change(state, type === "ADD_ALLERGY" ? { type, allergen: `ingredient${index}` } : { type, ingredient: `ingredient${index}`, enabled: true });
      const previous = state.view.requirements!.profile;
      state = change(state, type === "ADD_ALLERGY" ? { type, allergen: "new restriction" } : { type, ingredient: "new restriction", enabled: true });
      expect(state.view.requirements!.profile).toEqual(previous); expect(state.view.requirements!.message).toContain("not stored"); expect(state.lastCode).toBe("STAFF_REVIEW_REQUIRED"); verify(state);
    }
  });
});
