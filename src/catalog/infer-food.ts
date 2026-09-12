// Deterministic ingredient inference from a published item's name and description.
// Keyword matching over a curated lexicon; no network, no model, no randomness.
// Inference only ever ADDS ingredients (a detected meat, dairy, egg, wheat, soy, nut,
// sesame, fish or shellfish yields a conflict for the matching restriction). The
// absence of an ingredient is never certified: results are "partial" at best and
// every allergy check still ends in "verify with dining staff".
import type { FoodEvidence, FoodIngredient } from "@/contracts";

export const INFERENCE_DATE = "2026-09-12";

export type FoodLexiconEntry = {
  readonly id: string;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly allergens: readonly string[];
  readonly vegetarian: boolean;
  readonly vegan: boolean;
  /** A topping a kitchen can leave off; becomes a no_<id> modifier unless it is the item's core. */
  readonly removable?: boolean;
  /** Added only when no explicit protein word was found (a bare "burger" is beef). */
  readonly whenNoProtein?: boolean;
  /** Counts as an explicit protein for the rule above. */
  readonly protein?: boolean;
  /** Skipped when the name says gluten-free (a gluten-free wrap is not wheat). */
  readonly glutenFreeSkips?: boolean;
};

const entry = (
  id: string, label: string, aliases: readonly string[], allergens: readonly string[], vegetarian: boolean, vegan: boolean,
  extra: Partial<Pick<FoodLexiconEntry, "removable" | "whenNoProtein" | "protein" | "glutenFreeSkips">> = {},
): FoodLexiconEntry => ({ id, label, aliases, allergens, vegetarian, vegan, ...extra });

const meat = (id: string, label: string, aliases: readonly string[], extra: Partial<FoodLexiconEntry> = {}) =>
  entry(id, label, aliases, [], false, false, { protein: true, ...extra });
const dairy = (id: string, label: string, aliases: readonly string[], extra: Partial<FoodLexiconEntry> = {}) =>
  entry(id, label, aliases, ["milk"], true, false, extra);
const wheat = (id: string, label: string, aliases: readonly string[], extra: Partial<FoodLexiconEntry> = {}) =>
  entry(id, label, aliases, ["wheat"], true, true, { glutenFreeSkips: true, ...extra });
const plant = (id: string, label: string, aliases: readonly string[], extra: Partial<FoodLexiconEntry> = {}) =>
  entry(id, label, aliases, [], true, true, extra);

/** Ordered so that multi-word aliases are tried before their single-word parts. */
export const FOOD_LEXICON: readonly FoodLexiconEntry[] = [
  // plant milks and alternatives first, so "milk" alone does not also match inside them
  entry("soy_milk", "Soy milk", ["soy milk", "soymilk"], ["soy"], true, true),
  entry("almond_milk", "Almond milk", ["almond milk"], ["tree nuts"], true, true),
  plant("oat_milk", "Oat milk", ["oat milk"]),
  plant("coconut_milk", "Coconut milk", ["coconut milk"]),
  entry("plant_patty", "Plant-based patty", ["impossible burger", "beyond burger", "plant based burger", "plant based patty", "veggie burger", "veggie patty"], [], true, true, { protein: true }),
  // meats and poultry
  meat("beef", "Beef", ["beef", "steak", "steaks", "roast beef", "corned beef", "all beef", "pastrami", "brisket", "meatball", "meatballs"]),
  // a bare burger, patty or cheesesteak is beef unless another protein or a plant cue is named
  entry("beef", "Beef", ["burger", "burgers", "cheeseburger", "cheeseburgers", "patty", "patties", "cheesesteak", "cheesesteaks"], [], false, false, { whenNoProtein: true }),
  meat("chicken", "Chicken", ["chicken", "wings", "wing", "tenders", "tender", "nuggets", "nugget", "poultry"]),
  meat("pork", "Pork", ["pork", "pepperoni", "salami", "prosciutto", "pulled pork"]),
  entry("bacon", "Bacon", ["bacon", "blt"], [], false, false, { removable: true }),
  meat("ham", "Ham", ["ham"]),
  meat("sausage", "Sausage", ["sausage", "sausages", "chorizo", "kielbasa"]),
  meat("turkey", "Turkey", ["turkey"]),
  meat("lamb", "Lamb", ["lamb", "lamb chop", "lamb chops"]),
  entry("meat", "Meat", ["meat", "meats", "gyro", "gyros", "shawarma", "kufta", "kofta", "kebab", "kabob", "hotdog", "hot dog", "hotdogs", "hot dogs"], [], false, false, { whenNoProtein: true }),
  // fish and shellfish
  entry("fish", "Fish", ["fish", "tuna", "salmon", "cod", "tilapia", "anchovy", "anchovies", "eel", "fish sauce", "caesar", "ceasar"], ["fish"], false, false, { protein: true }),
  entry("shellfish", "Shellfish", ["shrimp", "prawn", "prawns", "crab", "lobster", "calamari", "squid", "clam", "clams", "oyster", "oysters", "scallop", "scallops", "mussels"], ["shellfish"], false, false, { protein: true }),
  // dairy
  dairy("cheese", "Cheese", ["cheese", "cheeses", "cheesy", "cheezy", "cheddar", "mozzarella", "provolone", "parmesan", "parm", "feta", "swiss", "queso", "cheeseburger", "cheeseburgers", "cheesesteak", "cheesesteaks", "melt", "melts", "caprese", "caesar", "ceasar"], { removable: true }),
  dairy("cream", "Cream", ["cream", "creamy", "half and half", "sour cream", "whipped cream"]),
  dairy("butter", "Butter", ["butter", "buttered", "ghee"]),
  dairy("milk", "Milk", ["milk", "whole milk", "latte", "lattes", "lassi", "kheer", "gulab jamun", "gulab jaman", "paneer", "whey", "milkshake", "milkshakes"]),
  dairy("yogurt", "Yogurt", ["yogurt", "yoghurt", "raita", "tzatziki"]),
  dairy("ice_cream", "Ice cream", ["ice cream", "gelato"]),
  entry("ranch", "Ranch dressing", ["ranch"], ["milk", "egg"], true, false, { removable: true }),
  // egg
  entry("egg", "Egg", ["egg", "eggs", "omelet", "omelette", "caesar", "ceasar"], ["egg"], true, false),
  entry("mayo", "Mayonnaise", ["mayo", "mayonnaise", "aioli"], ["egg"], true, false, { removable: true }),
  // wheat
  wheat("bun", "Bun", ["bun", "buns", "brioche"]),
  wheat("bread", "Bread", ["bread", "breads", "sandwich", "sandwiches", "sub", "subs", "hoagie", "toast", "sourdough", "rye", "whole wheat", "baguette", "ciabatta", "croissant", "bagel", "bagels", "roll", "rolls"]),
  wheat("wrap", "Flour wrap", ["wrap", "wraps", "tortilla", "tortillas", "burrito", "quesadilla"]),
  wheat("pita", "Pita", ["pita", "pitas", "naan", "flatbread"]),
  wheat("noodles", "Wheat noodles", ["noodle", "noodles", "pasta", "macaroni", "mac", "ramen", "udon", "lo mein", "spaghetti"]),
  wheat("dumpling", "Dumpling wrapper", ["dumpling", "dumplings", "samosa", "samosas", "spring roll", "spring rolls", "egg roll", "egg rolls", "wonton", "wontons"]),
  wheat("batter", "Wheat batter or breading", ["breaded", "battered", "batter", "tempura", "crispy", "seitan"]),
  wheat("pastry", "Wheat pastry", ["cookie", "cookies", "brownie", "brownies", "cake", "cakes", "pastry", "pastries", "muffin", "muffins", "baklava", "pie"]),
  // soy
  entry("soy", "Soy", ["soy", "soya", "tofu", "edamame", "miso", "tempeh"], ["soy"], true, true),
  entry("teriyaki", "Teriyaki sauce", ["teriyaki"], ["soy", "wheat"], true, true),
  // nuts and sesame
  entry("peanut", "Peanut", ["peanut", "peanuts"], ["peanut"], true, true),
  entry("tree_nuts", "Tree nuts", ["almond", "almonds", "walnut", "walnuts", "pecan", "pecans", "cashew", "cashews", "pistachio", "pistachios", "hazelnut", "hazelnuts", "baklava"], ["tree nuts"], true, true),
  entry("sesame", "Sesame", ["sesame", "tahini", "hummus", "houmous", "baba ghanoush", "baba ganoush", "zahtar", "zaatar", "za'atar", "halva"], ["sesame"], true, true),
  // not vegan
  entry("honey", "Honey", ["honey"], [], true, false),
  // removable plant toppings
  plant("onions", "Onions", ["onion", "onions"], { removable: true }),
  plant("lettuce", "Lettuce", ["lettuce", "blt"], { removable: true }),
  plant("tomato", "Tomato", ["tomato", "tomatoes", "blt"], { removable: true }),
  plant("pickles", "Pickles", ["pickle", "pickles"], { removable: true }),
  plant("jalapeno", "Jalapeño", ["jalapeno", "jalapenos", "jalapeño", "jalapeños"], { removable: true }),
  plant("cilantro", "Cilantro", ["cilantro"], { removable: true }),
  plant("avocado", "Avocado", ["avocado", "guacamole"], { removable: true }),
  plant("sauce", "Sauce", ["sauce", "sauces"], { removable: true }),
  plant("dressing", "Dressing", ["dressing"], { removable: true }),
];

/** Words in the name that turn a bare "burger" or "shawarma" into a plant item. */
const PLANT_CUES = ["veggie", "vegetable", "vegetables", "vegetarian", "vegan", "impossible", "beyond", "plant based", "tofu", "falafel", "tempeh"];
/** Items whose identity is the cheese: "no cheese" would be a different dish. */
const CHEESE_CORE = ["grilled cheese", "mac n cheese", "mac and cheese", "macaroni and cheese", "cheesesteak", "cheeseburger", "cheese fries", "mozzarella sticks", "melt", "quesadilla", "caprese", "pizza", "cheese pizza", "parmesan", "parm"];

function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

function pluralForms(alias: string): string[] {
  return alias.endsWith("s") ? [alias] : [alias, `${alias}s`];
}

type Match = { entry: FoodLexiconEntry; alias: string; inLabel: boolean };

/** Finds every lexicon entry whose alias appears as whole words. Multi-word aliases claim their words first ("soy milk" is not dairy); one word may feed several entries ("blt" is bacon, lettuce and tomato). */
function matchEntries(label: string, description: string): Match[] {
  const found: Match[] = [];
  const forms = FOOD_LEXICON.flatMap((lexeme) => lexeme.aliases.flatMap((alias) => pluralForms(normalize(alias)).map((form) => ({ lexeme, form: form.split(" ") }))));
  const phrases = forms.filter((candidate) => candidate.form.length > 1).sort((a, b) => b.form.length - a.form.length);
  const singles = forms.filter((candidate) => candidate.form.length === 1);
  for (const [source, inLabel] of [[label, true], [description, false]] as const) {
    const words = tokens(source);
    const claimed = new Set<number>();
    for (const { lexeme, form } of phrases) {
      for (let start = 0; start + form.length <= words.length; start += 1) {
        if (words.slice(start, start + form.length).join(" ") !== form.join(" ")) continue;
        if (form.some((_, offset) => claimed.has(start + offset))) continue;
        form.forEach((_, offset) => claimed.add(start + offset));
        found.push({ entry: lexeme, alias: form.join(" "), inLabel });
      }
    }
    for (const { lexeme, form } of singles) {
      words.forEach((word, index) => {
        if (word === form[0] && !claimed.has(index)) found.push({ entry: lexeme, alias: form[0], inLabel });
      });
    }
  }
  return found;
}

function coreLabel(label: string): string {
  return normalize(label.replace(/\([^)]*\)/g, " ").split(/\s[-–—]\s/)[0]);
}

function isRemovable(match: Match, label: string): boolean {
  if (!match.entry.removable) return false;
  const core = coreLabel(label);
  const words = core.split(" ").filter(Boolean);
  if (match.entry.id === "cheese" && CHEESE_CORE.some((pattern) => core.includes(pattern))) return false;
  const last = words.at(-1) ?? "";
  return !pluralForms(match.alias.split(" ").at(-1) ?? "").includes(last) || match.alias.split(" ").length > 1 && !core.endsWith(match.alias);
}

export type InferenceInput = { readonly label: string; readonly description: string; readonly locationId: string; readonly category: string };

/** Ingredient ids in `evidence` that a kitchen can leave off, per the lexicon. */
export function removableIngredients(evidence: FoodEvidence): readonly FoodIngredient[] {
  return evidence.ingredients.filter((ingredient) => ingredient.aliases.includes("__removable__"));
}

export function inferFoodEvidence(item: InferenceInput, sourceUrl: string | null): FoodEvidence {
  const text = `${item.label} ${item.description}`;
  const normalized = normalize(text);
  const glutenFree = /\bgluten free\b/.test(normalized);
  const plantCue = PLANT_CUES.some((cue) => new RegExp(`\\b${cue}\\b`).test(normalized));
  const matches = matchEntries(item.label, item.description);
  const explicitProtein = matches.some((match) => match.entry.protein);
  const ingredients: FoodIngredient[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const lexeme = match.entry;
    if (lexeme.whenNoProtein && (explicitProtein || plantCue)) continue;
    if (lexeme.glutenFreeSkips && glutenFree) continue;
    if (seen.has(lexeme.id)) continue;
    seen.add(lexeme.id);
    const removable = matches.filter((candidate) => candidate.entry.id === lexeme.id).some((candidate) => isRemovable(candidate, item.label));
    ingredients.push({
      id: lexeme.id, label: lexeme.label, aliases: [...lexeme.aliases, ...(removable ? ["__removable__"] : [])], allergens: [...lexeme.allergens],
      vegetarian: lexeme.vegetarian, vegan: lexeme.vegan,
    });
  }
  const meatOrFish = ingredients.some((ingredient) => ingredient.vegetarian === false);
  const animalProduct = ingredients.some((ingredient) => ingredient.vegan === false);
  const claims: FoodEvidence["dietaryClaims"] = [];
  if (/\bvegan\b/.test(normalized) && !animalProduct) claims.push("vegetarian", "vegan");
  else if (/\b(veggie|vegetarian|impossible|beyond|plant based)\b/.test(normalized) && !meatOrFish) claims.push("vegetarian");
  const allergens = [...new Set(ingredients.flatMap((ingredient) => ingredient.allergens))];
  const inferred = ingredients.length > 0 || claims.length > 0;
  return {
    completeness: ingredients.length > 0 ? "partial" : "unknown",
    ingredients,
    allergenCoverage: allergens,
    dietaryClaims: claims,
    preparation: { status: "unknown", allergens: [], explanation: "Preparation and cross-contact have not been verified for this campus item." },
    provenance: {
      kind: inferred ? "inferred_campus" : "unverified_campus",
      explanation: inferred
        ? `Ingredients inferred from the published item name and description on ${INFERENCE_DATE} by keyword matching; not verified with dining staff. The absence of an ingredient is not verified.`
        : "Published campus names and prices are available; this catalog has not verified complete ingredients, dietary suitability, or preparation evidence.",
      sourceUrl,
      verifiedAt: null,
    },
  };
}

/** Removal modifier id for an ingredient the lexicon marks removable. */
export function removalModifierId(ingredientId: string): string {
  return `no_${ingredientId}`;
}
