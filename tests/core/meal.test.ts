import { describe, expect, it } from "vitest";
import type { DietaryProfile, ItemId, Line, MealRequirements } from "@/contracts";
import { checkCompatibility } from "@/core/compatibility";
import { mealCartConflict, solveMeal } from "@/core/meal";
import { MENU } from "../helpers/catalog";

const profile = (values: Partial<DietaryProfile> = {}): DietaryProfile => ({ preference: "none", allergies: [], dislikes: [], exceptions: [], ...values });
const meal = (values: Partial<MealRequirements> = {}): MealRequirements => ({ locationId: "demo", budgetCents: 1200, components: ["mains", "sides", "drinks"], selections: [], lockedItemIds: [], ...values });
const selection = (itemId: ItemId, modifiers: Line["modifiers"] = []) => ({ component: MENU.item(itemId)!.category, itemId, modifiers });
const line = (itemId: ItemId, modifiers: Line["modifiers"] = []): Line => ({ lineId: itemId, itemId, modifiers, qty: 1 });

describe("exhaustive meal solver", () => {
  it("calculates the exact $12 locked-side/drink meal and true below-budget minimum", () => {
    const requested = meal({ selections: [selection("fries"), selection("lemonade")], lockedItemIds: ["fries", "lemonade"] });
    const exact = solveMeal(MENU, requested, profile());
    expect(exact.kind).toBe("solved"); expect(exact.totalCents).toBe(1200);
    expect(exact.selections).toEqual([selection("grilled_cheese"), selection("fries"), selection("lemonade")]);
    const low = solveMeal(MENU, { ...requested, budgetCents: 1199 }, profile());
    expect(low.kind).toBe("budget"); expect(low.totalCents).toBe(1200); expect(low.summary.minimumCents).toBe(1200);
    expect(solveMeal(MENU, meal({ budgetCents: 1099 }), profile()).summary.minimumCents).toBe(1100);
  });

  it("finds the vegan wrap, fries, and water configuration at $12", () => {
    const solved = solveMeal(MENU, meal(), profile({ preference: "vegan" }));
    expect(solved.kind).toBe("solved"); expect(solved.totalCents).toBe(1200);
    expect(solved.selections).toEqual([selection("veggie_wrap"), selection("fries"), selection("water")]);
    expect(solved.selections.every(item => checkCompatibility(MENU, item.itemId, item.modifiers, profile({ preference: "vegan" })).status === "match")).toBe(true);
  });

  it("enumerates valid optional modifiers, while preserving an exact locked configuration", () => {
    const requested = meal({ budgetCents: 2000, selections: [selection("burger"), selection("fries"), selection("water")] });
    const solved = solveMeal(MENU, requested, profile({ allergies: ["egg"] }));
    expect(solved.kind).toBe("solved"); expect(solved.selections[0].modifiers).toContain("no_mayo");
    expect(solved.selections[0].modifiers).not.toContain("double");
    const locked = solveMeal(MENU, { ...requested, lockedItemIds: ["burger"] }, profile({ allergies: ["egg"] }));
    expect(locked.kind).toBe("infeasible"); expect(locked.summary.minimumCents).toBeNull();
  });

  it("never drops explicit or preserved paid customizations to fit a budget", () => {
    const existing = [line("burger", ["double"]), line("fries"), line("water")];
    const solved = solveMeal(MENU, meal({ budgetCents: 1300 }), profile(), existing);
    expect(solved.kind).toBe("budget"); expect(solved.totalCents).toBe(1500);
    expect(solved.selections[0]).toEqual(selection("burger", ["double"]));
    const explicit = solveMeal(MENU, meal({ budgetCents: 1400, selections: [selection("burger", ["double"])] }), profile());
    expect(explicit.kind).toBe("budget"); expect(explicit.totalCents).toBe(1500);
  });

  it("does not offer a higher budget for unsupported customizations, locks, or unknown evidence", () => {
    for (const requested of [
      meal({ selections: [selection("lemonade", ["double"])] }),
      meal({ components: ["mains"], lockedItemIds: ["fries"] }),
      meal({ locationId: "188" }),
    ]) {
      const solved = solveMeal(MENU, requested, profile({ preference: "vegan" }));
      expect(solved.kind).toBe("infeasible"); expect(solved.totalCents).toBeNull(); expect(solved.summary.minimumCents).toBeNull();
    }
  });

  it("checks all eight independent fixture combinations and prioritizes keeping accepted choices", () => {
    const ids: ItemId[] = ["grilled_cheese", "burger", "fries", "onion_rings", "water", "lemonade"];
    const catalog = ids.map(id => ({ ...MENU.item(id)!, allowedModifiers: [] }));
    const solved = solveMeal(MENU, meal({ budgetCents: 1300 }), profile(), [], catalog);
    expect(solved.summary.checkedCombinations).toBe(8); expect(solved.summary.exhaustive).toBe(true);
    expect(solved.totalCents).toBe(1100);
    const costs = [1100, 1200, 1150, 1250, 1250, 1350, 1300, 1400];
    let index = 0;
    for (const main of ids.slice(0, 2)) for (const side of ids.slice(2, 4)) for (const drink of ids.slice(4)) {
      const exact = solveMeal(MENU, meal({ budgetCents: 2000, selections: [selection(main), selection(side), selection(drink)] }), profile(), [], catalog);
      expect(exact.totalCents).toBe(costs[index++]); expect(exact.summary.checkedCombinations).toBe(1);
    }
    const kept = solveMeal(MENU, meal({ budgetCents: 1300 }), profile(), [line("burger"), line("fries"), line("water")], catalog);
    expect(kept.totalCents).toBe(1250); expect(kept.selections[0].itemId).toBe("burger");
  });

  it("is deterministic, leaves inputs intact, and reports exact cart constraint failures", () => {
    const requested = meal(); const declared = profile(); const saved = structuredClone({ requested, declared });
    expect(solveMeal(MENU, requested, declared)).toEqual(solveMeal(MENU, requested, declared));
    expect({ requested, declared }).toEqual(saved);
    expect(mealCartConflict(MENU, [line("grilled_cheese"), line("fries"), line("water")], requested)).toBeNull();
    expect(mealCartConflict(MENU, [{ ...line("grilled_cheese"), qty: 2 }, line("fries"), line("water")], requested)).toContain("exactly one");
    expect(solveMeal(MENU, meal({ selections: [{ component: "mains", itemId: "unlisted_item", modifiers: [] }] }), declared).kind).toBe("infeasible");
  });
});
