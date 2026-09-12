import { LIMITS, type ItemId, type Op, type ParseRequest, type ParseResult, type Ref } from "@/contracts";
import { MENU, itemsForLocation, locationName, type MenuItem } from "@/contracts/menu";
import { guardExplicitQuantities } from "./rules/guards";
import { readNumber } from "./rules/numbers";

type Item = Readonly<MenuItem>;
type Rejection = Extract<ParseResult, { kind: "reject" }>;
type Addition = { items: Item[]; qty: number } | Rejection;
const reject = (code: Rejection["code"], message: string): Rejection => ({ kind: "reject", code, message });
const proposal = (ops: Op[]): ParseResult => ({ kind: "proposal", ops });

export function normalizeCampusName(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

function names(item: Item): string[] {
  return [...new Set([item.label, ...item.aliases].map(normalizeCampusName))];
}

/** Exact canonical aliases win; an incomplete name can only identify candidates. */
function matchingItems(text: string, items: readonly Item[]): Item[] {
  const query = normalizeCampusName(text);
  if (!query) return [];
  const exact = items.filter((item) => names(item).includes(query));
  if (exact.length) return exact;
  return items.filter((item) => names(item).some((name) => ` ${name} `.includes(` ${query} `)));
}

function quantity(text: string): number | Rejection | null {
  const tokens = text.trim().toLowerCase().split(/\s+/);
  const number = readNumber(tokens, 0);
  if (!number || number.length !== tokens.length) return null;
  if (number.form !== "integer" && number.form !== "article") {
    return reject("UNSUPPORTED", `Use a whole-number quantity from 1 to ${LIMITS.quantity}.`);
  }
  if (number.value < 1 || number.value > LIMITS.quantity) {
    return reject("QUANTITY_LIMIT", `Choose a quantity from 1 to ${LIMITS.quantity}; quantities are never clamped.`);
  }
  return number.value;
}

function clean(text: string): string {
  return text.normalize("NFKC").trim().toLowerCase().replace(/[.!?]+$/g, "").replace(/^please\s+|\s+please$/g, "").trim();
}

function addition(text: string, items: readonly Item[]): Addition | null {
  const source = clean(text).replace(/^(?:add|order|i want|i would like|i'd like|can i get|i will take|i'll take)\s+/, "");
  // Try the complete name before reading a quantity: '3 Piece Chicken Tenders'
  // and 'Latte 12 oz' identify one published item, not three or twelve units.
  const full = matchingItems(source, items);
  if (full.length) return { items: full, qty: 1 };
  const tokens = source.split(/\s+/);
  for (let index = 1; index < tokens.length; index += 1) {
    const matches = matchingItems(tokens.slice(index).join(" "), items);
    if (!matches.length) continue;
    const count = quantity(tokens.slice(0, index).join(" "));
    if (count === null) continue;
    return typeof count === "number" ? { items: matches, qty: count } : count;
  }
  return null;
}

function askForItem(items: readonly Item[], qty: number): ParseResult {
  return {
    kind: "clarify",
    question: items.length > LIMITS.choices
      ? "Which exact menu item and size would you like? Choose its full name from the menu."
      : "Which menu item or size would you like?",
    choices: items.length > LIMITS.choices ? [] : items.map((item, index) => ({
      id: `campus-item-${index + 1}`, label: item.label.slice(0, LIMITS.labelChars),
      ops: [{ type: "ADD", itemId: item.id, qty, modifiers: [] }],
    })),
  };
}

/** A simple ambiguous name remains ambiguous even if a model picked one variant. */
export function campusAdditionAmbiguity(req: ParseRequest): ParseResult | null {
  if ((req.locationId ?? "demo") === "demo") return null;
  const parsed = addition(req.text, itemsForLocation(req.locationId!));
  return parsed && !("kind" in parsed) && parsed.items.length > 1 ? askForItem(parsed.items, parsed.qty) : null;
}

/** Ignore only intrinsic menu-name numbers; an explicit leading quantity remains. */
export function guardCampusQuantities(req: ParseRequest, maximum: number = LIMITS.quantity): Rejection | null {
  const items = [...itemsForLocation(req.locationId ?? "demo"), ...(req.context?.lines.map((line) => MENU[line.itemId]) ?? [])];
  let text = req.text.normalize("NFKC").toLowerCase().replace(/[’']/g, "").replace(/&/g, " and ");
  const aliases = [...new Set(items.flatMap((item) => [item.label, ...item.aliases]))]
    .filter((alias) => /\d/.test(alias)).sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    const words = normalizeCampusName(alias).split(" ").map(escapePattern);
    // Punctuation in published names is presentation, not a new quantity.
    const pattern = new RegExp(`(?<![a-z0-9.,-])${words.join("[\\s()–—-]*")}(?![a-z0-9])`, "g");
    text = text.replace(pattern, "menu item");
  }
  // A published measurement can be said before its item: 'a 12 oz latte'.
  const measures = new Set(items.flatMap((item) => [...[item.label, ...item.aliases].join(" ").matchAll(/\b(\d+(?:\.\d+)?)\s*(oz|ounces?|pieces?)\b/gi)].map((match) => `${match[1]}:${match[2].toLowerCase()}`)));
  for (const measure of measures) {
    const [value, unit] = measure.split(":");
    const units = unit.startsWith("oz") || unit.startsWith("ounce") ? "(?:oz|ounces?)" : "pieces?";
    text = text.replace(new RegExp(`(?<![\\d.,-])${escapePattern(value)}\\s*${units}\\b`, "g"), "menu size");
  }
  return guardExplicitQuantities(text, maximum);
}

function escapePattern(text: string): string { return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function reference(text: string, req: ParseRequest, make: (ref: Ref) => Op): ParseResult {
  const name = clean(text).replace(/^(?:the|my)\s+/, "");
  if (["last", "last item", "last one", "it", "that", "that one"].includes(name)) return proposal([make({ by: "last" })]);
  const cart = req.context?.lines ?? [];
  const cartItems = [...new Set(cart.map((line) => line.itemId))].map((id) => MENU[id]);
  const matches = matchingItems(name, cartItems);
  if (matches.length === 1) return proposal([make({ by: "item", itemId: matches[0].id })]);
  if (matches.length > 1) {
    const ids = new Set<ItemId>(matches.map((item) => item.id));
    const lines = cart.filter((line) => ids.has(line.itemId));
    return { kind: "clarify", question: "Which cart item did you mean?", choices: lines.length > LIMITS.choices ? [] : lines.map((line, index) => ({
      id: `campus-line-${index + 1}`, label: `${MENU[line.itemId].label} (cart row ${cart.indexOf(line) + 1})`.slice(0, LIMITS.labelChars),
      ops: [make({ by: "line", lineId: line.lineId })],
    })) };
  }
  return reject("UNKNOWN_REFERENCE", "That item isn't in your cart. Select its cart row or use its full menu name.");
}

/** Narrow offline grammar over the canonical selected menu; no network or prices. */
export function parseCampusText(req: ParseRequest): ParseResult {
  const text = clean(req.text);
  if (["undo", "undo that", "undo it", "go back"].includes(text)) return proposal([{ type: "UNDO" }]);
  if (/^(?:remove|delete|take off)\s+/.test(text)) {
    return reference(text.replace(/^(?:remove|delete|take off)\s+/, ""), req, (ref) => ({ type: "REMOVE", ref }));
  }
  const set = text.match(/^(?:make|set)\s+(.+)$/);
  if (set) {
    const words = set[1].split(/\s+/);
    for (let index = 1; index < words.length; index += 1) {
      const count = quantity(words.slice(index).join(" "));
      if (count === null) continue;
      if (typeof count !== "number") return count;
      return reference(words.slice(0, index).join(" ").replace(/\s+(?:to|quantity)$/, ""), req, (ref) => ({ type: "SET_QTY", ref, qty: count }));
    }
  }
  const items = itemsForLocation(req.locationId ?? "demo");
  if (!items.length) return reject("OFF_MENU", `We don't have a verified priced menu for ${locationName(req.locationId ?? "demo")}. Use its official menu link or choose another location.`);
  const guarded = guardCampusQuantities(req);
  if (guarded) return guarded;
  const parsed = addition(text, items);
  if (!parsed) return reject("UNSUPPORTED", "Local rules support one exact menu item and quantity at a time, remove, make an item a quantity, and undo. Use the menu or enable Gemini for other wording.");
  if ("kind" in parsed) return parsed;
  if (parsed.items.length > 1) return askForItem(parsed.items, parsed.qty);
  return proposal([{ type: "ADD", itemId: parsed.items[0].id, qty: parsed.qty, modifiers: [] }]);
}
