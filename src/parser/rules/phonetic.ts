import type { ItemId } from "@/contracts";
import { MENU } from "@/contracts/menu";
import { ITEM_ALIASES, VOCABULARY } from "./lexicon";
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

const ALIAS_KEYS: ReadonlyMap<string, ItemId> = new Map(
  ITEM_ALIASES.filter((alias) => alias.tokens.length === 1).map((alias) => [phoneticKey(alias.tokens[0]), alias.itemId]),
);

function nearMiss(token: string): ItemId | null {
  if (VOCABULARY.has(token) || /\d/.test(token)) return null;
  if (Object.hasOwn(NEAR_MISS_TOKENS, token)) return NEAR_MISS_TOKENS[token];
  if (token.length < MIN_KEY_LENGTH) return null;
  return ALIAS_KEYS.get(phoneticKey(token)) ?? null;
}

export function joinNearMissPhrases(text: string): string {
  return NEAR_MISS_JOINS.reduce((current, [phrase, joined]) => current.replace(new RegExp(`\\b${phrase}\\b`, "g"), joined), text);
}

/** Counts near-miss tokens across the utterance and returns the clauses with the substitution applied. */
export function findNearMisses(clauses: readonly string[]): NearMissResult {
  let count = 0;
  let itemId: ItemId | null = null;
  const substituted = clauses.map((clause) => tokenizeClause(clause).map((token) => {
    const match = nearMiss(token);
    if (!match) return token;
    count += 1;
    itemId = match;
    return MENU[match].aliases[0];
  }).join(" "));
  return { count, itemId, clauses: substituted };
}
