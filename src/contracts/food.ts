import { FoodEvidenceSchema, type FoodEvidence, type FoodIngredient, type ItemId } from "./index";
export { FoodEvidenceSchema, FoodIngredientSchema, ModifierEffectSchema, type FoodEvidence, type FoodIngredient, type ModifierEffect, type DietaryClaim } from "./index";

/** These labels describe evidence, not a guarantee about a real kitchen. */
export const COMMON_ALLERGENS = ["milk", "egg", "fish", "shellfish", "tree nuts", "peanut", "wheat", "soy", "sesame"] as const;
export const FOOD_GUIDANCE_URL = "https://www.foodallergy.org/resources/avoiding-cross-contact";

const ingredient = (id: string, label: string, allergens: string[] = [], vegan = true, vegetarian = true, aliases: string[] = []): FoodIngredient => ({ id, label, allergens, vegan, vegetarian, aliases });
const lettuce = ingredient("lettuce", "Lettuce");
const mayo = ingredient("mayo", "Egg mayonnaise", ["egg"], false, true, ["mayonnaise", "mayo", "egg"]);
const plantMayo = ingredient("mayo", "Plant-based mayonnaise", [], true, true, ["mayonnaise", "mayo"]);
const cheese = ingredient("cheese", "Cheddar cheese", ["milk"], false, true, ["cheddar", "dairy", "milk"]);
const beef = ingredient("beef", "Beef patty", [], false, false, ["meat"]);
const ice = ingredient("ice", "Ice");
function recipe(ingredients: FoodIngredient[], preparationUnknown = false): FoodEvidence {
  return FoodEvidenceSchema.parse({
    completeness: "complete", ingredients, allergenCoverage: [...COMMON_ALLERGENS],
    preparation: {
      status: preparationUnknown ? "unknown" : "fictional_separate", allergens: [],
      explanation: preparationUnknown ? "Preparation and cross-contact have no evidence, even in this fictional example." : "This fictional example specifies separate preparation for the nine listed allergens; it describes no real kitchen.",
    },
    provenance: { kind: "fictional_demo", explanation: "Fictional Demo Counter recipe and preparation fixture, defined 2026-09-12. Not a CMU recipe or a claim about real food.", sourceUrl: null, verifiedAt: "2026-09-12" },
  });
}

/** Complete, deliberately small fictional recipes. No campus facts are inferred from names. */
export const DEMO_FOOD = {
  burger: recipe([beef, ingredient("bun", "Sesame wheat bun", ["wheat", "sesame"], true, true, ["bread", "sesame", "wheat"]), lettuce, ingredient("onions", "Onions", [], true, true, ["onion"]), mayo]),
  chicken_sandwich: recipe([ingredient("chicken", "Breaded chicken", ["wheat", "egg"], false, false, ["meat", "poultry"]), ingredient("bun", "Milk wheat bun", ["milk", "wheat"], false, true, ["bread", "milk", "wheat"]), lettuce, mayo]),
  veggie_wrap: recipe([ingredient("wrap", "Wheat tortilla", ["wheat"], true, true, ["tortilla", "wheat"]), ingredient("vegetables", "Roasted peppers and zucchini", [], true, true, ["peppers", "pepper", "zucchini"]), lettuce, plantMayo]),
  grilled_cheese: recipe([ingredient("bread", "Wheat bread", ["wheat"], true, true, ["wheat"]), cheese, ingredient("butter", "Butter", ["milk"], false, true, ["milk", "dairy"])]),
  fries: recipe([ingredient("potato", "Potatoes", [], true, true, ["potatoes"]), ingredient("sunflower_oil", "Sunflower oil", [], true, true, ["sunflower", "oil"]), ingredient("salt", "Salt")]),
  onion_rings: recipe([ingredient("onions", "Onions", [], true, true, ["onion"]), ingredient("batter", "Wheat and milk batter", ["wheat", "milk"], false, true, ["wheat", "milk"]), ingredient("peanut_oil", "Unrefined peanut oil", ["peanut"], true, true, ["peanut", "peanuts", "oil"])]),
  side_salad: recipe([ingredient("greens", "Mixed greens", [], true, true, ["lettuce"]), ingredient("tomato", "Tomatoes", [], true, true, ["tomatoes"]), ingredient("dressing", "Olive oil and lemon dressing", [], true, true, ["olive oil", "lemon"])], true),
  lemonade: recipe([ingredient("water", "Water"), ingredient("lemon", "Lemon juice", [], true, true, ["lemon"]), ingredient("sugar", "Sugar"), ice]),
  iced_tea: recipe([ingredient("water", "Water"), ingredient("tea", "Black tea", [], true, true, ["tea"]), ice]),
  cola: recipe([ingredient("water", "Carbonated water", [], true, true, ["water"]), ingredient("sugar", "Sugar"), ingredient("cola_flavor", "Fictional plant-derived cola flavour"), ice]),
  water: recipe([ingredient("water", "Water")]),
} satisfies Partial<Record<ItemId, FoodEvidence>>;

/** Demo Counter modifier effects; the seed copies these into the catalog's modifier rows. */
export const MODIFIER_EFFECTS: Record<string, { remove: string[]; add: FoodIngredient[] }> = {
  no_onions: { remove: ["onions"], add: [] }, no_lettuce: { remove: ["lettuce"], add: [] },
  no_mayo: { remove: ["mayo"], add: [] }, no_ice: { remove: ["ice"], add: [] },
  extra_cheese: { remove: [], add: [cheese] }, double: { remove: [], add: [beef] },
  // Serving dressing separately does not remove it from the purchased food.
  dressing_on_side: { remove: [], add: [] },
};

/** Evidence for a campus item nobody has inferred or verified anything about. */
export function unknownFoodEvidence(): FoodEvidence {
  return {
    completeness: "unknown", ingredients: [], allergenCoverage: [], dietaryClaims: [],
    preparation: { status: "unknown", allergens: [], explanation: "Preparation and cross-contact have not been verified for this campus item." },
    provenance: { kind: "unverified_campus", explanation: "Published campus names and prices are available; this catalog has not verified complete ingredients, dietary suitability, or preparation evidence.", sourceUrl: null, verifiedAt: null },
  };
}

/** Alias normalization never converts ambiguous 'nuts' into a guessed allergen. */
export function normalizeFoodName(value: string): string {
  const name = value.trim().toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ");
  const aliases: Record<string, string> = {
    dairy: "milk", eggs: "egg", peanuts: "peanut", soya: "soy", soybean: "soy", soybeans: "soy",
    "tree nut": "tree nuts", "tree nuts allergy": "tree nuts", "sesame seed": "sesame", "sesame seeds": "sesame",
    "crustacean shellfish": "shellfish", crustaceans: "shellfish", shrimp: "shellfish", prawns: "shellfish",
  };
  return aliases[name] ?? name;
}
