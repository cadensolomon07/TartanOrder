import { describe, expect, it } from "vitest";
import type { DietaryProfile } from "@/contracts";
import { CompatibilityResultSchema } from "@/contracts";
import { foodEvidenceFor, FoodEvidenceSchema } from "@/contracts/food";
import { checkCompatibility } from "@/core/compatibility";
import { MENU } from "../helpers/catalog";

const profile = (changes: Partial<DietaryProfile> = {}): DietaryProfile => ({ preference: "none", allergies: [], dislikes: [], exceptions: [], ...changes });
describe("shared dietary evidence", () => {
  it("has an explicitly fictional vegan main, side and drink and detects added cheese", () => {
    for (const item of ["veggie_wrap", "fries", "water"] as const) {
      const result = checkCompatibility(MENU, item, [], profile({ preference: "vegan" }));
      expect(result.status).toBe("match");
      expect(result.source).toContain("Fictional");
      expect(CompatibilityResultSchema.safeParse(result).success).toBe(true);
    }
    expect(checkCompatibility(MENU, "veggie_wrap", ["extra_cheese"], profile({ preference: "vegan" })).status).toBe("conflict");
  });
  it("separates declared allergens from unknown preparation", () => {
    expect(checkCompatibility(MENU, "burger", [], profile({ allergies: ["sesame"] })).status).toBe("conflict");
    expect(checkCompatibility(MENU, "onion_rings", [], profile({ allergies: ["peanuts"] })).status).toBe("conflict");
    const salad = checkCompatibility(MENU, "side_salad", [], profile({ allergies: ["peanut"] }));
    expect(salad.status).toBe("unknown");
    expect(salad.staffReview).toBe(true);
    expect(salad.reasons.join(" ")).toContain("cross-contact");
    expect(checkCompatibility(MENU, "side_salad", [], profile({ preference: "vegan" })).status).toBe("match");
  });
  it("does not turn an unrelated removal into evidence of milk absence", () => {
    expect(checkCompatibility(MENU, "chicken_sandwich", ["no_mayo"], profile({ allergies: ["milk"] })).status).toBe("conflict");
    expect(checkCompatibility(MENU, "chicken_sandwich", ["no_mayo"], profile({ allergies: ["egg"] })).status).toBe("conflict");
  });
  it("preserves ambiguous and custom allergens without guessing", () => {
    for (const allergy of ["nuts", "mustard"]) {
      const result = checkCompatibility(MENU, "water", [], profile({ allergies: [allergy] }));
      expect(result.status).toBe("unknown");
      expect(result.staffReview).toBe(true);
    }
    const dislike = checkCompatibility(MENU, "onion_rings", [], profile({ dislikes: ["nuts"] }));
    expect(dislike.status).toBe("unknown");
    expect(dislike.staffReview).toBe(false);
    expect(dislike.reasons.join(" ")).toContain("dislike");
  });
  it("never invents campus suitability from item names", () => {
    const item = MENU.itemsForLocation(MENU.activeLocationIds[0])[0].id;
    expect(checkCompatibility(MENU, item, [], profile({ preference: "vegan" })).status).toBe("unknown");
    expect(checkCompatibility(MENU, item, [], profile({ allergies: ["sesame"] })).staffReview).toBe(true);
    expect(checkCompatibility(MENU, item, [], profile()).status).toBe("match");
  });
  it("keeps exact preference exceptions separate from allergies and configurations", () => {
    const excepted = profile({ preference: "vegan", exceptions: [{ itemId: "veggie_wrap", modifiers: ["extra_cheese"], preference: "vegan", dislikes: [] }] });
    expect(checkCompatibility(MENU, "veggie_wrap", ["extra_cheese"], excepted).status).toBe("match");
    expect(checkCompatibility(MENU, "veggie_wrap", ["extra_cheese", "no_mayo"], excepted).status).toBe("conflict");
    expect(checkCompatibility(MENU, "veggie_wrap", ["extra_cheese"], { ...excepted, allergies: ["milk"] }).status).toBe("conflict");
    expect(checkCompatibility(MENU, "veggie_wrap", ["extra_cheese"], { ...excepted, dislikes: ["lettuce"] }).status).toBe("conflict");
  });
  it("keeps dislikes distinct and recipe data immutable across checks", () => {
    const allowed = MENU.item("burger")!.allowedModifiers;
    const before = foodEvidenceFor("burger", [], allowed);
    expect(checkCompatibility(MENU, "burger", [], profile({ dislikes: ["onion"] })).status).toBe("conflict");
    expect(checkCompatibility(MENU, "burger", ["no_onions"], profile({ dislikes: ["onion"] })).status).toBe("match");
    const changed = foodEvidenceFor("burger", ["no_onions"], allowed);
    changed.ingredients.length = 0;
    expect(foodEvidenceFor("burger", [], allowed)).toEqual(before);
    // A modifier the item does not support has no ingredient effect; an unknown item is a conflict, never a crash.
    expect(foodEvidenceFor("burger", ["no_ice"], allowed)).toEqual(before);
    expect(checkCompatibility(MENU, "unlisted_item", [], profile()).status).toBe("conflict");
    expect(FoodEvidenceSchema.safeParse(before).success).toBe(true);
  });
});
