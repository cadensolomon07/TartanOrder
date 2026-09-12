# Beyond the wrapper — technical-depth plan for TartanOrder (workstream C)

Written Sat 2026-09-12 ~02:15 EDT (H5.25); revised ~02:30 (Gemini is the primary parser) and ~02:40 (long-sentence / long-order coverage for the rules grammar, Step 3). Feature freeze Sat 11:00 (H14); submission 15:15. Local file, not committed.

## Where the project already stands

TartanOrder is not a wrapper today: a pure, property-tested order engine owns all state; a rules grammar parses offline; Gemini is a second parser whose output is forced through a strict shared schema and then re-validated by the engine; every response is labelled with the parser that answered; a harness replays 60 labelled cases through the real engine. As of `work/c-gemini` @ `36d40b7`: Gemini verified locally on `gemini-3.8-flash` (dev 15/15 exact cart, 0 adversarial leaks, p50 1.0 s, p95 3.3 s); rules 12/12 in-process. Measured honestly: Gemini **covers more inputs** (paraphrase, code-switching, fuzzy aliases); on the inputs the grammar accepts both are at 100 %.

Decision: **Gemini is the main parser in gemini mode.** The rules grammar is not a gate in front of it. It is (1) the instant offline fallback the kiosk already uses when the provider fails or times out, (2) a concurrent cross-check that runs in-process on every request, (3) the source of the pre-model guards and the grounding lexicon, and (4) the parser behind the voice preview. Its known weakness is long input: clauses split only on comma / "and" / "then" / "plus", the filler list is short, any leftover token fails closed, and distributive phrasing ("two burgers, one with no onions") is unsupported — so on long orders the cross-check falls silent and the offline fallback rejects. What still *looks* like a wrapper to a judge is that a validated model proposal is applied unconditionally and the rules cross-check is only a log line. The steps below make every model answer **cross-checked by a grammar that can keep up, grounded, deterministic under test, and measured**.

Constraints (binding): CONTRACT V1 frozen (no new fields, codes, or routes; `LIMITS` unchanged, including 8 operations per utterance and 500 transcript characters); no database, no second provider, no training; C edits only `src/parser/**`, `src/app/api/interpret/route.ts`, `tests/parser/**`, `evals/**`, `docs/evaluation.md`; A integrates and deploys; B owns the kiosk and voice.

Priority / cut line: Steps 1, 2, 3, 4, 6, 9 are the submission. Steps 5 and 8 if time remains before H14. Step 7 depends on B and is optional.

---

## Step 1. Design the model-first, grammar-checked parser

Architecture decision for gemini mode in `/api/interpret`. Gemini is the primary parser; the rules grammar runs concurrently in-process (sub-millisecond, no network) on the same request. Define the **cross-check policy** as a decision table over (rules outcome × Gemini outcome): both propose the same ops → apply Gemini's; both propose but differ → `clarify` with ≤ 3 deduplicated choices (each reading's ops, deterministic labels) so the customer decides; rules rejects or clarifies while Gemini proposes → apply Gemini's **only if grounded** (Step 4); Gemini rejects or clarifies → return it as-is; provider failure or deadline → the existing labelled rules fallback. Define **lexical grounding**: every item and modifier in a model proposal must trace to a transcript token via menu aliases, plurals, the phonetic near-miss table, or a small multilingual alias table (es/zh/hi for the three items); an ungrounded item turns the proposal into a `clarify`, never applied and never silently dropped. Fix the latency and cost budget (model on every request: p50 ≈ 1 s, p95 ≈ 3.3 s, ~1.1k prompt tokens), the log fields (`agreement`, `decision`, `grounded`, `ungroundedIds`), and confirm nothing needs a contract change (`parser` stays `rules` | `gemini`; envelope unchanged).

Acceptance: an ADR section (`docs/evaluation.md` §11 or `docs/adr-model-first.md`) with the decision table, log field names, the latency/cost budget, and an explicit "no contract change" statement; A acknowledges before Step 2 starts.

Out of scope: any change under `src/contracts/**`; new HTTP routes; UI changes.

---

## Step 2. Implement the concurrent rules cross-check and disagreement-to-clarify in the route

Implement Step 1's decision table in `src/app/api/interpret/route.ts` (C-owned). Guards run first. Gemini and the rules grammar run on the same request (rules in-process, concurrently with the provider call). Evolve the existing shadow-agreement code from log-only into the decision: identical proposals → Gemini's applied as `parser: "gemini"`; differing proposals → `clarify` with ≤ 3 deduplicated choices whose labels are built by a deterministic op describer (≤ 100 chars each, question ≤ 160); Gemini reject/clarify → returned as-is. Log `agreement`, `decision` (`applied` | `clarify-disagreement` | `model-reject` | `fallback`), and the rules code. Keep the 5 s lifecycle deadline, cancellation, error mapping, and the labelled rules fallback on provider failure.

Acceptance: route tests cover the full decision matrix with a mocked provider (same, different, model reject, model clarify, provider failure) and prove disagreement never applies either reading; full suite stays green (≥ 425 tests); measured over HTTP on dev + adversarial: exact cart ≥ 15/15, adversarial leaks 0, and the agreement rate, disagreement-clarify rate, and fallback rate are reported with denominators.

Out of scope: changes to `src/parser/client.ts` behaviour; contract changes.

---

## Step 3. Long sentences and long orders in the rules grammar

Extend the grammar under `src/parser/rules/**` so long, natural utterances parse without loosening the fail-closed rules. (a) **Segmentation**: add closed connectors ("also", "and also", "as well as", "along with", "plus", "then", "next", "oh and", semicolons) and **implicit item boundaries** — a clause splits where a completed item group is followed by a new `[qty] [double] ITEM` group, so "a burger fries and a lemonade" yields three ADDs. (b) **Discourse and closers**: extend the closed filler list with leading discourse ("so", "okay", "let's see", "I think", "maybe", "let's do", "for me", "to start") and trailing closers ("that's it", "that's all", "that'll be all", "thanks", "for here", "to go"), each measured for false positives against the existing sets. (c) **Distributive quantities and modifiers**: "two burgers, one with no onions" and "one of them a double" become separate ADDs (qty 1 with the modifier + qty 1 plain); "N of them", "item x2", "item times two" read as quantities. (d) **Order-role phrases**: "for the drink a lemonade", "with a side of fries", "fries on the side" are item clauses. (e) Keep the contract's 8-op cap: an order that exceeds it rejects with a message that names the count and asks to split. (f) **Measurement**: add a `long_order` category (≥ 8 dev and 3 held-out cases, 6–12 clauses, 150–500 characters, mixed connectors, fillers and corrections) and report its exact-cart rate separately; property tests — concatenating k valid clauses (k ≤ 8) with random connectors and fillers yields the union of their ops in order, and inserting fillers anywhere never changes the ops.

Acceptance: every new `long_order` case passes in-process; existing tests stay green (≥ 425); adversarial leaks 0; the `long_order` exact-cart rate is reported with its denominator in `docs/evaluation.md`; nothing is guessed — any unconsumed token still rejects `UNSUPPORTED`; the model-mode cross-check agreement rate on `long_order` rows is reported after Step 2.

Out of scope: references the contract cannot express ("the first burger", "the other one"); merging identical items into one line; changing `LIMITS`.

---

## Step 4. Lexical grounding of model proposals (fail-closed on hallucinated items)

Build the grounding check from Step 1 as a pure module under `src/parser/rules/` (reusing `ITEM_ALIASES`, the phonetic table, and a new small multilingual alias table) and apply it in the route to every Gemini `proposal` before the cross-check result is applied: each proposed `itemId`/modifier must be grounded in the transcript; otherwise respond `clarify` with ≤ 3 choices (the model's reading and the grounded subset, deduplicated) so the customer decides. Grounded proposals pass unchanged. Log `grounded: true|false` and the ungrounded ids. Never loosen the shared validator; never apply an ungrounded proposal.

Acceptance: unit tests for grounded / partially grounded / ungrounded proposals and for code-switched transcripts (Spanish burger + fries stays grounded via the multilingual table); a test with a mocked model that invents `lemonade` on "a burger" yields `clarify`, never a cart change; adversarial leaks remain 0 over HTTP; all labels within `LIMITS`.

Out of scope: UI changes (choices render through the existing pending-choice UI); contract changes.

---

## Step 5. Deterministic record/replay for the model path

Add a recorded-fixture layer around `parseGemini`: `GEMINI_FIXTURES=record` writes sanitized request→response pairs (keyed by a hash of transcript + system instruction + provider schema; no key, no headers) to `evals/fixtures/gemini/`; `GEMINI_FIXTURES=replay` serves them with no network; unset = live. Use replay to add metamorphic tests for the model path (filler insertion, comma↔"and", casing must not change the ops) and to make `npm run eval` against Gemini deterministic and free in CI.

Acceptance: `GEMINI_FIXTURES=replay npm test` exercises the Gemini path with zero network (asserted by a fetch spy); fixture files never contain the key or `x-goog-api-key`; replayed rows are labelled `gemini (recorded)` in run files and are never counted as live accuracy; metamorphic tests pass on recorded responses.

Out of scope: recording in production; any provider other than the Gemini generateContent endpoint.

---

## Step 6. Held-out evaluation and honest comparison: rules vs gemini-unchecked vs gemini-checked

On the release-candidate SHA, run the frozen held-out split (24 + the 3 `long_order` cases from Step 3) once, over HTTP, in three configurations: rules only, gemini-unchecked (the pre-Step-2 behaviour, for comparison), and gemini-checked (Steps 2–4). Report per configuration with denominators: exact cart (overall and for `long_order`), appropriate clarify/reject, completion after clarification, agreement rate, disagreement-clarify rate, grounding-block rate, provider calls and estimated cost, p50/p95/max latency with n, fallback count (`rules/PARSE_TIMEOUT`), and Wilson 95 % intervals for every proportion. Keep ASR errors separate from parser errors (voice n from B's raw transcripts, or state n = 0). Disclose that held-out was run once and never used for tuning.

Acceptance: `docs/evaluation.md` §8 gains the three-way table with run-file names and the exact SHA; a "not measured" list; no parser, prompt, alias or grammar change lands after the held-out run.

Out of scope: tuning anything on held-out results.

---

## Step 7. Preview-not-commit on interim voice transcripts (with B)

B's kiosk calls the pure `parseRules` on interim (non-final) speech results to render a greyed "hearing: 2 × burger, fries" preview that is never submitted to the engine (the model is not called per interim result; it parses the final transcript only). C provides a pure `previewRules(text)` helper (no engine, no network, tolerant of blank/partial text) and instruments time-to-first-preview vs time-to-committed-cart in the exported audit for the evaluation.

Acceptance: an e2e test shows the preview updating on interim results with "local only" on and zero `/api/` traffic; the audit log is byte-identical with and without previews; the evaluation reports both timings with n.

Out of scope: applying a preview to the cart; any change to the confirmation flow.

---

## Step 8. Chaos drill and security review of the model boundary

Extend `evals/cases/adversarial.jsonl` to ≥ 40 rows: multilingual prompt injection, JSON-in-text, unicode confusables and zero-width characters, nested/oversized payloads, model-output canaries (forged ids, extra keys, line refs) replayed through the route. Add a chaos command (`EVAL_SPLITS=adversarial`) that prints REJECTED, INJECTION-BLOCKED, HTTP-REFUSED and LEAKED counters. Security-review `route.ts`, `gemini.server.ts` and `client.ts`: key handling, log hygiene (no transcript, no headers, no key), fixed provider host (no SSRF surface), retry storms, and whether an in-memory per-instance rate limit is worth adding before the demo now that every request reaches the provider.

Acceptance: LEAKED = 0 across all adversarial rows in rules, gemini-unchecked and gemini-checked modes; no key or transcript in any log line or exported session; review findings recorded in `docs/evaluation.md` with each finding's disposition.

Out of scope: a database-backed rate limiter; any new route.

---

## Step 9. Demo evidence and documentation

Update `docs/evaluation.md` and the README "what this is / is not" section: a diagram of the model-first, fail-closed pipeline (guards → Gemini ∥ rules cross-check → disagreement becomes a question → grounding → strict schema → engine whole-batch validation → explicit review and confirm), the measured tables from Step 6 on the release SHA (including `long_order`), the limitations, and the honest next steps (vendor/POS integration, user testing). Every number cites its run file and SHA; fixture and replay results are labelled as such and never presented as live accuracy.

Acceptance: README explains the model-first, independently verified design in ≤ 200 words with the diagram; `docs/evaluation.md` header names the release SHA; a reader can reproduce every table with the documented commands.

Out of scope: marketing copy; claims about production traffic that has not been observed.
