import { ModifierIdSchema, type Catalog, type ItemId, type ModifierId } from "@/contracts";
import { indexCatalog, type CatalogIndex } from "@/catalog/lookup";

/** One surface form for a menu item: alias tokens (singular or derived plural) → item. */
export type ItemAlias = { readonly tokens: readonly string[]; readonly itemId: ItemId };
export type ModifierChange = { readonly modifier: ModifierId; readonly enabled: boolean };
export type ModifierPhrase = ModifierChange & { readonly tokens: readonly string[] };

/**
 * The menu-derived half of the grammar, built from a loaded catalog (its Demo Counter items)
 * instead of at import time. Everything else in this module is a fixed table of English.
 */
export type Lexicon = {
  readonly menu: CatalogIndex;
  /** Alias forms, longest first, so "french fries" wins over "fries". */
  readonly itemAliases: readonly ItemAlias[];
  readonly aliasTokens: ReadonlySet<string>;
  /** When exactly one menu item accepts a modifier, a standalone modifier phrase targets that item (D2). */
  readonly soleItemForModifier: Readonly<Partial<Record<ModifierId, ItemId>>>;
  /** Every token the grammar can consume; anything else is unknown and fails closed. */
  readonly vocabulary: ReadonlySet<string>;
};

function pluralOf(alias: string): string | null {
  return alias.endsWith("s") ? null : `${alias}s`;
}

/** Spoken modifier phrases, longest first. Pairing validity is the engine's job (D1). */
export const MODIFIER_PHRASES: readonly ModifierPhrase[] = [
  { tokens: ["hold", "the", "lettuce"], modifier: "no_lettuce", enabled: true },
  { tokens: ["without", "lettuce"], modifier: "no_lettuce", enabled: true },
  { tokens: ["no", "lettuce"], modifier: "no_lettuce", enabled: true },
  { tokens: ["with", "lettuce"], modifier: "no_lettuce", enabled: false },
  { tokens: ["lettuce", "back"], modifier: "no_lettuce", enabled: false },
  { tokens: ["no", "mayo"], modifier: "no_mayo", enabled: true },
  { tokens: ["without", "mayo"], modifier: "no_mayo", enabled: true },
  { tokens: ["with", "mayo"], modifier: "no_mayo", enabled: false },
  { tokens: ["dressing", "on", "the", "side"], modifier: "dressing_on_side", enabled: true },
  { tokens: ["dressing", "on", "side"], modifier: "dressing_on_side", enabled: true },
  { tokens: ["no", "ice"], modifier: "no_ice", enabled: true },
  { tokens: ["without", "ice"], modifier: "no_ice", enabled: true },
  { tokens: ["with", "ice"], modifier: "no_ice", enabled: false },
  { tokens: ["hold", "the", "onions"], modifier: "no_onions", enabled: true },
  { tokens: ["without", "onions"], modifier: "no_onions", enabled: true },
  { tokens: ["no", "onions"], modifier: "no_onions", enabled: true },
  { tokens: ["with", "onions"], modifier: "no_onions", enabled: false },
  { tokens: ["onions", "back"], modifier: "no_onions", enabled: false },
  { tokens: ["extra", "cheese"], modifier: "extra_cheese", enabled: true },
  { tokens: ["with", "cheese"], modifier: "extra_cheese", enabled: true },
  { tokens: ["add", "cheese"], modifier: "extra_cheese", enabled: true },
  { tokens: ["double"], modifier: "double", enabled: true },
];

/** Correction verbs: "scratch the fries" retracts a pending ADD; only with nothing pending is it a cart REMOVE. */
export const RETRACT_VERBS: ReadonlySet<string> = new Set(["scratch", "forget"]);
/** Every verb that names a line to take off; the non-retracting ones are plain sequential commands. */
export const REMOVE_VERBS: ReadonlySet<string> = new Set(["remove", "drop", "cancel", "delete", ...RETRACT_VERBS]);
export const DETERMINERS: ReadonlySet<string> = new Set(["the", "a", "an", "my"]);
export const LAST_PHRASES: readonly (readonly string[])[] = [
  ["the", "last", "item"], ["the", "last", "one"], ["last", "one"], ["that", "one"], ["that"], ["it"],
];
export const UNDO_PHRASES: ReadonlySet<string> = new Set(["undo", "undo that", "undo it", "go back"]);

/** A marker says "what follows replaces what came before" (D3). Longest first. */
export const CORRECTION_MARKERS: readonly (readonly string[])[] = [
  ["no", "wait"], ["wait", "no"], ["no", "actually"], ["actually", "no"], ["i", "mean"], ["actually"], ["wait"], ["sorry"],
];
/** A correction marker at the end of a clause ("fries instead", "make that two instead"). */
export const TRAILING_CORRECTION_MARKERS: readonly (readonly string[])[] = [["instead"]];
/** A drop marker retracts the previous pending clause outright. */
export const DROP_MARKERS: readonly (readonly string[])[] = [
  ["scratch", "that"], ["scratch", "it"], ["forget", "that"], ["forget", "it"], ["never", "mind"], ["nevermind"],
];

/** Function words whose immediate repetition is a browser-ASR stutter with no alternative reading ("remove the the fries"). */
export const STUTTER_WORDS: readonly string[] = ["the", "a", "an", "and", "um", "uh", "please", "to", "of"];
/** Verbs that may open a stuttered command prefix ("make that make that two"); item nouns and numbers never do. */
export const STUTTER_COMMAND_VERBS: ReadonlySet<string> = new Set(["make", "remove", "delete", "take", "cancel", "drop", "add"]);

const FUNCTION_WORDS = ["a", "an", "the", "my", "with", "without", "on", "for", "to", "of", "like", "and", "then", "plus",
  "not", "no", "add", "make", "take", "off", "go", "back", "undo"];

const LEXICONS = new WeakMap<Catalog, Lexicon>();

/** Aliases come from the loaded catalog's Demo Counter; plurals are derived, never listed by hand. Memoised per catalog. */
export function buildLexicon(catalog: Catalog): Lexicon {
  const cached = LEXICONS.get(catalog);
  if (cached) return cached;
  const menu = indexCatalog(catalog);
  const demo = menu.itemsForLocation("demo");
  const itemAliases: readonly ItemAlias[] = demo
    .flatMap((item) => item.aliases.flatMap((alias) => {
      const forms = [alias, pluralOf(alias)].filter((form): form is string => form !== null);
      return forms.map((form) => ({ tokens: form.split(" "), itemId: item.id }));
    }))
    .sort((a, b) => b.tokens.length - a.tokens.length);
  const aliasTokens: ReadonlySet<string> = new Set(itemAliases.flatMap((alias) => alias.tokens));
  const soleItemForModifier: Readonly<Partial<Record<ModifierId, ItemId>>> = Object.fromEntries(
    ModifierIdSchema.options.flatMap((modifier) => {
      const accepting = demo.filter((item) => item.allowedModifiers.includes(modifier));
      return accepting.length === 1 ? [[modifier, accepting[0].id]] : [];
    }),
  );
  const vocabulary: ReadonlySet<string> = new Set([
    ...aliasTokens,
    ...MODIFIER_PHRASES.flatMap((phrase) => phrase.tokens),
    ...REMOVE_VERBS,
    ...LAST_PHRASES.flat(),
    ...CORRECTION_MARKERS.flat(),
    ...TRAILING_CORRECTION_MARKERS.flat(),
    ...DROP_MARKERS.flat(),
    ...FUNCTION_WORDS,
  ]);
  const lexicon: Lexicon = { menu, itemAliases, aliasTokens, soleItemForModifier, vocabulary };
  LEXICONS.set(catalog, lexicon);
  return lexicon;
}
