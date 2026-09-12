// Builds the spoken read-back from the review SNAPSHOT and menu labels.
// Never uses model-authored text.
import type { Review } from "@/contracts";
import { ITEM_LABEL, MODIFIER_LABEL } from "./labels";

const WORDS = ["zero", "one", "two", "three", "four", "five"];

function qtyWord(n: number): string {
  return WORDS[n] ?? String(n);
}

export function reviewToSpeech(review: Review): string {
  const parts = review.lines.map((line) => {
    const name = ITEM_LABEL[line.itemId].toLowerCase();
    const plural = line.qty === 1 ? name : name === "fries" || name === "onion rings" ? name : name === "chicken sandwich" ? "chicken sandwiches" : `${name}s`;
    const mods = line.modifiers.map((m) => MODIFIER_LABEL[m].toLowerCase());
    const modText = mods.length ? ` with ${mods.join(" and ")}` : "";
    return `${qtyWord(line.qty)} ${plural}${modText}`;
  });
  const dollars = Math.floor(review.totalCents / 100);
  const cents = review.totalCents % 100;
  const total = cents === 0 ? `${dollars} dollars` : `${dollars} dollars and ${cents} cents`;
  return `Your order: ${parts.join(". ")}. Total ${total}. Press confirm to place this simulated order.`;
}
