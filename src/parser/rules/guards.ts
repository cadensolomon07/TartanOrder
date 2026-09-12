import { LIMITS } from "@/contracts";
import { MESSAGES, reject, type Rejection } from "./messages";
import { ITEM_ALIASES, STUTTER_WORDS } from "./lexicon";
import { normalizeText, startsWith } from "./normalize";
import { readNumber } from "./numbers";

const THOUSANDS_TOKEN = /^-?\d{1,3}(?:,\d{3})+$/;
const EDGE_PUNCTUATION = /^,+|[,.]+$/g;

/** Closed list; word-bounded so "no onions please" and "freeze" never trigger. */
const INJECTION_WORDS = [
  "ignore", "instructions?", "system", "prompts?", "free", "discounts?", "prices?", "refunds?", "admin", "override",
  "developer", "jailbreak",
];
const INJECTION_PATTERN = new RegExp(`\\b(?:${INJECTION_WORDS.join("|")})\\b|[{}$]|"kind"`, "i");

/** Splits "1,2" into separate numbers while keeping "18,000" whole. */
function splitLooseCommas(token: string): string[] {
  return THOUSANDS_TOKEN.test(token) ? [token] : token.split(",");
}

/**
 * Alphanumerics with thousands commas, decimal points and numeric signs kept. The text goes
 * through the same `normalizeText` as the grammar (idempotent on normalized input), so a
 * caller passing raw transcript text — the route's gemini-mode pre-guard — sees exactly the
 * filler removal and stutter collapse the rules path sees.
 */
function quantityTokens(text: string): string[] {
  return normalizeText(text)
    .replace(/[^a-z0-9,.-]+/g, " ")
    .split(" ")
    .flatMap(splitLooseCommas)
    .map((token) => token.replace(EDGE_PUNCTUATION, ""))
    .filter((token) => token.length > 0);
}

function guardQuantities(text: string): Rejection | null {
  const tokens = quantityTokens(text);
  let index = 0;
  while (index < tokens.length) {
    const reading = readNumber(tokens, index);
    if (!reading) { index += 1; continue; }
    if (reading.form === "decimal") return reject("UNSUPPORTED", MESSAGES.quantityDecimal);
    if (reading.form === "vague") return reject("UNSUPPORTED", MESSAGES.quantityVague);
    if (reading.form === "malformed") return reject("UNSUPPORTED", MESSAGES.quantityMalformed);
    // Negative values arrive here with their sign intact and fail the lower bound.
    if (reading.form === "integer" && (reading.value < 1 || reading.value > LIMITS.quantity)) {
      return reject("QUANTITY_LIMIT", MESSAGES.quantityLimit);
    }
    index += reading.length;
  }
  return null;
}

function guardInjection(text: string): Rejection | null {
  return INJECTION_PATTERN.test(text) ? reject("UNSUPPORTED", MESSAGES.injection) : null;
}

/** Tokens that may sit inside a stutter without making it a list: articles and hesitations, never "and". */
const STUTTER_GAP: ReadonlySet<string> = new Set(STUTTER_WORDS.filter((word) => word !== "and"));

/** The surface form of the item alias starting at `index`, longest alias first, or null. */
function aliasAt(tokens: readonly string[], index: number): { form: string; length: number } | null {
  const alias = ITEM_ALIASES.find((candidate) => startsWith(tokens, index, candidate.tokens));
  return alias ? { form: alias.tokens.join(" "), length: alias.tokens.length } : null;
}

/**
 * An item name repeated back-to-back with only articles or hesitations between the repeats
 * ("burger burger burger um a burger", "a burger a burger fries") is recogniser stutter: the
 * intended count is unknowable, so the transcript is refused before any parser — grammar or
 * model — can turn each repeat into a line. "a burger and a burger", "burger, burger" and
 * "two burgers" are real lists or counts and pass through untouched.
 */
function guardStutter(text: string): Rejection | null {
  const tokens = normalizeText(text).replace(/,/g, " , ").split(/\s+/).filter((token) => token.length > 0);
  let previous: string | null = null;
  let index = 0;
  while (index < tokens.length) {
    const alias = aliasAt(tokens, index);
    if (alias) {
      if (alias.form === previous) return reject("UNSUPPORTED", MESSAGES.stutter);
      previous = alias.form;
      index += alias.length;
      continue;
    }
    if (!STUTTER_GAP.has(tokens[index])) previous = null;
    index += 1;
  }
  return null;
}

/**
 * Quantity, injection and stutter guards on the whole transcript, before any clause
 * splitting, so "18,000" is read as one number. Pure; self-normalizing so callers may pass
 * raw text. The route runs this before a Gemini call, so none of these ever reach a model.
 */
export function guardTranscript(text: string): Rejection | null {
  return guardQuantities(text) ?? guardInjection(text) ?? guardStutter(text);
}
