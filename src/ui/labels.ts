// Display helpers over A's shared menu. No private copy of names, prices or
// modifier rules lives here: everything reads from @/contracts/menu.
import type { ItemId, ModifierId } from "@/contracts";
import { MENU, MODIFIERS } from "@/contracts/menu";

export const ITEM_IDS = Object.keys(MENU) as ItemId[];

export const ITEM_LABEL: Record<ItemId, string> = Object.fromEntries(
  ITEM_IDS.map((id) => [id, MENU[id].label]),
) as Record<ItemId, string>;

export const MODIFIER_LABEL: Record<ModifierId, string> = Object.fromEntries(
  (Object.keys(MODIFIERS) as ModifierId[]).map((id) => [id, MODIFIERS[id].label]),
) as Record<ModifierId, string>;

export function modifiersFor(itemId: ItemId): readonly ModifierId[] {
  return MENU[itemId].allowedModifiers;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
