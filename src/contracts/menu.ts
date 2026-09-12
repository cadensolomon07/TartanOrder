import type { ItemId, ModifierId } from "./index";

export const DEMO_DISCLOSURE = "TartanOrder Demo Counter · Seeded menu · No real purchase.";

export type MenuItem = {
  id: ItemId;
  label: string;
  priceCents: number;
  aliases: readonly string[];
  allowedModifiers: readonly ModifierId[];
};

export type MenuModifier = {
  id: ModifierId;
  label: string;
  priceCents: number;
};

/** Illustrative seeded demo prices; these are not official CMU prices. */
export const MENU: Readonly<Record<ItemId, Readonly<MenuItem>>> = Object.freeze({
  burger: Object.freeze({
    id: "burger", label: "Burger", priceCents: 800,
    aliases: Object.freeze(["burger", "cheeseburger"]),
    allowedModifiers: Object.freeze<ModifierId[]>(["no_onions", "double", "extra_cheese"]),
  }),
  fries: Object.freeze({
    id: "fries", label: "Fries", priceCents: 300,
    aliases: Object.freeze(["fries", "french fries"]),
    allowedModifiers: Object.freeze<ModifierId[]>([]),
  }),
  lemonade: Object.freeze({
    id: "lemonade", label: "Lemonade", priceCents: 250,
    aliases: Object.freeze(["lemonade", "lemon drink"]),
    allowedModifiers: Object.freeze<ModifierId[]>([]),
  }),
});

export const MODIFIERS: Readonly<Record<ModifierId, Readonly<MenuModifier>>> = Object.freeze({
  no_onions: Object.freeze({ id: "no_onions", label: "No onions", priceCents: 0 }),
  double: Object.freeze({ id: "double", label: "Double", priceCents: 250 }),
  extra_cheese: Object.freeze({ id: "extra_cheese", label: "Extra cheese", priceCents: 100 }),
});
