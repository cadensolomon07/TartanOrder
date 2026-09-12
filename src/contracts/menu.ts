import type { ItemId, ModifierId } from "./index";
import { DEMO_ITEM_IDS } from "./index";

// Seeded Demo Counter data and the modifier table. Runtime code reads the
// released catalog (a Catalog value) instead; these constants feed only
// src/catalog/bundled.ts and the seed generator.

export type MenuCategory = "mains" | "sides" | "drinks";

export type MenuItem = {
  id: ItemId;
  label: string;
  category: MenuCategory;
  description: string;
  priceCents: number;
  aliases: readonly string[];
  allowedModifiers: readonly ModifierId[];
  locationId: string;
  sourcePage?: number;
};

export type MenuModifier = {
  id: ModifierId;
  label: string;
  priceCents: number;
};

function item(value: Omit<MenuItem, "locationId"> & { locationId?: string }): Readonly<MenuItem> {
  return Object.freeze({ ...value, locationId: value.locationId ?? "demo", aliases: Object.freeze([...value.aliases]), allowedModifiers: Object.freeze([...value.allowedModifiers]) });
}

/** Illustrative seeded demo prices; these are not official CMU prices. */
export const DEMO_MENU: Readonly<Record<(typeof DEMO_ITEM_IDS)[number], Readonly<MenuItem>>> = Object.freeze({
  burger: item({
    id: "burger", label: "Burger", category: "mains", priceCents: 800,
    description: "Beef burger with lettuce, onions and mayo.",
    aliases: ["burger", "cheeseburger", "beef burger"],
    allowedModifiers: ["no_onions", "double", "extra_cheese", "no_lettuce", "no_mayo"],
  }),
  chicken_sandwich: item({
    id: "chicken_sandwich", label: "Chicken Sandwich", category: "mains", priceCents: 850,
    description: "Crispy chicken, lettuce and mayo on a toasted bun.",
    aliases: ["chicken sandwich", "crispy chicken sandwich", "chicken burger"],
    allowedModifiers: ["no_lettuce", "no_mayo", "extra_cheese"],
  }),
  veggie_wrap: item({
    id: "veggie_wrap", label: "Veggie Wrap", category: "mains", priceCents: 750,
    description: "Roasted vegetables, lettuce and mayo in a soft wrap.",
    aliases: ["veggie wrap", "vegetable wrap", "vegetarian wrap"],
    allowedModifiers: ["no_lettuce", "no_mayo"],
  }),
  grilled_cheese: item({
    id: "grilled_cheese", label: "Grilled Cheese", category: "mains", priceCents: 650,
    description: "Melted cheese between golden toasted bread.",
    aliases: ["grilled cheese", "grilled cheese sandwich", "cheese toastie"],
    allowedModifiers: ["extra_cheese"],
  }),
  fries: item({
    id: "fries", label: "Fries", category: "sides", priceCents: 300,
    description: "Crisp, lightly salted fries.",
    aliases: ["fries", "french fries"], allowedModifiers: [],
  }),
  onion_rings: item({
    id: "onion_rings", label: "Onion Rings", category: "sides", priceCents: 350,
    description: "Golden battered onion rings.",
    aliases: ["onion rings", "rings"], allowedModifiers: [],
  }),
  side_salad: item({
    id: "side_salad", label: "Side Salad", category: "sides", priceCents: 400,
    description: "Mixed greens, tomatoes and house dressing.",
    aliases: ["side salad", "salad", "garden salad"], allowedModifiers: ["dressing_on_side"],
  }),
  lemonade: item({
    id: "lemonade", label: "Lemonade", category: "drinks", priceCents: 250,
    description: "Bright, chilled lemonade over ice.",
    aliases: ["lemonade", "lemon drink"], allowedModifiers: ["no_ice"],
  }),
  iced_tea: item({
    id: "iced_tea", label: "Iced Tea", category: "drinks", priceCents: 250,
    description: "Unsweetened black tea served over ice.",
    aliases: ["iced tea", "ice tea", "tea"], allowedModifiers: ["no_ice"],
  }),
  cola: item({
    id: "cola", label: "Cola", category: "drinks", priceCents: 250,
    description: "Classic sparkling cola over ice.",
    aliases: ["cola", "soda", "coke"], allowedModifiers: ["no_ice"],
  }),
  water: item({
    id: "water", label: "Water", category: "drinks", priceCents: 150,
    description: "Chilled bottled still water.",
    aliases: ["water", "bottled water", "still water"], allowedModifiers: [],
  }),
});

export const MODIFIERS: Readonly<Record<ModifierId, Readonly<MenuModifier>>> = Object.freeze({
  no_onions: Object.freeze({ id: "no_onions", label: "No onions", priceCents: 0 }),
  double: Object.freeze({ id: "double", label: "Double", priceCents: 250 }),
  extra_cheese: Object.freeze({ id: "extra_cheese", label: "Extra cheese", priceCents: 100 }),
  no_lettuce: Object.freeze({ id: "no_lettuce", label: "No lettuce", priceCents: 0 }),
  no_mayo: Object.freeze({ id: "no_mayo", label: "No mayo", priceCents: 0 }),
  dressing_on_side: Object.freeze({ id: "dressing_on_side", label: "Dressing on the side", priceCents: 0 }),
  no_ice: Object.freeze({ id: "no_ice", label: "No ice", priceCents: 0 }),
});
