import { ModifierIdSchema, type ItemId, type ModifierId } from "@/contracts";
import { itemsForLocation } from "@/contracts/menu";

/** One surface form for a menu item: alias tokens (singular or derived plural) → item. */
export type ItemAlias = { readonly tokens: readonly string[]; readonly itemId: ItemId };
export type ModifierChange = { readonly modifier: ModifierId; readonly enabled: boolean };
export type ModifierPhrase = ModifierChange & { readonly tokens: readonly string[] };

function pluralOf(alias: string): string | null {
  return alias.endsWith("s") ? null : `${alias}s`;
}

/** Aliases come from the menu module at import time; plurals are derived, never listed by hand. */
export const ITEM_ALIASES: readonly ItemAlias[] = itemsForLocation("demo")
  .flatMap((item) => item.aliases.flatMap((alias) => {
    const forms = [alias, pluralOf(alias)].filter((form): form is string => form !== null);
    return forms.map((form) => ({ tokens: form.split(" "), itemId: item.id }));
  }))
  .sort((a, b) => b.tokens.length - a.tokens.length);

export const ALIAS_TOKENS: ReadonlySet<string> = new Set(ITEM_ALIASES.flatMap((alias) => alias.tokens));

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

/** When exactly one menu item accepts a modifier, a standalone modifier phrase targets that item (D2). */
export const SOLE_ITEM_FOR_MODIFIER: Readonly<Partial<Record<ModifierId, ItemId>>> = Object.fromEntries(
  ModifierIdSchema.options.flatMap((modifier) => {
    const accepting = itemsForLocation("demo").filter((item) => item.allowedModifiers.includes(modifier));
    return accepting.length === 1 ? [[modifier, accepting[0].id]] : [];
  }),
);

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

/** Every token the grammar can consume; anything else is unknown and fails closed. */
export const VOCABULARY: ReadonlySet<string> = new Set([
  ...ALIAS_TOKENS,
  ...MODIFIER_PHRASES.flatMap((phrase) => phrase.tokens),
  ...REMOVE_VERBS,
  ...LAST_PHRASES.flat(),
  ...CORRECTION_MARKERS.flat(),
  ...TRAILING_CORRECTION_MARKERS.flat(),
  ...DROP_MARKERS.flat(),
  ...FUNCTION_WORDS,
]);
