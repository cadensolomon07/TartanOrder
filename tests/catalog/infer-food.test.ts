import { describe, expect, it } from "vitest";
import { FoodEvidenceSchema } from "@/contracts";
import { FOOD_LEXICON, inferFoodEvidence, removableIngredients, removalModifierId } from "@/catalog/infer-food";

const infer = (label: string, description = "Standard published menu item.") => inferFoodEvidence({ label, description, locationId: "188", category: "mains" }, "https://example.test/menu.pdf");
const ids = (label: string, description?: string) => infer(label, description).ingredients.map((ingredient) => ingredient.id);
const removable = (label: string, description?: string) => removableIngredients(infer(label, description)).map((ingredient) => ingredient.id);

describe("ingredient inference from published names", () => {
  it("reads proteins, dairy, wheat and toppings from real catalog names", () => {
    expect(ids("Smash'd Bacon Burger")).toEqual(["beef", "bacon"]);
    expect(removable("Smash'd Bacon Burger")).toEqual(["bacon"]);
    expect(ids("Cheeseburger")).toEqual(["beef", "cheese"]);
    expect(ids("Chicken Burger")).toEqual(["chicken"]);
    expect(ids("Farnam Tuna Melt", "Tuna and cheddar melt on whole wheat.")).toEqual(["fish", "cheese", "bread"]);
    expect(ids("Mango Lassi", "Named item on the published menu.")).toEqual(["milk"]);
    expect(ids("Hummus - 8 oz")).toEqual(["sesame"]);
    expect(ids("Chicken Wings (8 pieces) - Buffalo")).toEqual(["chicken"]);
    expect(ids("Chicken Wings (8 pieces) - Buffalo Ranch")).toEqual(["chicken", "ranch"]);
    expect(ids("Classic All-Beef Kosher Hotdog in Bun", "Published all-beef kosher hotdog served in a bun.")).toEqual(["beef", "bun"]);
    expect(ids("Avocado BLT Grilled Cheese")).toEqual(["bacon", "cheese", "lettuce", "tomato", "avocado"]);
    expect(ids("Meat Gyro Sandwich")).toEqual(["meat", "bread"]);
    expect(ids("Chicken Gyro Sandwich")).toEqual(["chicken", "bread"]);
    expect(ids("Signature Boba Milk Tea", "Black sugar, Assam tea, half-and-half and honey boba; size not printed.")).toEqual(["milk", "cream", "honey"]);
    expect(ids("Baklava")).toEqual(["pastry", "tree_nuts"]);
  });

  it("keeps the item's core cheese, plant milks, gluten-free wraps and eggplant out of the wrong buckets", () => {
    expect(removable("Grilled Cheese")).toEqual([]);
    expect(removable("Mac N Cheese Wedges (6 pieces)")).toEqual([]);
    expect(removable("Cheese Fries")).toEqual([]);
    expect(removable("Cucumber, Feta, Kalamata Olives and Tomato Salad", "Prepared grab-and-go salad.")).toEqual(["cheese", "tomato"]);
    expect(ids("Vanilla Soy Milk")).toEqual(["soy_milk"]);
    expect(infer("Vanilla Soy Milk").ingredients[0].allergens).toEqual(["soy"]);
    expect(ids("Vegan Eggplant Shawarma Sandwich (Gluten-Free Wrap)", "Shawarma-seasoned eggplant with hummus, chopped salad, cabbage, pickles and tahini.")).toEqual(["sesame", "pickles"]);
    expect(ids("Falafel Sandwich (Pita)", "Falafel with hummus, chopped salad, cabbage, pickles and tahini.")).toEqual(["bread", "pita", "sesame", "pickles"]);
    expect(ids("Egg Roll")).toEqual(["dumpling"]);
    expect(ids("Eggplant Bowl")).toEqual([]);
  });

  it("records published preference words as claims only when nothing contradicts them", () => {
    expect(ids("Impossible Burger")).toEqual(["plant_patty"]);
    expect(infer("Impossible Burger").dietaryClaims).toEqual(["vegetarian"]);
    expect(infer("Smash'd Veggie Burger").dietaryClaims).toEqual(["vegetarian"]);
    expect(infer("Vegan Eggplant Shawarma Sandwich (Pita)", "Shawarma-seasoned eggplant with hummus.").dietaryClaims).toEqual(["vegetarian", "vegan"]);
    expect(infer("Grilled Veggie Wrap", "Named wrap listed on the published specials board.").dietaryClaims).toEqual(["vegetarian"]);
    expect(infer("Veggie Chicken Wrap").dietaryClaims).toEqual([]);
    expect(infer("Vegan Milk Tea").dietaryClaims).toEqual([]);
  });

  it("is honest about what it did not find", () => {
    const water = infer("Bottled Water", "Named item on the published menu.");
    expect(water.completeness).toBe("unknown");
    expect(water.ingredients).toEqual([]);
    expect(water.provenance.kind).toBe("unverified_campus");
    const bacon = infer("Smash'd Bacon Burger");
    expect(bacon.completeness).toBe("partial");
    expect(bacon.allergenCoverage).toEqual([]);
    expect(bacon.provenance.kind).toBe("inferred_campus");
    expect(bacon.provenance.sourceUrl).toBe("https://example.test/menu.pdf");
    expect(bacon.provenance.explanation).toContain("not verified");
    expect(bacon.preparation.status).toBe("unknown");
    expect(FoodEvidenceSchema.safeParse(bacon).success).toBe(true);
    expect(infer("Farnam Tuna Melt", "Tuna and cheddar melt on whole wheat.").allergenCoverage).toEqual(["fish", "milk", "wheat"]);
    expect(removalModifierId("bacon")).toBe("no_bacon");
    expect(FOOD_LEXICON.every((entry) => /^[a-z][a-z0-9_]*$/.test(entry.id))).toBe(true);
    expect(FOOD_LEXICON.some((entry) => entry.aliases.includes("nuts"))).toBe(false);
  });

  it("is deterministic", () => {
    expect(infer("Chicken Cheesesteak")).toEqual(infer("Chicken Cheesesteak"));
    expect(ids("Chicken Cheesesteak")).toEqual(["chicken", "cheese"]);
  });
});
