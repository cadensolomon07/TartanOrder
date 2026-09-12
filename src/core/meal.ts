import type { DietaryProfile, Line, MealComponent, MealRequirements, SolverSummary } from "@/contracts";
import { MENU, MODIFIERS, type MenuItem } from "@/contracts/menu";
import { checkCompatibility } from "./compatibility";

type Selection = MealRequirements["selections"][number];
export type MealSolution = {
  kind: "solved" | "budget" | "infeasible";
  selections: Selection[];
  totalCents: number | null;
  summary: SolverSummary;
  reason: string;
};
const components: MealComponent[] = ["mains", "sides", "drinks"];
const configurationKey = (item: { itemId: string; modifiers: readonly string[] }) => `${item.itemId}:${[...item.modifiers].sort().join(",")}`;
export const selectionCents = (selection: Pick<Selection, "itemId" | "modifiers">): number =>
  MENU[selection.itemId].priceCents + selection.modifiers.reduce((sum, modifier) => sum + MODIFIERS[modifier].priceCents, 0);
export const mealSubtotal = (lines: readonly Pick<Line, "itemId" | "modifiers" | "qty">[]): number =>
  lines.reduce((sum, line) => sum + line.qty * selectionCents(line), 0);

/** Exact one-per-selected-component validation; it never repairs a cart implicitly. */
export function mealCartConflict(lines: readonly Line[], meal: MealRequirements): string | null {
  if (lines.some(line => MENU[line.itemId].locationId !== meal.locationId)) return "This meal is restricted to its selected counter.";
  if (lines.length !== meal.components.length || lines.some(line => line.qty !== 1)) return "This meal requires exactly one item from each selected component.";
  for (const component of meal.components) {
    if (lines.filter(line => MENU[line.itemId].category === component).length !== 1) return `This meal requires exactly one ${component === "mains" ? "main" : component === "sides" ? "side" : "drink"}.`;
  }
  for (const itemId of meal.lockedItemIds) if (!lines.some(line => line.itemId === itemId)) return `${MENU[itemId].label} is a locked choice.`;
  for (const selection of meal.selections) {
    if (!lines.some(line => line.itemId === selection.itemId && selection.modifiers.every(modifier => line.modifiers.includes(modifier)) && (!meal.lockedItemIds.includes(selection.itemId) || configurationKey(line) === configurationKey(selection)))) return `The requested ${MENU[selection.itemId].label} configuration must be kept.`;
  }
  if (meal.budgetCents !== null && mealSubtotal(lines) > meal.budgetCents) return "The proposed menu subtotal exceeds the active budget.";
  return null;
}

/** Exhaustive streaming enumeration: no network, clock, random choice or search cutoff. */
export function solveMeal(meal: MealRequirements, profile: DietaryProfile, existing: readonly Line[] = [], catalog: readonly Readonly<MenuItem>[] = Object.values(MENU)): MealSolution {
  const summary: SolverSummary = { checkedCombinations: 0, exhaustive: true, minimumCents: null, explanation: "No complete compatible combination was found." };
  const fail = (reason: string): MealSolution => ({ kind: "infeasible", selections: [], totalCents: null, summary: { ...summary, explanation: reason.slice(0, 300) }, reason });
  if (new Set(meal.selections.map(selection => selection.component)).size !== meal.selections.length) return fail("Choose only one requested item for each meal component.");
  for (const selection of meal.selections) {
    const item = catalog.find(item => item.id === selection.itemId);
    if (!item || item.locationId !== meal.locationId || item.category !== selection.component || !meal.components.includes(selection.component)) return fail("A requested item is unavailable for this counter or meal component.");
    if (!selection.modifiers.every(modifier => item.allowedModifiers.includes(modifier))) return fail(`The requested customization is not supported for ${item.label}.`);
  }
  for (const itemId of meal.lockedItemIds) {
    const item = catalog.find(item => item.id === itemId);
    if (!item || item.locationId !== meal.locationId || !meal.components.includes(item.category)) return fail("A locked item is unavailable for the selected meal components and counter.");
  }
  const selectedComponents = components.filter(component => meal.components.includes(component));
  const pools: Selection[][] = [];
  for (const component of selectedComponents) {
    const requested = meal.selections.find(selection => selection.component === component);
    const locked = meal.lockedItemIds.filter(itemId => MENU[itemId].category === component);
    if (locked.length > 1 || (requested && locked.some(itemId => itemId !== requested.itemId))) return fail(`The requested ${component === "mains" ? "main" : component === "sides" ? "side" : "drink"} changes a locked item.`);
    const choices: Selection[] = [];
    for (const item of catalog) {
      if (item.locationId !== meal.locationId || item.category !== component || (requested && requested.itemId !== item.id) || (locked.length && locked[0] !== item.id)) continue;
      const previous = existing.find(line => MENU[line.itemId].category === component && line.qty === 1);
      const requiredModifiers = requested?.modifiers ?? previous?.modifiers ?? [];
      if (!requiredModifiers.every(modifier => item.allowedModifiers.includes(modifier))) continue;
      const lockedModifiers = locked.length ? requested?.modifiers ?? (previous?.itemId === item.id ? previous.modifiers : []) : null;
      // Every supported subset is considered. Requested/preserved modifiers are
      // mandatory; an existing locked configuration has no implicit additions.
      for (let mask = 0; mask < 2 ** item.allowedModifiers.length; mask += 1) {
        const modifiers = item.allowedModifiers.filter((_modifier, index) => (mask & (1 << index)) !== 0);
        if (!requiredModifiers.every(modifier => modifiers.includes(modifier))) continue;
        if (lockedModifiers && [...modifiers].sort().join() !== [...lockedModifiers].sort().join()) continue;
        if (checkCompatibility(item.id, modifiers, profile).status !== "match") continue;
        choices.push({ component, itemId: item.id, modifiers: [...modifiers] });
      }
    }
    choices.sort((left, right) => configurationKey(left).localeCompare(configurationKey(right), "en"));
    if (!choices.length) return fail(`No supported compatible ${component === "mains" ? "main" : component === "sides" ? "side" : "drink"} satisfies these requirements. Check item information or ask staff.`);
    pools.push(choices);
  }
  type Ranked = { selections: Selection[]; cents: number; changes: number; key: string };
  let best: Ranked | null = null;
  let minimum: Ranked | null = null;
  const chosen: Selection[] = [];
  const visit = (index: number) => {
    if (index < pools.length) {
      for (const selection of pools[index]) { chosen.push(selection); visit(index + 1); chosen.pop(); }
      return;
    }
    summary.checkedCombinations += 1;
    const cents = chosen.reduce((sum, selection) => sum + selectionCents(selection), 0);
    const changes = chosen.filter(selection => !existing.some(line => line.qty === 1 && MENU[line.itemId].category === selection.component && configurationKey(line) === configurationKey(selection))).length;
    // A low separator preserves the ordering of each configuration key: an
    // empty modifier set sorts before an unnecessary zero-price customization.
    const key = chosen.map(configurationKey).join("\u0000");
    const candidate: Ranked = { selections: structuredClone(chosen), cents, changes, key };
    if (!minimum || cents < minimum.cents || (cents === minimum.cents && key < minimum.key)) minimum = candidate;
    if (meal.budgetCents !== null && cents > meal.budgetCents) return;
    if (!best || changes < best.changes || (changes === best.changes && (cents < best.cents || (cents === best.cents && key < best.key)))) best = candidate;
  };
  visit(0);
  const cheapest = minimum as Ranked | null;
  const accepted = best as Ranked | null;
  if (!cheapest) return fail("No complete compatible meal exists within the selected counter.");
  summary.minimumCents = cheapest.cents;
  if (!accepted) {
    summary.explanation = "Every compatible combination satisfying the non-price requirements exceeds the proposed menu-subtotal budget.";
    return { kind: "budget", selections: cheapest.selections, totalCents: cheapest.cents, summary, reason: summary.explanation };
  }
  summary.explanation = existing.length ? "Checked every compatible combination; prioritized keeping the accepted meal, then lowest subtotal and stable item IDs." : "Checked every compatible combination; selected the lowest menu subtotal, with stable item IDs for ties.";
  return { kind: "solved", selections: accepted.selections, totalCents: accepted.cents, summary, reason: summary.explanation };
}
