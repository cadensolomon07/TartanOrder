import { CORRECTION_MARKERS, DROP_MARKERS } from "./lexicon";

/** Closed filler list. "like" is handled per clause because it is filler only at a clause start. */
const FILLER_PHRASES = [
  "can i get", "can i have", "could i get", "could i have", "i'd like", "i would like", "i want", "give me", "gimme",
  "let me get", "please", "um", "uh",
];
const FILLER_PATTERN = new RegExp(`\\b(?:${FILLER_PHRASES.map((phrase) => phrase.replace(/'/g, "\\'")).join("|")})\\b`, "g");
const CLAUSE_LEAD_FILLERS: ReadonlySet<string> = new Set(["like", "and"]);

/** Commas split clauses except inside a thousands group; so do "and", "then" and "plus". */
const CLAUSE_SEPARATOR = /(?<!\d),|,(?!\d{3}\b)|\s+(?:and|then|plus)\s+/;

export type MarkedTokens = { readonly tokens: readonly string[]; readonly corrected: boolean; readonly drop: boolean };

export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/&/g, " and ")
    .replace(/[—–;]|\s-+\s/g, " , ")
    .replace(/-/g, " ")
    .replace(FILLER_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Terminal punctuation only; a leading dot that starts a decimal (".5") must survive for the quantity guard.
    .replace(/^(?:[,!?\s]|\.(?!\d))+|[,.!?\s]+$/g, "");
}

export function splitClauses(text: string): string[] {
  return text.split(CLAUSE_SEPARATOR).map((clause) => clause.trim()).filter((clause) => clause.length > 0);
}

export function tokenizeClause(clause: string): string[] {
  const tokens = clause.split(" ").map((token) => token.replace(/[.!?]+$/, "")).filter((token) => token.length > 0);
  let start = 0;
  while (start < tokens.length && CLAUSE_LEAD_FILLERS.has(tokens[start])) start += 1;
  return tokens.slice(start);
}

export function startsWith(tokens: readonly string[], index: number, phrase: readonly string[]): boolean {
  return phrase.every((word, offset) => tokens[index + offset] === word);
}

function leadingMarker(tokens: readonly string[], markers: readonly (readonly string[])[]): number {
  const match = markers.find((marker) => startsWith(tokens, 0, marker));
  return match ? match.length : 0;
}

/** Strips leading correction/drop markers, recording which kind appeared. */
export function stripMarkers(tokens: readonly string[]): MarkedTokens {
  let rest = tokens;
  let corrected = false;
  let drop = false;
  for (;;) {
    const dropLength = leadingMarker(rest, DROP_MARKERS);
    if (dropLength > 0) { drop = true; rest = rest.slice(dropLength); continue; }
    const correctionLength = leadingMarker(rest, CORRECTION_MARKERS);
    if (correctionLength > 0) { corrected = true; rest = rest.slice(correctionLength); continue; }
    return { tokens: rest, corrected, drop };
  }
}
