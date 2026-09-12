import { LIMITS, type CoreCode, type ItemId, type ModifierId } from "@/contracts";
import {
  DETERMINERS, LAST_PHRASES, MODIFIER_PHRASES, REMOVE_VERBS, RETRACT_VERBS, UNDO_PHRASES,
  type Lexicon, type ModifierChange,
} from "./lexicon";
import { MESSAGES, deferralMessage, reject } from "./messages";
import { startsWith } from "./normalize";
import { readNumber } from "./numbers";

export type ModelRef = { readonly by: "last" } | { readonly by: "item"; readonly itemId: ItemId };

/** What one clause means before batch-level correction logic is applied; `retracts` marks "scratch"/"forget" verbs. */
export type Clause =
  | { readonly kind: "add"; readonly itemId: ItemId; readonly qty: number; readonly modifiers: readonly ModifierId[] }
  | { readonly kind: "remove"; readonly ref: ModelRef; readonly retracts: boolean }
  | { readonly kind: "setQty"; readonly ref: ModelRef; readonly qty: number }
  | { readonly kind: "mod"; readonly ref: ModelRef | null; readonly changes: readonly ModifierChange[] }
  | { readonly kind: "undo" }
  | { readonly kind: "topic"; readonly itemId: ItemId; readonly negated: boolean }
  | { readonly kind: "reject"; readonly code: CoreCode; readonly message: string };

type Span<T> = { readonly value: T; readonly next: number };

const REVIEW_INTENTS = [/^(?:review|confirm|checkout|check out|pay)\b/, /\bread\b.*\bback\b/, /\bwhat'?s in my\b/, /\bmy (?:cart|order)\b/];
const DEFERRAL_INTENTS = [/\b(?:later|at the end|for now|hold off)\b/, /\bi'?ll decide\b/, /^skip\b/];
const DEFERRAL_TOPICS: readonly [RegExp, string][] = [[/\b(?:drink|lemonade)/, "the drink"], [/\bfries\b/, "the fries"], [/\bburger/, "the burger"]];
const MAX_UNKNOWN_NOUN_WORDS = 3;
const TARGET_PREPOSITIONS: ReadonlySet<string> = new Set(["on", "for", "to"]);
const WORD = /^[a-z']+$/;
const UNSUPPORTED = reject("UNSUPPORTED", MESSAGES.unsupported);

export function matchItem(tokens: readonly string[], index: number, lexicon: Lexicon): Span<ItemId> | null {
  const alias = lexicon.itemAliases.find((candidate) => startsWith(tokens, index, candidate.tokens));
  return alias ? { value: alias.itemId, next: index + alias.tokens.length } : null;
}

function matchLast(tokens: readonly string[], index: number): number | null {
  const phrase = LAST_PHRASES.find((candidate) => startsWith(tokens, index, candidate));
  return phrase ? index + phrase.length : null;
}

/** A modifier phrase, optionally introduced by "with" ("with no onions", "with extra cheese"). */
function matchModifier(tokens: readonly string[], index: number): Span<ModifierChange> | null {
  const direct = MODIFIER_PHRASES.find((phrase) => startsWith(tokens, index, phrase.tokens));
  if (direct) return { value: { modifier: direct.modifier, enabled: direct.enabled }, next: index + direct.tokens.length };
  if (tokens[index] !== "with") return null;
  const after = MODIFIER_PHRASES.find((phrase) => startsWith(tokens, index + 1, phrase.tokens));
  return after ? { value: { modifier: after.modifier, enabled: after.enabled }, next: index + 1 + after.tokens.length } : null;
}

function readModifiers(tokens: readonly string[], index: number): Span<readonly ModifierChange[]> {
  const changes: ModifierChange[] = [];
  let next = index;
  for (let match = matchModifier(tokens, next); match; match = matchModifier(tokens, next)) {
    changes.push(match.value);
    next = match.next;
  }
  return { value: changes, next };
}

export function applyChanges(modifiers: readonly ModifierId[], changes: readonly ModifierChange[]): ModifierId[] {
  return changes.reduce<ModifierId[]>((current, change) => {
    if (!change.enabled) return current.filter((modifier) => modifier !== change.modifier);
    return current.includes(change.modifier) ? current : [...current, change.modifier];
  }, [...modifiers]);
}

/** "that", "it", "the last one" → last; "[the] ITEM" → item. */
function matchTarget(tokens: readonly string[], index: number, lexicon: Lexicon): Span<ModelRef> | null {
  const last = matchLast(tokens, index);
  if (last !== null) return { value: { by: "last" }, next: last };
  const start = DETERMINERS.has(tokens[index] ?? "") ? index + 1 : index;
  const item = matchItem(tokens, start, lexicon);
  return item ? { value: { by: "item", itemId: item.value }, next: item.next } : null;
}

function parseIntent(tokens: readonly string[]): Clause | null {
  const text = tokens.join(" ");
  if (REVIEW_INTENTS.some((pattern) => pattern.test(text))) return reject("UNSUPPORTED", MESSAGES.review);
  if (!DEFERRAL_INTENTS.some((pattern) => pattern.test(text))) return null;
  const topic = DEFERRAL_TOPICS.find(([pattern]) => pattern.test(text))?.[1] ?? "the rest";
  return reject("UNSUPPORTED", deferralMessage(topic));
}

function parseRemove(tokens: readonly string[], lexicon: Lexicon): Clause | null {
  let index = 0;
  let needsOff = false;
  if (tokens[0] === "take" && tokens[1] === "off") index = 2;
  else if (tokens[0] === "take") { index = 1; needsOff = true; }
  else if (REMOVE_VERBS.has(tokens[0])) index = 1;
  else return null;
  const target = matchTarget(tokens, index, lexicon);
  if (!target) return UNSUPPORTED;
  index = target.next;
  if (needsOff) {
    if (tokens[index] !== "off") return UNSUPPORTED;
    index += 1;
  }
  if (index !== tokens.length) return UNSUPPORTED;
  return { kind: "remove", ref: target.value, retracts: RETRACT_VERBS.has(tokens[0]) };
}

/** "make that two" is a quantity; "make the burger a double" is a modifier. A trailing "instead" is a marker, stripped earlier. */
function parseMake(tokens: readonly string[], lexicon: Lexicon): Clause | null {
  if (tokens[0] !== "make") return null;
  const target = matchTarget(tokens, 1, lexicon);
  if (!target) return UNSUPPORTED;
  const articleSkipped = tokens[target.next] === "a" || tokens[target.next] === "an" ? target.next + 1 : target.next;
  const modifier = matchModifier(tokens, target.next) ?? matchModifier(tokens, articleSkipped);
  if (modifier) {
    return modifier.next === tokens.length ? { kind: "mod", ref: target.value, changes: [modifier.value] } : UNSUPPORTED;
  }
  const number = readNumber(tokens, target.next);
  if (!number || number.form !== "integer" || number.value < 1 || number.value > LIMITS.quantity) return UNSUPPORTED;
  return target.next + number.length === tokens.length ? { kind: "setQty", ref: target.value, qty: number.value } : UNSUPPORTED;
}

/** A clause that is only modifier phrases ("no onions", "a double"), optionally "on the burger" / "on that". */
function parseModifierOnly(tokens: readonly string[], lexicon: Lexicon): Clause | null {
  const start = (tokens[0] === "a" || tokens[0] === "an") && matchModifier(tokens, 1) ? 1 : 0;
  const modifiers = readModifiers(tokens, start);
  if (modifiers.value.length === 0) return null;
  let ref: ModelRef | null = null;
  let next = modifiers.next;
  if (TARGET_PREPOSITIONS.has(tokens[next] ?? "")) {
    const target = matchTarget(tokens, next + 1, lexicon);
    if (!target) return UNSUPPORTED;
    ref = target.value;
    next = target.next;
  }
  return next === tokens.length ? { kind: "mod", ref, changes: modifiers.value } : null;
}

/** "the lemonade" names a topic; "not the fries" negates one (used by "not X, I mean Y, remove it"). */
function parseTopic(tokens: readonly string[], lexicon: Lexicon): Clause | null {
  const negated = tokens[0] === "not";
  const start = negated ? 1 : 0;
  if (tokens[start] !== "the") return null;
  const item = matchItem(tokens, start + 1, lexicon);
  return item && item.next === tokens.length ? { kind: "topic", itemId: item.value, negated } : null;
}

function isUnknownNounWord(token: string, lexicon: Lexicon): boolean {
  return WORD.test(token) && (!lexicon.vocabulary.has(token) || lexicon.aliasTokens.has(token));
}

/** `[qty] <unknown noun>` is off-menu; anything else left over is unsupported. */
function rejectLeftover(tokens: readonly string[], index: number, lexicon: Lexicon): Clause {
  let end = index;
  while (end < tokens.length && end - index < MAX_UNKNOWN_NOUN_WORDS && isUnknownNounWord(tokens[end], lexicon)) end += 1;
  if (end === index) return UNSUPPORTED;
  const trailing = readModifiers(tokens, end);
  return trailing.next === tokens.length ? reject("OFF_MENU", MESSAGES.offMenu) : UNSUPPORTED;
}

function parseAdd(tokens: readonly string[], lexicon: Lexicon): Clause {
  let index = tokens[0] === "add" ? 1 : 0;
  let qty = 1;
  const number = readNumber(tokens, index);
  if (number) {
    // The guard already rejected these on the whole string; this only keeps the matcher total.
    if (number.form === "decimal") return reject("UNSUPPORTED", MESSAGES.quantityDecimal);
    if (number.form === "vague") return reject("UNSUPPORTED", MESSAGES.quantityVague);
    if (number.form === "malformed") return reject("UNSUPPORTED", MESSAGES.quantityMalformed);
    if (number.value < 1 || number.value > LIMITS.quantity) return reject("QUANTITY_LIMIT", MESSAGES.quantityLimit);
    qty = number.value;
    index += number.length;
  }
  const leading: ModifierChange[] = [];
  if (tokens[index] === "double") {
    leading.push({ modifier: "double", enabled: true });
    index += 1;
  }
  const item = matchItem(tokens, index, lexicon);
  if (!item) return rejectLeftover(tokens, index, lexicon);
  const trailing = readModifiers(tokens, item.next);
  if (trailing.next !== tokens.length) return UNSUPPORTED;
  return { kind: "add", itemId: item.value, qty, modifiers: applyChanges([], [...leading, ...trailing.value]) };
}

/** Matchers run in priority order; the first that claims the clause wins. Nothing is guessed. */
export function parseClause(tokens: readonly string[], lexicon: Lexicon): Clause {
  if (UNDO_PHRASES.has(tokens.join(" "))) return { kind: "undo" };
  const claimed = parseIntent(tokens) ?? parseRemove(tokens, lexicon) ?? parseMake(tokens, lexicon) ?? parseModifierOnly(tokens, lexicon) ?? parseTopic(tokens, lexicon);
  if (claimed) return claimed;
  if (tokens[0] === "no" && matchItem(tokens, 1, lexicon)) return reject("UNSUPPORTED", MESSAGES.noItem);
  return parseAdd(tokens, lexicon);
}
