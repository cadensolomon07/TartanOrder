// Builds the spoken read-back from the review SNAPSHOT and catalog labels.
// Never uses model-authored text.
import type { Review } from "@/contracts";
import type { CatalogIndex } from "@/catalog/lookup";
import { itemLabel, modifierLabel } from "./labels";

const WORDS = ["zero", "one", "two", "three", "four", "five"];

function qtyWord(n: number): string {
  return WORDS[n] ?? String(n);
}

export function reviewToSpeech(review: Review, menu: CatalogIndex): string {
  const parts = review.lines.map((line) => {
    const name = itemLabel(menu, line.itemId).toLowerCase();
    const item = menu.item(line.itemId);
    const plural = item && item.locationId !== "demo" ? `${item.label.toLowerCase()} from ${menu.locationName(item.locationId)}` : line.qty === 1 ? name : name === "fries" || name === "onion rings" ? name : name === "chicken sandwich" ? "chicken sandwiches" : `${name}s`;
    const mods = line.modifiers.map((m) => modifierLabel(menu, m).toLowerCase());
    const modText = mods.length ? ` with ${mods.join(" and ")}` : "";
    return `${qtyWord(line.qty)} ${plural}${modText}`;
  });
  const dollars = Math.floor(review.totalCents / 100);
  const cents = review.totalCents % 100;
  const total = cents === 0 ? `${dollars} dollars` : `${dollars} dollars and ${cents} cents`;
  return `Your order: ${parts.join(". ")}. Total ${total}. Press confirm to place this simulated order.`;
}
