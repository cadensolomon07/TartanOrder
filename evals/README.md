# Evaluation harness (workstream C)

Replays the labelled cases in `evals/cases/*.jsonl` through the parser under test **and** A's pure order engine, records what actually happened (including failures and harness errors), computes metrics with their denominators, and labels every row with the parser that really answered. Nothing here enforces an accuracy target: the test asserts integrity and safety properties only, and accuracy is measured and reported.

| File | Role |
|---|---|
| `harness.ts` | `loadCases`, `resolveSplits`, `resolveTransport`, `runCase`, `runCases` |
| `report.ts` | `summarize`, `buildRunFile`, `renderMarkdown`, `runFileStem` |
| `types.ts` | The record / summary / run-file contract (additive changes only) |
| `lib/compare.ts` | Line projection and the pass / appropriateness rules |
| `lib/parser-call.ts` | In-process vs HTTP parser calls; route calls for http-kind cases |
| `lib/metrics.ts` | Group summaries, nearest-rank percentiles, grouping helpers |
| `lib/markdown.ts` | Table rendering and compact expected/actual strings |
| `cases/` | The case sets and their schema (see `cases/README.md`) |
| `runs/` | Run files written by `EVAL_WRITE=1` |
| `tests/parser/eval.test.ts` | The eval command (until A adds `npm run eval`) |

## How to run

```sh
# Default: dev + adversarial, in-process (pure rules grammar → pure engine), nothing written
npm test -- tests/parser/eval.test.ts

# Include the frozen held-out split (ONLY when explicitly listed; see the freeze rule below)
EVAL_SPLITS=dev,heldout,adversarial npm test -- tests/parser/eval.test.ts

# Persist the run: writes evals/runs/<stem>.json (RunFile) and evals/runs/<stem>.md
EVAL_WRITE=1 npm test -- tests/parser/eval.test.ts

# Also run the same splits over real HTTP against a deployment (second describe block)
EVAL_BASE_URL=https://your-deployment.example npm test -- tests/parser/eval.test.ts
```

The rendered Markdown report is always printed with `console.info` after the run and appears in a `stdout | tests/parser/eval.test.ts` block. Vitest 5 switches to its `minimal` reporter when it detects an AI-agent environment (std-env `isAgent`), and that reporter hides logs from passing tests; in that case add `--reporter=verbose` (e.g. `npm test -- tests/parser/eval.test.ts --reporter=verbose`).

**Proposed `package.json` script for A:** `"eval": "vitest run tests/parser/eval.test.ts"` (requested from A, not added here).

## What a run does, per case

1. Fresh engine: `createEngine("eval-<id>")`. Every `setupBatches[i]` is applied as a `MANUAL` UI action; a non-`applied` outcome is recorded as `harness-error` and the case stops. Then `INPUT_STARTED`, exactly as the kiosk controller does before an utterance.
2. The `ParseRequest` is built from the live view (`baseRevision = view.revision`, `requestId = "<id>:r"`, `source` mapped typed→`text`, voice→`voice`, fixture→`fixture`).
3. `expect.kind === "http"` cases (blank / oversize transcript) go to the route — the handler `POST` in-process, or `fetch` over HTTP — and record `{kind:"http", status, code}` with `parser: "n/a"` and `rawResponse: null`. Pass iff the status matches.
4. Every other case calls the parser (`parseRules` in-process; over HTTP, the kiosk's own client adapter `interpretWith` against the deployment's `/api/interpret`, so 429/503/504 and the 6 s client deadline become the same labelled rules fallback the kiosk shows, recorded as `rules` + `fallbackReason`), then `reduceEngine(state, {type:"PARSE_RECEIVED", response})`. `parser` and `fallbackReason` are copied from the response envelope, never assumed.
5. The actual outcome is read from the engine: `applied` → cart lines; `rejected` → `{kind:"reject", code}`; `clarify` → the question and choice count, and, when the case expects a clarify, the labelled `choices[choiceIndex]` is applied with `CHOOSE` and `chooseOutcome` / `linesAfter` recorded (a missing index records `chooseOutcome: "rejected"`, `linesAfter: null`); `ignored` → `harness-error` (stale/duplicate response).
6. Expected = `expectOverrides[parser]` when the parser is `rules` or `gemini` and an override exists, else `expect`. Pass rules: cart ↔ ordered lines deep-equal with modifiers compared as sorted sets; clarify ↔ actual is clarify AND `linesAfter` equals the expected `linesAfter`; reject ↔ kind and code equal; http ↔ status equal.
7. `latencyMs`: `parse` (parser call), `engine` (the `PARSE_RECEIVED` reduce), `total` (wall clock from before the parser call to after the outcome, including any `CHOOSE`). Milliseconds, floats.

Cases run sequentially and never share state.

## Outputs

- `evals/runs/<stem>.json` — a `RunFile`: sha, timestamps, transport, label, menu version, splits, every `CaseRecord` (including `rawResponse`) and the `RunSummary`.
- `evals/runs/<stem>.md` — the same report as printed.
- `<stem>` = `<startedAt with ":" → "-" and no millis>-<transport>-<splits joined by "+">-<sha>`, e.g. `2026-09-12T05-10-00Z-in-process-dev+adversarial-6fd6c33-dirty`. `sha` is `git rev-parse --short HEAD` plus `-dirty` when `git status --porcelain` is non-empty, or `unknown` when git fails.

Nothing is written unless `EVAL_WRITE=1`, so `npm test` stays deterministic.

## Metrics (each a `Ratio` with its denominator)

| Metric | Denominator | Numerator |
|---|---|---|
| `exactCart` | cases whose expected outcome is a cart | ordered lines equal |
| `appropriateResponse` | cases expected to clarify, reject, or fail at HTTP | same kind, and code/status equal (a clarify counts even if the follow-up choice failed) |
| `completionAfterClarification` | cases expected to clarify whose actual was clarify | the labelled choice produced `linesAfter` |
| `leakedProposals` | — | expected anything but a cart, but a cart was applied (count) |
| `harnessErrors` | — | records whose actual is `harness-error` (count) |
| `latency` | records a parser answered (`parser !== "n/a"`) | p50 / p95 / max of `latencyMs.total`, nearest-rank, with `n` |

Groups: `overall`, `bySplit`, `byCategory`, `byParserLabel` (row counts per `"rules"`, `"rules/PARSE_TIMEOUT"`, `"gemini"`, `"n/a"`), and `failures` (every non-pass record with transcript, expected, actual and parser).

## Labelling rules

- The `parser` column is the envelope's `parser` field. In-process runs can only ever show `rules`; Gemini rows appear only if a server actually answered with `parser: "gemini"`. Http-kind cases are `n/a` because no parser is credited for a route refusal.
- **Adversarial rows are excluded from accuracy denominators.** `overall` computes `exactCart`, `appropriateResponse` and `completionAfterClarification` over non-adversarial rows only, while `leakedProposals`, `harnessErrors`, `latency` and `n` cover every row. Adversarial accuracy-style numbers appear only under `bySplit.adversarial` and under `byCategory` keys prefixed `adversarial/` (so dev `quantity_abuse` never shares a denominator with adversarial `quantity_abuse`). Adversarial mismatches are still listed in `failures` as observations.
- The integrity test requires `bySplit.adversarial.leakedProposals === 0` and `overall.harnessErrors === 0`. It never asserts an accuracy threshold.

## Held-out freeze

`heldout.jsonl` is frozen until H8 and is never part of the default run. It runs only when `EVAL_SPLITS` names it explicitly, and it must never be used for tuning: no prompt, alias, filler or grammar change may be motivated by a held-out failure (see `cases/README.md`).
