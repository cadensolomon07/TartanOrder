import {
  ALIAS_TOKENS, CORRECTION_MARKERS, DROP_MARKERS, STUTTER_COMMAND_VERBS, STUTTER_WORDS, TRAILING_CORRECTION_MARKERS,
} from "./lexicon";
import { readNumber } from "./numbers";

/** Closed filler list. "like" is handled per clause because it is filler only at a clause start. */
const FILLER_PHRASES = [
  "can i get", "can i have", "could i get", "could i have", "i'd like", "i would like", "i want", "give me", "gimme",
  "let me get", "please", "um", "uh",
];
const FILLER_PATTERN = new RegExp(`\\b(?:${FILLER_PHRASES.map((phrase) => phrase.replace(/'/g, "\\'")).join("|")})\\b`, "g");
const CLAUSE_LEAD_FILLERS: ReadonlySet<string> = new Set(["like", "and"]);

/** "the the" → "the". Runs on the space-normalized string, so every repeat is one whole word after another. */
const STUTTER_PATTERN = new RegExp(`\\b(${STUTTER_WORDS.join("|")})(?: \\1\\b)+`, "g");
/** A stuttered command prefix is two or three tokens ("make that make that two", "take off the take off the fries"). */
const STUTTER_PREFIX_LENGTHS: readonly number[] = [2, 3];

/** Commas split clauses except inside a thousands group; so do "and", "then" and "plus". */
const CLAUSE_SEPARATOR = /(?<!\d),|,(?!\d{3}\b)|\s+(?:and|then|plus)\s+/;

/**
 * A hyphen, minus sign or en dash directly before a digit at token start is a numeric
 * sign ("-2", "−2", "–2"); it must survive to the quantity guard. Every other hyphen
 * or minus is a word break ("twenty-one", "lemon-ade").
 */
const SIGN_DASH = /(?<![a-z0-9])[-−–](?=\d)/g;
const HYPHEN = /(?<=[a-z0-9])[-−]|[-−](?!\d)/g;

export type MarkedTokens = { readonly tokens: readonly string[]; readonly corrected: boolean; readonly drop: boolean };

/** Canonicalizes dashes in lower-cased text: numeric signs become "-", hyphens become spaces. */
export function foldDashes(text: string): string {
  return text.replace(SIGN_DASH, "-").replace(HYPHEN, " ");
}

export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/&/g, " and ")
    .replace(SIGN_DASH, "-")
    .replace(/[—–;]|\s-+\s/g, " , ")
    .replace(HYPHEN, " ")
    .replace(FILLER_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(STUTTER_PATTERN, "$1")
    // Terminal punctuation only; a leading dot that starts a decimal (".5") must survive for the quantity guard.
    .replace(/^(?:[,!?\s]|\.(?!\d))+|[,.!?\s]+$/g, "");
}

export function splitClauses(text: string): string[] {
  return text.split(CLAUSE_SEPARATOR).map((clause) => clause.trim()).filter((clause) => clause.length > 0);
}

export function startsWith(tokens: readonly string[], index: number, phrase: readonly string[]): boolean {
  return phrase.every((word, offset) => tokens[index + offset] === word);
}

/** An item alias or a quantity (a bare article is neither): repeating one may be a count, so it is never collapsed. */
function isContentToken(tokens: readonly string[], index: number): boolean {
  if (ALIAS_TOKENS.has(tokens[index])) return true;
  const number = readNumber(tokens, index);
  return number !== null && number.form !== "article";
}

/** A prefix is a collapsible stutter only when it opens with a command verb or correction marker and names no item or quantity. */
function isCommandPrefix(prefix: readonly string[]): boolean {
  const opensCommand = STUTTER_COMMAND_VERBS.has(prefix[0]) || CORRECTION_MARKERS.some((marker) => startsWith(prefix, 0, marker));
  return opensCommand && !prefix.some((_, index) => isContentToken(prefix, index));
}

/** "make that make that two" → "make that two": drops the first copy of an immediately repeated command prefix. */
function collapseStutteredPrefix(tokens: readonly string[]): string[] {
  const length = STUTTER_PREFIX_LENGTHS.find((candidate) => {
    const prefix = tokens.slice(0, candidate);
    return prefix.length === candidate && startsWith(tokens, candidate, prefix) && isCommandPrefix(prefix);
  });
  return tokens.slice(length ?? 0);
}

export function tokenizeClause(clause: string): string[] {
  const tokens = clause.split(" ").map((token) => token.replace(/[.!?]+$/, "")).filter((token) => token.length > 0);
  let start = 0;
  while (start < tokens.length && CLAUSE_LEAD_FILLERS.has(tokens[start])) start += 1;
  return tokens.slice(start);
}

function leadingMarker(tokens: readonly string[], markers: readonly (readonly string[])[]): number {
  const match = markers.find((marker) => startsWith(tokens, 0, marker));
  return match ? match.length : 0;
}

function trailingMarker(tokens: readonly string[], markers: readonly (readonly string[])[]): number {
  const match = markers.find((marker) => marker.length <= tokens.length && startsWith(tokens, tokens.length - marker.length, marker));
  return match ? match.length : 0;
}

/**
 * Strips leading correction/drop markers and a trailing "instead", recording which kind appeared.
 * A stuttered command prefix is peeled in the same loop, so "actually make that make that two"
 * collapses behind its marker as well as at a bare clause start.
 */
export function stripMarkers(tokens: readonly string[]): MarkedTokens {
  let rest = tokens;
  let corrected = false;
  let drop = false;
  for (;;) {
    const collapsed = collapseStutteredPrefix(rest);
    if (collapsed.length < rest.length) { rest = collapsed; continue; }
    const dropLength = leadingMarker(rest, DROP_MARKERS);
    if (dropLength > 0) { drop = true; rest = rest.slice(dropLength); continue; }
    const correctionLength = leadingMarker(rest, CORRECTION_MARKERS);
    if (correctionLength > 0) { corrected = true; rest = rest.slice(correctionLength); continue; }
    break;
  }
  const trailingLength = trailingMarker(rest, TRAILING_CORRECTION_MARKERS);
  if (trailingLength > 0) return { tokens: rest.slice(0, -trailingLength), corrected: true, drop };
  return { tokens: rest, corrected, drop };
}
