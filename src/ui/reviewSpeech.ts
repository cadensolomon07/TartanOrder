// Builds the spoken read-back from the review SNAPSHOT and catalog labels.
// Never uses model-authored text.
import type { Review } from "@/contracts";
import type { CatalogIndex } from "@/catalog/lookup";
import { itemLabel, modifierLabel } from "./labels";
import { translate, type Language } from "@/contracts/languages";

const WORDS = ["zero", "one", "two", "three", "four", "five"];

function qtyWord(n: number): string {
  return WORDS[n] ?? String(n);
}

export function reviewToSpeech(review: Review, menu: CatalogIndex, language: Language = "en-US"): string {
  if(language!=="en-US") {
    const lines=review.lines.map(line=>`${line.qty} ${translate(itemLabel(menu, line.itemId),language)}${line.modifiers.length?`, ${line.modifiers.map(mod=>translate(modifierLabel(menu, mod),language)).join(', ')}`:''}${line.note?`. ${translate('Special request:',language)} ${line.note}`:''}`).join('. ');
    const total=(review.totalCents/100).toFixed(2);
    return language==='es-ES'?`Tu pedido: ${lines}. Total: ${total} dólares estadounidenses. Revisa las peticiones especiales con el local. Pulsa Confirmar pedido simulado para confirmar.`:`您的订单：${lines}。合计 ${total} 美元。特殊要求需由柜台确认。请点击确认模拟订单。`;
  }
  const parts = review.lines.map((line) => {
    const name = itemLabel(menu, line.itemId).toLowerCase();
    const item = menu.item(line.itemId);
    const plural = item && item.locationId !== "demo" ? `${item.label.toLowerCase()} from ${menu.locationName(item.locationId)}` : line.qty === 1 ? name : name === "fries" || name === "onion rings" ? name : name === "chicken sandwich" ? "chicken sandwiches" : `${name}s`;
    const mods = line.modifiers.map((m) => modifierLabel(menu, m).toLowerCase());
    const modText = mods.length ? ` with ${mods.join(" and ")}` : "";
    return `${qtyWord(line.qty)} ${plural}${modText}${line.note ? `. Special request: ${line.note}` : ""}`;
  });
  const dollars = Math.floor(review.totalCents / 100);
  const cents = review.totalCents % 100;
  const total = cents === 0 ? `${dollars} dollars` : `${dollars} dollars and ${cents} cents`;
  return `Your order: ${parts.join(". ")}. Total ${total}.${review.lines.some(line => line.note) ? " Special requests and any extra charge need counter confirmation." : ""} Press confirm to place this simulated order.`;
}
