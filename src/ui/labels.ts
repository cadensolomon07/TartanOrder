// Display helpers over the loaded catalog index. No private copy of names,
// prices or modifier rules lives here: everything reads from the CatalogIndex.
import type { ModifierId } from "@/contracts";
import type { CatalogIndex } from "@/catalog/lookup";

export function itemLabel(menu: CatalogIndex, itemId: string): string {
  return menu.fullItemLabel(itemId);
}

export function modifierLabel(menu: CatalogIndex, modifierId: ModifierId): string {
  return menu.modifier(modifierId)?.label ?? modifierId;
}

export function modifiersFor(menu: CatalogIndex, itemId: string): readonly ModifierId[] {
  return menu.item(itemId)?.allowedModifiers ?? [];
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
