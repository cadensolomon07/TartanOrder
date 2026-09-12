import type { Catalog, ParseRequest, ParseResult, RequirementChange } from "@/contracts";
import { indexCatalog } from "@/catalog/lookup";
import { readNumber } from "./rules/numbers";

const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[‘’]/g, "'").replace(/\bi'm\b/g, "i am").replace(/[.!?]+$/g, "").trim();
const simpleName = /^[a-z][a-z0-9 -]{0,59}$/;
const commandWords = /\b(?:add|order|want|get|make|give|but|ignore|override|instructions?|system)\b/;
const allergyAliases: Record<string, string> = {
  nut: "nuts", peanuts: "peanut", "tree nut": "tree nuts", "sesame seeds": "sesame", eggs: "egg", dairy: "milk", soybeans: "soy",
};
const allergyName = (text: string) => allergyAliases[text] ?? text;

/** Only explicit first-person declarations, never a dish name such as vegan burger. */
export function hasRestrictionDeclaration(text: string): boolean {
  const source = normalize(text);
  return /\b(?:i am|i follow|my diet|my dietary|i have|allergic to|my allerg|i dislike|i avoid|i cannot eat|i can't eat)\b/.test(source)
    && /\b(?:vegan|vegetarian|allerg(?:y|ies|ic)|dislike|avoid|cannot eat|can't eat)\b/.test(source);
}

function allergenList(text: string): string[] | null {
  const list = text.replace(/^(?:an? )/, "").split(/\s*(?:,|\band\b)\s*/).map(part => part.trim()).filter(Boolean);
  if (!list.length || list.length > 20 || list.some(part => !simpleName.test(part) || commandWords.test(part))) return null;
  return [...new Set(list.map(allergyName))];
}

function money(text: string): number | null {
  const amount = text.trim().replace(/^\$/, "").replace(/\s+dollars?$/, "");
  if (/^\d+(?:\.\d{1,2})?$/.test(amount)) {
    const [whole, fraction = ""] = amount.split(".");
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    return Number.isSafeInteger(cents) && cents <= 100000 ? cents : null;
  }
  const words = amount.replace(/-/g, " ").split(/\s+/);
  const reading = readNumber(words, 0);
  return reading?.form === "integer" && reading.length === words.length && reading.value >= 0 && reading.value <= 1000 ? reading.value * 100 : null;
}

function declaration(source: string): RequirementChange[] | null {
  const diet = source.match(/^(?:i am (?:a )?|i follow (?:a )?)(vegan|vegetarian)(?: diet)?(?: and (?:i am )?allergic to (.+))?$/);
  if (diet) {
    const changes: RequirementChange[] = [{ type: "SET_DIETARY", preference: diet[1] as "vegan" | "vegetarian" }];
    if (diet[2]) {
      const names = allergenList(diet[2]);
      if (!names) return null;
      changes.push(...names.map(allergen => ({ type: "ADD_ALLERGY" as const, allergen })));
    }
    return changes;
  }
  if (/^(?:remove my (?:vegan|vegetarian|dietary) (?:preference|restriction)|i am no longer (?:vegan|vegetarian))$/.test(source)) return [{ type: "SET_DIETARY", preference: "none" }];
  const allergy = source.match(/^(?:i am )?allergic to (.+)$/) ?? source.match(/^i have (?:an? )?(.+?) allerg(?:y|ies)$/);
  if (allergy) {
    const names = allergenList(allergy[1]);
    return names?.map(allergen => ({ type: "ADD_ALLERGY" as const, allergen })) ?? null;
  }
  const remove = source.match(/^remove my (.+?) allergy$/);
  if (remove) {
    const names = allergenList(remove[1]);
    return names?.map(allergen => ({ type: "REMOVE_ALLERGY" as const, allergen })) ?? null;
  }
  const dislike = source.match(/^i (?:dislike|avoid) (.+)$/);
  if (dislike && simpleName.test(dislike[1]) && !commandWords.test(dislike[1])) return [{ type: "SET_DISLIKE", ingredient: dislike[1], enabled: true }];
  return null;
}

/** Narrow offline declarations and exact pending answers. Unknown restrictions fail closed. */
export function parseRequirementsText(req: ParseRequest, catalog: Catalog): ParseResult | null {
  const menu = indexCatalog(catalog);
  const source = normalize(req.text);
  const locationId = req.locationId ?? "demo";
  const requirements = (changes: RequirementChange[]): ParseResult => ({ kind: "requirements", locationId, changes });
  const decision = req.context?.requirements?.decision;
  if (decision) {
    const ordinal = /^(?:the )?(first|second)(?: one| option)?$/.exec(source);
    const index = ordinal ? ordinal[1] === "first" ? 0 : 1 : -1;
    const choice = index >= 0 ? decision.choices[index] : decision.choices.find(candidate => normalize(candidate.label) === source);
    if (choice) return { kind: "decide_requirements", pendingId: decision.id, choiceId: choice.id };
  }
  if (req.context?.requirements?.profile.allergies.some(allergen => normalize(allergen) === "nuts")) {
    const answers: Record<string, string[]> = { peanuts: ["peanut"], peanut: ["peanut"], "tree nuts": ["tree nuts"], "both": ["peanut", "tree nuts"], "peanuts and tree nuts": ["peanut", "tree nuts"] };
    if (answers[source]) return requirements([{ type: "RESOLVE_ALLERGEN", from: "nuts", to: answers[source] }]);
  }
  const profileChanges = declaration(source);
  if (profileChanges && profileChanges.length <= 12) return requirements(profileChanges);
  const budget = source.match(/^(?:i have |(?:my )?(?:menu[- ]subtotal )?budget (?:is |of )?|(?:set|increase|raise|change|lower) my (?:menu[- ]subtotal )?budget to )(.+)$/);
  if (budget) {
    const budgetCents = money(budget[1]);
    if (budgetCents !== null) return requirements([{ type: "SET_BUDGET", budgetCents }]);
  }
  if (/^(?:remove|clear) my (?:menu[- ]subtotal )?budget$/.test(source)) return requirements([{ type: "SET_BUDGET", budgetCents: null }]);
  if (/^(?:build my meal|start meal building)$/.test(source)) return requirements([{ type: "SET_MEAL_MODE", enabled: true }]);
  if (/^(?:leave meal building|stop building my meal|return to normal ordering)$/.test(source)) return requirements([{ type: "SET_MEAL_MODE", enabled: false }]);
  if (req.context?.requirements?.meal) {
    const selection = source.match(/^(?:actually,? )?(?:make (?:it|that)(?: an?)?|(?:select|choose|keep)(?: the)?) (.+)$/);
    if (selection) {
      const query = selection[1];
      const items = menu.itemsForLocation(locationId).filter(item => [item.label, ...item.aliases].some(alias => normalize(alias) === query));
      if (items.length === 1) {
        const item = items[0];
        const old = req.context.requirements.meal.selections.find(value => menu.item(value.itemId)?.category === item.category);
        const modifiers = old?.modifiers ?? [];
        if (modifiers.some(modifier => !item.allowedModifiers.includes(modifier))) return { kind: "clarify", question: "That replacement does not support an existing customization. Which configuration would you like?", choices: [] };
        return requirements([{ type: "SELECT_ITEM", itemId: item.id, modifiers, locked: /^keep /.test(source) || req.context.requirements.meal.lockedItemIds.includes(item.id) }]);
      }
    }
  }
  // Do not let the ordinary grammar apply an item while discarding an unfamiliar
  // restriction or budget clause. Manual controls remain fully available offline.
  // A published item name such as "Vegan Eggplant Shawarma" is an item,
  // not a declaration. Remove only authoritative full aliases before this guard.
  let restrictionRemainder = source;
  const aliases = menu.itemsForLocation(locationId).flatMap(item => [item.label, ...item.aliases]).map(normalize).sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    restrictionRemainder = restrictionRemainder.replace(new RegExp(`(?<![a-z0-9])${escaped}s?(?![a-z0-9])`, "g"), "menu item");
  }
  if (/\b(?:vegan|vegetarian|allerg(?:y|ies|ic)|intoleran\w*|dietary|budget|dislike|avoid)\b|\$|\b(?:cannot|can't) eat\b/.test(restrictionRemainder)) {
    return { kind: "reject", code: "UNSUPPORTED", message: "I could not save that complete requirement offline. Use the dietary or meal controls, or state one requirement at a time. No food was added." };
  }
  return null;
}

/** Remove only explicit monetary spans before the established food-quantity guard.
 * This keeps '$12 and 18,000 burgers' from hiding the excessive food quantity. */
export function withoutBudgetAmounts(text: string): string {
  const tokens = text.toLowerCase().replace(/[‘’]/g, "'").match(/[a-z]+(?:'[a-z]+)?|-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\$|[^\s]/g) ?? [];
  const masked = [...tokens];
  for (let index = 0; index < tokens.length; index += 1) {
    const number = readNumber(tokens, index);
    if (!number || number.form === "article" || number.form === "vague" || number.form === "malformed") continue;
    const before = tokens.slice(Math.max(0, index - 8), index).join(" ");
    const after = tokens[index + number.length] === "-" ? tokens[index + number.length + 1] : tokens[index + number.length];
    const monetary = tokens[index - 1] === "$" || /^(?:dollars?|bucks?|cents?)$/.test(after ?? "")
      || /\b(?:budget|limit|maximum|spend)(?: (?:is|to|of|at|under|below|up to|at most|no more than))?$/.test(before);
    if (monetary) for (let position = index; position < index + number.length; position += 1) masked[position] = "budgetamount";
    index += number.length - 1;
  }
  return masked.join(" ");
}
