import { LIMITS } from "@/contracts";
import { MESSAGES, reject, type Rejection } from "./messages";
import { normalizeText } from "./normalize";
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

/**
 * Quantity and injection guards on the whole transcript, before any clause splitting,
 * so "18,000" is read as one number. Pure; self-normalizing so callers may pass raw text.
 */
export function guardTranscript(text: string): Rejection | null {
  return guardQuantities(text) ?? guardInjection(text);
}

/** Conservative post-model quantity validation; it never decides natural-language grammar. */
export function guardExplicitQuantities(text: string, maximum: number = LIMITS.quantity): Rejection | null {
  const tokens = quantityTokens(text);
  for (let index = 0; index < tokens.length; index += 1) {
    const reading = readNumber(tokens, index);
    if (!reading) continue;
    if (reading.form === "integer" && (reading.value < 1 || reading.value > maximum)) {
      return reject("QUANTITY_LIMIT", maximum === 1 ? "Build my meal supports one item per selected component. Your requested quantity was not reduced." : MESSAGES.quantityLimit);
    }
    if (reading.form === "decimal") return reject("UNSUPPORTED", MESSAGES.quantityDecimal);
    index += reading.length - 1;
  }
  return null;
}
