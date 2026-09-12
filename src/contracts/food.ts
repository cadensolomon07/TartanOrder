import { z } from "zod";
import type { ItemId, ModifierId } from "./index";

/** These labels describe evidence, not a guarantee about a real kitchen. */
export const COMMON_ALLERGENS = ["milk", "egg", "fish", "shellfish", "tree nuts", "peanut", "wheat", "soy", "sesame"] as const;
export const FOOD_GUIDANCE_URL = "https://www.foodallergy.org/resources/avoiding-cross-contact";
const Text = z.string().min(1).max(300);
export const FoodIngredientSchema = z.strictObject({
  id: Text, label: Text, aliases: z.array(Text), allergens: z.array(Text),
  vegetarian: z.boolean().nullable(), vegan: z.boolean().nullable(),
});
export type FoodIngredient = z.infer<typeof FoodIngredientSchema>;
export const FoodEvidenceSchema = z.strictObject({
  completeness: z.enum(["complete", "partial", "unknown"]),
  ingredients: z.array(FoodIngredientSchema),
  allergenCoverage: z.array(Text),
  preparation: z.strictObject({ status: z.enum(["fictional_separate", "possible_cross_contact", "unknown"]), allergens: z.array(Text), explanation: Text }),
  provenance: z.strictObject({ kind: z.enum(["fictional_demo", "unverified_campus"]), explanation: Text, sourceUrl: z.string().url().nullable(), verifiedAt: z.string().date().nullable() }),
});
export type FoodEvidence = z.infer<typeof FoodEvidenceSchema>;

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
const DEMO_FOOD = {
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

const MODIFIER_EFFECTS: Record<ModifierId, { remove: string[]; add: FoodIngredient[] }> = {
  no_onions: { remove: ["onions"], add: [] }, no_lettuce: { remove: ["lettuce"], add: [] },
  no_mayo: { remove: ["mayo"], add: [] }, no_ice: { remove: ["ice"], add: [] },
  extra_cheese: { remove: [], add: [cheese] }, double: { remove: [], add: [beef] },
  // Serving dressing separately does not remove it from the purchased food.
  dressing_on_side: { remove: [], add: [] },
};

/** `allowedModifiers` is the catalog item's own list: a modifier the item does not support has no ingredient effect. */
export function foodEvidenceFor(itemId: ItemId, modifiers: readonly ModifierId[], allowedModifiers: readonly ModifierId[]): FoodEvidence {
  const demo = DEMO_FOOD[itemId as keyof typeof DEMO_FOOD];
  if (!demo) return {
    completeness: "unknown", ingredients: [], allergenCoverage: [],
    preparation: { status: "unknown", allergens: [], explanation: "Preparation and cross-contact have not been verified for this campus item." },
    provenance: { kind: "unverified_campus", explanation: "Published campus names and prices are available; this catalog has not verified complete ingredients, dietary suitability, or preparation evidence.", sourceUrl: null, verifiedAt: null },
  };
  let ingredients = structuredClone(demo.ingredients);
  for (const modifier of new Set(modifiers)) {
    if (!allowedModifiers.includes(modifier)) continue;
    const effect = MODIFIER_EFFECTS[modifier];
    ingredients = ingredients.filter(entry => !effect.remove.includes(entry.id));
    ingredients.push(...structuredClone(effect.add));
  }
  return { ...structuredClone(demo), ingredients };
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
