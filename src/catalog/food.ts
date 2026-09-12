// Food evidence for a catalog item with modifiers applied. Pure: reads the item's
// stored evidence and the catalog's modifier effects; never infers at runtime.
import type { FoodEvidence } from "@/contracts";
import { unknownFoodEvidence } from "@/contracts/food";
import type { CatalogIndex } from "./lookup";

export function foodEvidenceFor(menu: CatalogIndex, itemId: string, modifiers: readonly string[] = []): FoodEvidence {
  const item = menu.item(itemId);
  if (!item) return unknownFoodEvidence();
  let ingredients = structuredClone(item.foodEvidence.ingredients);
  for (const modifier of new Set(modifiers)) {
    if (!item.allowedModifiers.includes(modifier)) continue;
    const effect = menu.modifier(modifier)?.effect;
    if (!effect) continue;
    ingredients = ingredients.filter((entry) => !effect.remove.includes(entry.id));
    ingredients.push(...structuredClone(effect.add));
  }
  return { ...structuredClone(item.foodEvidence), ingredients };
}
