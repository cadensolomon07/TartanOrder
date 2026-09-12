# Evaluation case sets

Human-labeled cases for the TartanOrder parser evaluation (workstream C). Three files, one JSON object per line (JSONL, UTF-8, no trailing commas, blank lines ignored):

| File | Split | Rows | Purpose |
|---|---|---|---|
| `dev.jsonl` | `dev` | 36 | Development set. Used to tune the rules parser and the Gemini prompt. |
| `heldout.jsonl` | `heldout` | 24 | Held-out set. **Frozen. Never used for tuning.** Reported at H8 and H12. |
| `adversarial.jsonl` | `adversarial` | 24 | Injection, nonsense, ASR artifacts, route boundaries, tricky quantities. **Never counted in accuracy denominators.** |

`schema.ts` defines a case; `tests/parser/cases.test.ts` validates all three files (counts, ids, distributions, limits, http labels, held-out distinctness). The eval harness (`evals/run.ts`, later) imports `EvalCaseSchema` and `parseCaseFile` from `schema.ts`.

## Schema

```ts
import { z } from "zod";
import { CoreCodeSchema, ItemIdSchema, ModifiersSchema, OpsSchema, QuantitySchema } from "@/contracts";

export const CASE_CATEGORIES = [
  "simple", "corrections", "ambiguous", "off_menu", "invalid_modifier", "quantity_abuse",
  "deferral", "code_switching", "injection", "nonsense", "asr_artifact", "boundary",
] as const;

export const CaseLineSchema = z.strictObject({ itemId: ItemIdSchema, qty: QuantitySchema, modifiers: ModifiersSchema });

export const CaseExpectSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("cart"), lines: z.array(CaseLineSchema) }),                      // exact ordered cart AFTER the utterance is applied
  z.strictObject({ kind: z.literal("clarify"), choiceIndex: z.number().int().nonnegative(), linesAfter: z.array(CaseLineSchema) }), // engine or parser asks; choosing choices[choiceIndex] yields linesAfter
  z.strictObject({ kind: z.literal("reject"), code: CoreCodeSchema }),                               // cart unchanged; code from the parser OR the engine
  z.strictObject({ kind: z.literal("http"), status: z.union([z.literal(400), z.literal(409), z.literal(413)]) }), // route-level rejection; transcript may be blank/oversized
]);

export const EvalCaseSchema = z.strictObject({
  id: z.string().regex(/^(dev|ho|adv)-\d{3}$/),
  split: z.enum(["dev", "heldout", "adversarial"]),
  category: z.enum(CASE_CATEGORIES),
  source: z.enum(["typed", "fixture", "voice"]),
  setupBatches: z.array(OpsSchema),          // applied via MANUAL UI actions before the transcript; NO UNDO ops here
  transcript: z.string(),                    // may be blank or >500 chars ONLY when expect.kind === "http"
  intended: z.string().nullable(),           // voice rows only: what the speaker meant
  asrConfidence: z.number().min(0).max(1).nullable(),
  expect: CaseExpectSchema,
  expectOverrides: z.strictObject({ rules: CaseExpectSchema.optional(), gemini: CaseExpectSchema.optional() }),
  note: z.string().nullable(),
});
export type EvalCase = z.infer<typeof EvalCaseSchema>;
export type CaseExpect = z.infer<typeof CaseExpectSchema>;
export function parseCaseFile(text: string): EvalCase[]; // split lines, skip blank, JSON.parse, EvalCaseSchema.parse; throws with the line number
```

Item ids, modifiers, quantities (1..5), operation batches (1..8 ops, UNDO alone) and core codes come from A's shared contract, so a case can never name an item, modifier or code the engine does not know.

## How a case runs

1. Fresh engine session (A's pure `createEngine`).
2. Each batch in `setupBatches` is applied as a `MANUAL` UI action, in order. Setup is explicit ops (decision D8) so it never depends on the parser under test. Every ADD makes its own line; the last referent after setup is the most recently affected line (for the u1 cart `[ADD burger, ADD fries, ADD lemonade]` that is the lemonade line).
3. `INPUT_STARTED`, then the transcript goes through the parser under test (`parseRules` in-process, or the deployed `/api/interpret` for rules/Gemini over HTTP), then `PARSE_RECEIVED` with the response.
4. The outcome is compared with `expect` (or the mode-specific override, see below).

`expect` is the **intended outcome after parser + engine**, not what any current parser does. Labels follow CONTRACT V1 and the plan decisions D1–D4, D9, D11, D13, D14.

| `expect.kind` | Meaning | Comparison |
|---|---|---|
| `cart` | Utterance applied. | Ordered `(itemId, qty, modifiers)` per line; line ids ignored; modifier order ignored (sorted). |
| `clarify` | Someone asked a question: the engine (ambiguous item reference, e.g. two burger lines) or the parser (phonetic near-miss, D11). The cart is unchanged until the user chooses. | The harness applies `CHOOSE` with `choices[choiceIndex]` (0-based index into the pending choices of whichever component asked) and compares the resulting cart with `linesAfter`. Engine choices are ordered by line position and labeled `"Burger 1, quantity 1"`, `"Burger 2, quantity 1"`, so `choiceIndex: 1` is the second matching line. |
| `reject` | Refused; cart unchanged. `code` is the contract core code, whether the parser (`UNSUPPORTED`, `OFF_MENU`, `QUANTITY_LIMIT`) or the engine (`INVALID_MODIFIER`, `CART_LIMIT`, `NO_UNDO`, `UNKNOWN_REFERENCE`) produced it. | Outcome is `rejected` with that code; cart lines equal the post-setup lines. |
| `http` | The route refuses the request before any parsing. | HTTP status only: blank or >500-character transcript -> 400 `INVALID_REQUEST`; body >4096 bytes -> 413 `INPUT_TOO_LARGE`. `menuVersion` mismatch (409) cannot be expressed as a transcript and is covered by route tests instead. |

### `expectOverrides`

Most cases have one expectation for every parser mode (`expectOverrides: {}`). When the intended outcome legitimately differs by mode, `expectOverrides.rules` or `expectOverrides.gemini` replaces `expect` for that mode only:

- Code-switching rows: `expect` is `reject UNSUPPORTED` (the rules parser is English-only by design) and `expectOverrides.gemini` is the cart.
- `ho-021` (order + deferral in one utterance): `expect` is the cart, `expectOverrides.rules` is `reject UNSUPPORTED`, because rules fails closed on the unconsumed deferral clause by design.

Phonetic near-miss rows carry no override: both modes must clarify, never auto-substitute.

## Categories

| Category | Definition | Typical `expect` |
|---|---|---|
| `simple` | Adding menu items, including comma/"and" lists, aliases, quantities and burger modifiers; no correction language. | `cart` |
| `corrections` | Edits to an existing cart (remove, set quantity, toggle modifier, undo) and in-utterance self-corrections (D3: "no wait", "actually make that", "scratch the"). | `cart`, or `reject` for illegal combinations (`UNDO` with other ops) |
| `ambiguous` | An item reference that matches more than one cart line (engine clarify), or a phonetic near-miss of a menu alias (parser clarify, D11). | `clarify` |
| `off_menu` | A request for something the seeded menu does not sell, or for an unnamed item ("the usual"). | `reject OFF_MENU`; `reject UNSUPPORTED` when no item noun is present |
| `invalid_modifier` | A modifier applied to fries or lemonade, by ADD or by MOD. The parser proposes; the engine rejects the whole batch (D1). | `reject INVALID_MODIFIER` |
| `quantity_abuse` | Quantities outside 1..5 in digits or words, vague quantities, and legal quantities that overflow the cart (5 lines / 10 units). Never clamped. | `reject QUANTITY_LIMIT`, `CART_LIMIT`, or `UNSUPPORTED` for unknown numeric forms |
| `deferral` | The speaker postpones a choice or steps outside ordering (defers the drink, asks for the cart to be read back). v1 has no `note` result kind, so the parser must refuse cleanly; B intercepts read-back phrases client-side. | `reject UNSUPPORTED` |
| `code_switching` | Non-English or mixed-language orders. | `reject UNSUPPORTED` with a Gemini override cart |
| `injection` | Attempts to change prices, limits, roles or instructions, including JSON pasted into the transcript. | `reject UNSUPPORTED`, or `QUANTITY_LIMIT` when a number above 5 appears (the quantity guard runs before the injection guard) |
| `nonsense` | No recognizable order: keyboard mash, emoji, repeated function words, repeated item nouns with an ambiguous count. | `reject UNSUPPORTED` |
| `asr_artifact` | Typed simulations of recognizer artifacts (fillers, stutters, homophones). `intended` holds what the speaker meant so ASR error can be reported separately from parser error. | varies |
| `boundary` | Route limits: exactly 500 characters (accepted), 501 characters, whitespace only, >4096 bytes. | `cart` or `http` |

## Labeling conventions

- `source` is `typed` for every current row; `intended` and `asrConfidence` are `null` except on `asr_artifact` rows (`intended` filled) and on future `voice` rows from B's raw microphone transcripts (both may be filled). Voice transcripts are evaluated **unrepaired**.
- Every ADD creates a separate line; identical items are never merged. "two burgers" is one line with `qty: 2`; "a lemonade" on a cart that already has lemonade adds a second lemonade line.
- "double" is the burger modifier, never quantity two. "cheeseburger" is an alias for burger with no implied `extra_cheese` (D4).
- A standalone modifier phrase ("no onions") targets `{by: "item", itemId: "burger"}` because only burger accepts modifiers (D2); with two burger lines that becomes an engine clarify. "make that ..." always targets `{by: "last"}`.
- In-utterance corrections rewrite the pending batch (D3): "a burger, no wait, fries" adds only fries; "two lemonades, actually make that three" adds one line with `qty: 3`.
- Whole-batch validation: one bad item, modifier or quantity rejects the entire utterance; the valid parts are not applied.
- Quantities are never clamped. Anything above 5 or below 1 is `QUANTITY_LIMIT`; unknown numeric forms ("1e3", "a few") are `UNSUPPORTED`.
- Phonetic near-misses ("lemonaid", "lemon aid", "burgher") produce a `clarify` whose single choice carries the **whole** batch; they are never auto-applied (D11).
- Injection is a `reject`, never an HTTP error, so the kiosk speaks a neutral refusal (D9). The eval report tags these rows INJECTION.
- Boundary transcripts are built deterministically: `"uh um " x 82 + "a burger"` (500 chars), `"uh um " x 82 + "a burger."` (501 chars), `"uh um " x 683 + "a burger"` (4106 chars), and `"   "`.
- `note` explains the label whenever it is not obvious from the transcript; otherwise `null`.

## Held-out freeze rule

`heldout.jsonl` is committed alone and its SHA recorded before any parser code is run against it. It is never used for tuning: no prompt, alias table, filler list or grammar change may be motivated by a held-out failure. The first held-out run is at H8; the final run at H12 is on the release SHA. If a held-out row is ever used to tune, relabel it as `dev` (move it to `dev.jsonl`, change `split` and `id`) and disclose that in `docs/evaluation.md`. Paraphrases in the held-out set deliberately differ from dev wordings, items, quantities, orderings and setup carts; the test enforces transcript-level distinctness.

## Adversarial rows and denominators

Adversarial rows are reported separately: REJECTED count, INJECTION BLOCKED count, HTTP-refused count, and **leaked proposals (any utterance that changed the cart when the label says it must not) — this must be 0**. They are never folded into exact-cart accuracy, clarification/rejection appropriateness, or completion-after-clarification, whose denominators are the dev and held-out splits only. For `asr_artifact` and `boundary` rows with a `cart`/`clarify` label, a mismatch is still reported but as an adversarial observation, not as accuracy.

## Changing the files

- Edit a line, keep it valid JSON, then run `npm test -- tests/parser/cases.test.ts`.
- Dev and held-out distributions are fixed by the test (dev: simple 6, corrections 6, ambiguous 5, off_menu 4, invalid_modifier 4, quantity_abuse 5, deferral 3, code_switching 3; held-out: 3 each). Adversarial: injection 8, nonsense 4, asr_artifact 4, boundary 4, plus 4 tricky quantity/off-menu rows.
- Adding a new category or `expect.kind` is a schema change; the harness and this README must change with it.
