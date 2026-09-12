import { describe, expect, it } from "vitest";
import type { DietaryProfile } from "@/contracts";
import { CompatibilityResultSchema } from "@/contracts";
import { foodEvidenceFor, FoodEvidenceSchema } from "@/contracts/food";
import { ACTIVE_CAMPUS_ITEMS } from "@/contracts/campus";
import { checkCompatibility } from "@/core/compatibility";

const profile = (changes: Partial<DietaryProfile> = {}): DietaryProfile => ({ preference: "none", allergies: [], dislikes: [], exceptions: [], ...changes });
describe("shared dietary evidence", () => {
  it("has an explicitly fictional vegan main, side and drink and detects added cheese", () => {
    for (const item of ["veggie_wrap", "fries", "water"] as const) {
      const result = checkCompatibility(item, [], profile({ preference: "vegan" }));
      expect(result.status).toBe("match");
      expect(result.source).toContain("Fictional");
      expect(CompatibilityResultSchema.safeParse(result).success).toBe(true);
    }
    expect(checkCompatibility("veggie_wrap", ["extra_cheese"], profile({ preference: "vegan" })).status).toBe("conflict");
  });
  it("separates declared allergens from unknown preparation", () => {
    expect(checkCompatibility("burger", [], profile({ allergies: ["sesame"] })).status).toBe("conflict");
    expect(checkCompatibility("onion_rings", [], profile({ allergies: ["peanuts"] })).status).toBe("conflict");
    const salad = checkCompatibility("side_salad", [], profile({ allergies: ["peanut"] }));
    expect(salad.status).toBe("unknown");
    expect(salad.staffReview).toBe(true);
    expect(salad.reasons.join(" ")).toContain("cross-contact");
    expect(checkCompatibility("side_salad", [], profile({ preference: "vegan" })).status).toBe("match");
  });
  it("does not turn an unrelated removal into evidence of milk absence", () => {
    expect(checkCompatibility("chicken_sandwich", ["no_mayo"], profile({ allergies: ["milk"] })).status).toBe("conflict");
    expect(checkCompatibility("chicken_sandwich", ["no_mayo"], profile({ allergies: ["egg"] })).status).toBe("conflict");
  });
  it("preserves ambiguous and custom allergens without guessing", () => {
    for (const allergy of ["nuts", "mustard"]) {
      const result = checkCompatibility("water", [], profile({ allergies: [allergy] }));
      expect(result.status).toBe("unknown");
      expect(result.staffReview).toBe(true);
    }
    const dislike = checkCompatibility("onion_rings", [], profile({ dislikes: ["nuts"] }));
    expect(dislike.status).toBe("unknown");
    expect(dislike.staffReview).toBe(false);
    expect(dislike.reasons.join(" ")).toContain("dislike");
  });
  it("never invents campus suitability from item names", () => {
    const item = ACTIVE_CAMPUS_ITEMS[0].id;
    expect(checkCompatibility(item, [], profile({ preference: "vegan" })).status).toBe("unknown");
    expect(checkCompatibility(item, [], profile({ allergies: ["sesame"] })).staffReview).toBe(true);
    expect(checkCompatibility(item, [], profile()).status).toBe("match");
  });
  it("keeps exact preference exceptions separate from allergies and configurations", () => {
    const excepted = profile({ preference: "vegan", exceptions: [{ itemId: "veggie_wrap", modifiers: ["extra_cheese"], preference: "vegan", dislikes: [] }] });
    expect(checkCompatibility("veggie_wrap", ["extra_cheese"], excepted).status).toBe("match");
    expect(checkCompatibility("veggie_wrap", ["extra_cheese", "no_mayo"], excepted).status).toBe("conflict");
    expect(checkCompatibility("veggie_wrap", ["extra_cheese"], { ...excepted, allergies: ["milk"] }).status).toBe("conflict");
    expect(checkCompatibility("veggie_wrap", ["extra_cheese"], { ...excepted, dislikes: ["lettuce"] }).status).toBe("conflict");
  });
  it("keeps dislikes distinct and recipe data immutable across checks", () => {
    const before = foodEvidenceFor("burger");
    expect(checkCompatibility("burger", [], profile({ dislikes: ["onion"] })).status).toBe("conflict");
    expect(checkCompatibility("burger", ["no_onions"], profile({ dislikes: ["onion"] })).status).toBe("match");
    const changed = foodEvidenceFor("burger", ["no_onions"]);
    changed.ingredients.length = 0;
    expect(foodEvidenceFor("burger")).toEqual(before);
    expect(FoodEvidenceSchema.safeParse(before).success).toBe(true);
  });
});
