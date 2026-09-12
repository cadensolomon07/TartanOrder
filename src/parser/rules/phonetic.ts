import type { ItemId } from "@/contracts";
import type { Lexicon } from "./lexicon";
import { tokenizeClause } from "./normalize";

/**
 * Menu-derived phonetic near-miss table (D11). A near-miss only ever produces a
 * clarification; exact aliases never pass through here.
 */
const MIN_KEY_LENGTH = 3;
/** Two-word mishearings are joined into one unknown token so token-level matching can see them. */
const NEAR_MISS_JOINS: readonly (readonly [string, string])[] = [["lemon aid", "lemonaid"], ["lemon ade", "lemonaid"]];
/** Curated mishearings the key function cannot reach. */
const NEAR_MISS_TOKENS: Readonly<Record<string, ItemId>> = {
  lemonaid: "lemonade", lemonaide: "lemonade", burgr: "burger", burgher: "burger", booger: "burger", boogers: "burger",
  flies: "fries", frys: "fries", fry: "fries",
};

export type NearMissResult = { readonly count: number; readonly itemId: ItemId | null; readonly clauses: readonly string[] };

/** Metaphone-lite: fold common consonant spellings, drop non-leading vowels, collapse repeats. */
export function phoneticKey(word: string): string {
  const letters = word.toLowerCase().replace(/[^a-z]/g, "");
  if (letters.length === 0) return "";
  const folded = letters.replace(/ph/g, "f").replace(/gh/g, "g").replace(/ck/g, "k").replace(/c/g, "k").replace(/z/g, "s").replace(/y/g, "i");
  return (folded[0] + folded.slice(1).replace(/[aeiou]/g, "")).replace(/(.)\1+/g, "$1");
}

const ALIAS_KEYS = new WeakMap<Lexicon, ReadonlyMap<string, ItemId>>();

/** Single-token alias → item by phonetic key, derived once per lexicon. */
function aliasKeys(lexicon: Lexicon): ReadonlyMap<string, ItemId> {
  const cached = ALIAS_KEYS.get(lexicon);
  if (cached) return cached;
  const keys: ReadonlyMap<string, ItemId> = new Map(
    lexicon.itemAliases.filter((alias) => alias.tokens.length === 1).map((alias) => [phoneticKey(alias.tokens[0]), alias.itemId] as const),
  );
  ALIAS_KEYS.set(lexicon, keys);
  return keys;
}

function nearMiss(token: string, lexicon: Lexicon): ItemId | null {
  if (lexicon.vocabulary.has(token) || /\d/.test(token)) return null;
  const curated = Object.hasOwn(NEAR_MISS_TOKENS, token) ? NEAR_MISS_TOKENS[token] : null;
  const match = curated ?? (token.length < MIN_KEY_LENGTH ? null : aliasKeys(lexicon).get(phoneticKey(token)) ?? null);
  // A curated target that the loaded catalog does not carry cannot be offered.
  return match !== null && lexicon.menu.item(match) !== undefined ? match : null;
}

export function joinNearMissPhrases(text: string): string {
  return NEAR_MISS_JOINS.reduce((current, [phrase, joined]) => current.replace(new RegExp(`\\b${phrase}\\b`, "g"), joined), text);
}

/** Counts near-miss tokens across the utterance and returns the clauses with the substitution applied. */
export function findNearMisses(clauses: readonly string[], lexicon: Lexicon): NearMissResult {
  let count = 0;
  let itemId: ItemId | null = null;
  const substituted = clauses.map((clause) => tokenizeClause(clause).map((token) => {
    const match = nearMiss(token, lexicon);
    if (!match) return token;
    count += 1;
    itemId = match;
    return lexicon.menu.item(match)?.aliases[0] ?? token;
  }).join(" "));
  return { count, itemId, clauses: substituted };
}
