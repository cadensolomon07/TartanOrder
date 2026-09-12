# Integration — V1 shared starter

Repository: https://github.com/cadensolomon07/TartanOrder. The original ClearSky00 URL redirects here after a repository transfer. One Next.js App Router app in the repository root. Node 22.23.2, npm, React, TypeScript, ordinary CSS, Zod, Vitest, fast-check, Playwright; Vercel is the only deployment target.

## Ownership and branches

- A: root package/config/lockfiles, app page/layout/global CSS, health route, contracts, core, controller, core/contract tests, integration/runbook, deployment. Work branch `work/a-engine`.
- B: `src/ui/**`, `src/voice/**`, `tests/ui/**`, `tests/e2e/**`, `public/demo/**`, `docs/demo.md`. Work branch `work/b-kiosk`.
- C: `src/parser/**`, interpret API route, parser tests, `evals/**`, `docs/evaluation.md`. Work branch `work/c-parser`.

Pull the bootstrap on main before working. Preserve teammate changes. A integrates small handoffs sequentially and runs checks. Do not generate another app or edit the shared schema independently. Publish proposed correctness fixes to A first; no contract expansion after H8.

## Bootstrap stub handoff

**B/C files were handed over with bootstrap `1676b3d` around Friday 10 p.m., within 10 minutes of this session's start.** A stopped editing these files at handoff. That SHA is on main and the initial three work branches.

- B receives `src/ui/Kiosk.tsx` and `tests/e2e/starter.spec.ts`. This temporary kiosk supports typed ordering, manual ADD/remove, undo/clear, choices, review/confirm, new order, audit export, and local-mode control. It has no voice implementation.
- C receives `src/parser/client.ts`, `src/parser/rules.ts`, and `src/app/api/interpret/route.ts`. The starter client always uses the small local rules grammar, even with Local only unchecked. The route uses the same rules. This is real rule parsing, not fixture substitution. Gemini is not verified or enabled. Extend the grammar and implement the promised HTTP/fallback deadlines in C's files.

## Authoritative exports

`src/contracts/index.ts` exports all V1 types and their strict `PascalCaseSchema` values. Key schemas: `OpSchema`, `OpsSchema`, `ParseRequestSchema`, `ParseResponseSchema`, `ApiErrorSchema`, `UiActionSchema`, `OrderViewSchema`, `AuditEntrySchema`, `ExportLogSchema`, `ModelParseResultSchema`. Model schema excludes internal line references. `API_VERSION=1`, `MENU_VERSION='demo-v1'`, and `LIMITS` are shared. Use `z.toJSONSchema(ModelParseResultSchema)` for C's structured JSON schema; runtime refinements still require validation.

`src/contracts/menu.ts`: `MENU[itemId]` has `id`, `label`, `priceCents`, `aliases`, `allowedModifiers`; `MODIFIERS[modifierId]` has `id`, `label`, `priceCents`. `DEMO_DISCLOSURE` is the required public disclosure. No consumer keeps its own menu/prices.

`src/contracts/fixtures.ts`: fixture examples explicitly use `source='fixture'` and `parser='fixture'`. Fixture success must never be labeled real parser success.

```ts
// A: src/controller/useOrderController.ts
export function useOrderController(): OrderController;
// B: src/ui/Kiosk.tsx
export function Kiosk({controller}: {controller: OrderController});
// C: src/parser/client.ts
export function interpret(req: ParseRequest, options: InterpretOptions): Promise<ParseResponse>;
// C: src/parser/rules.ts
export function parseRules(req: ParseRequest): ParseResponse;
```

The page only composes the controller and Kiosk. B must call `startInput()` at microphone start and when a reviewed text field is first edited, before recognition/parsing. `endInput()` releases abandoned capture. `busy` covers draft/capture and parsing. Never confirm from a parser result or speech callback. Review speech reads the immutable review snapshot.

Core exports from `src/core/engine.ts`: `createEngine(sessionId)`, `reduceEngine(state,event)`, `getView(state)`, `exportLog(state)`, `replayLog(json)`, `totalCents(lines)`. Replay returns a detached view and never calls recognition/API or a live controller. Core has no time/random/network calls. The controller supplies IDs and owns cancellation; transport responses failing active-request identity are discarded before the engine. Engine guards revisions, duplicates and menu version. Mode switches invalidate review/request state.

All IDs are at most 100 characters. Generated ADD IDs must also satisfy this limit: requests whose derived line IDs overflow are rejected atomically. Real controller IDs are short. Manual replay IDs derive from session and recorded audit sequence. Browser validation is prototype correctness, not a production security boundary.

The first A correctness follow-up constrains reject codes to `CORE_CODES`, fallback/API codes to `HTTP_CODES`, and audit codes to their union. This enforces V1's existing rule that new codes require an A contract change. No operations or fields were added. Update from main before the first consumer handoff.

Capture stays active across manual edits and mode changes until B calls `endInput()` or `submit()`. A menu click cancels parsing but cannot silently finish a draft/microphone capture. Review/confirm stay blocked during capture. Transport responses rejected before admission never mutate the cart and do not enter the replay audit, since V1 has no transport lifecycle event. Malformed manual payloads invalidate review through a canonical `INPUT_STARTED` audit event; malformed data cannot enter the strict V1 audit.

## Handoff checklist

Each handoff records SHA, owned files/exports, checks actually run, runnable example, deployment URL if available, actual parser/input mode, known failures and next dependency. Check remote branches before integrating, and never force-push shared branches.

### First B/C handoffs: ready-to-integrate information

Access verified September 11 around 10:23 p.m. EDT after the repository transfer: GitHub reports **write/push access** for `ClearSky00` and `levi10101010`; `cadensolomon07` remains admin. No permission changes were needed. At that check there were no open PRs; both teammate branches still pointed to bootstrap `1676b3d`.

Each teammate should bring the latest main into their own branch, preserve existing changes, and send:

1. A **ready-to-integrate PR link** against main, or the branch name plus exact commit SHA and an explicit “ready” note. Leave unfinished PRs as drafts.
2. Changed owned files/exports and a sentence describing the working change.
3. The exact commands/tests actually run and their results, plus one reproducible demo with expected behavior.
4. Actual input/parser mode, known failures and remaining work. If a package, shared schema, configuration or global CSS change is needed, give A the exact request rather than editing A-owned files.

**B additionally supplies:** tested browser/OS; whether the microphone was tested for real; results for permission denial, cancellation, empty capture, reset and unsupported-browser typed fallback; how stale recognition callbacks are discarded; and which complete review snapshot speech reads. Preserve `Kiosk({controller})`, typed ordering, ambiguity, undo and explicit confirmation. Start capture with `startInput()` before recognition. Call `endInput()` for abandoned capture. Interim or obsolete speech must never submit. Review/confirm stay blocked while busy; voice callbacks never confirm. An action that cancels an already-running parse must call `startInput()` then `endInput()`; `endInput()` alone only releases capture. B must invalidate its own recognition generation on reset or cancellation so an old callback cannot start a fresh parse.

**C additionally supplies:** supported example phrases; exported `interpret(req, options)` and `parseRules(req)` behavior; local-only/offline and HTTP/error/fallback results; proposed eval command; and whether a real Gemini request was verified, including model name and a sanitized result. No key is needed in the handoff. Explain how A's health route can determine the effective configured parser mode honestly. Keep real rules available and default to rules until credentials/model are verified. Test 5-second server / 6-second client deadlines, exact identifier echoes, strict validation, 4096-byte bounds, cancellation throwing `AbortError` without fallback, no automatic retry, and same-request fallback only for eligible transient failures. Malformed input, version mismatch and invalid model/schema output must not become successful fallback.

### A's first integration procedure

Fetch and inspect the exact ready SHA against current main. Check the owned-path diff and shared exports, and review input cancellation, atomicity and confirmation behavior before merging. A does not rewrite B/C modules; report author-owned defects for correction. Shared changes require A's review and implementation. Use an isolated worktree if needed to preserve local work.

Integrate one handoff at a time. Run typecheck, lint, all unit/contract/property tests, relevant teammate tests, production build and applicable e2e. C's eval command is added by A when available. Preserve the existing 1,000-sequence seed `20260912` evidence; never weaken its assertions to accommodate a handoff.

After checks pass, merge/push main without force, deploy to the existing Vercel project, and verify public health plus a fresh logged-out browser's typed total/edit/undo/ambiguity/input-invalidates-review/explicit simulated receipt journey. Record the reviewed/merged SHA, actual modes, checks and URL. Do not enable Gemini solely because an environment variable exists.

A's task checks for first handoffs every 10 minutes, stopping after both first working handoffs are integrated and deployed or at Saturday 11 a.m. EDT feature freeze. Unmarked branch changes require a readiness decision; unchanged branches do not trigger repetitive updates. Keep the desktop app running and the computer awake for local follow-up checks.

Scheduled sequential merges: H1.5, H3, H5.5, H8, H11, H14. H3 must show a real rules text-to-receipt journey; if it fails, stop feature expansion. Cut import/replay UI and visual extras first, while keeping engine/export/replay tests, atomicity and explicit confirmation.

## Published A checkpoint

Implementation SHA: `3ca392b219b90d24574bca21aa3f77cba51eb8b5`, merged to main and pushed to work/a-engine. Shared exports above remain authoritative. Live production: https://tartan-order.vercel.app, deployed on Vercel with Node 22.x. Local/CI pin the exact 22.23.2 patch; Vercel manages runtime patch updates.

Checks passed: fresh npm ci, typecheck, lint, 89 unit/contract tests including 1,000 generated sequences (seed 20260912), build, local/deployed Playwright receipt journey, real HTTP health/400/409/413 smoke, physical Wi-Fi-off typed modifier/review/receipt with Wi-Fi restored. See runbook for detail.

Runnable example: `npm ci`, copy `.env.example` to `.env.local` if absent, `npm run dev`, open localhost:3000, type `a burger, fries and lemonade`, review, confirm. Expected total: $13.50, simulated receipt only. Actual mode: text/local rules; no verified Gemini or voice. No current failing automated checks. Next dependency: B/C handoffs in their owned files, followed by sequential integration and C's eval command.

## A deliverable audit before teammate integration

Reviewed September 11 around 10:44 p.m. EDT. A's independent implementation is complete: shared starter/contracts/menu/fixtures, atomic engine and references, pending choices, bounded totals, undo/audit, request guards and input lifecycle, immutable review/idempotent simulated receipt, export and deterministic replay, CI configuration, and initial local/Vercel deployment. No replay/export implementation defect was found; no production or teammate files were changed in this follow-up.

Filled evidence gaps with two React StrictMode hook tests using the shared fixtures, one allowed-but-forged audit-code rejection assertion, and one actual browser-download round trip. The hook checks combine pending-request cancellation with byte-identical export after a late response, detached replay, and unmount/remount isolation. Fixture calls stay labelled fixture. The browser check used the real deployed rules parser, downloaded the actual audit file, and replayed those exact bytes to the displayed $13.50 receipt without changing the page. All three new targeted tests passed; typecheck/lint and documentation checks passed. Existing passing suites were not manually rerun just for this audit.

**Still A-owned:** review/integrate each ready B/C commit, make required A-owned configuration changes, add C's eval script, align the health route with C's effective parser-mode implementation, deploy the combined app, then perform integration and release checks. These are handoff-dependent tasks, not missing standalone engine work.

**Requires B:** finished kiosk/voice and review speech, browser-specific capture behavior, and its UI/e2e handoff. The optional on-page import/replay viewer belongs to B; the existing engine is ready for it. **Requires C:** expanded real rules, HTTP client/server deadlines and fallback, provider-output validation, eval runner/command, and genuine Gemini verification if used. A will not duplicate those modules. Current rules-only typed ordering remains available.

The [runbook](runbook.md#recover-during-the-demo) now explains lost internet, stuck capture versus parsing, re-review, undo versus reset, exporting before reload, local-server recovery and A-only deployment rollback. Export/replay inspects history; it does not restore or confirm a live order.

## First C intake — changes required

Reviewed [PR #1](https://github.com/cadensolomon07/TartanOrder/pull/1), exact ready SHA `767e37c93f894171e38bc229eea727e8ec5e7148`, against main `318945d0d4dca02c7b083f620c8316a766c505c3` on September 11 around 11:10 p.m. EDT. **Held before merge/deployment.** The candidate combines without conflicts and touches only C-owned paths. Its code was reviewed in an isolated worktree; no C files or the passing production core were edited.

Executed on the combined candidate with Node 22.23.2: fresh `npm ci` (zero reported vulnerabilities), typecheck, lint, **328 tests passed / 2 skipped**, production build, and the existing Playwright typed-to-receipt check all passed. The skipped checks require live Gemini credentials; none were supplied or used. The existing 1,000-sequence engine test remains passing. These automated successes do not cover the following reproduced defects.

| Priority / C-owned location at the reviewed SHA | Reproduction and required correction |
| --- | --- |
| P1 — `src/parser/rules/normalize.ts:22` | `-2 lemonades` becomes an accepted ADD of **two** lemonades because normalization removes the minus sign. Preserve numeric signs through validation and reject negative quantities; never silently turn them positive. |
| P1 — `src/parser/rules/batch.ts:37`, `:57`, `:63`, `:75` | `a burger and a burger and make the burger a double` silently doubles the second burger instead of asking which. `a burger and fries and make the burger a double and make it two` changes fries to quantity two, although the burger is the most recently affected line. Explicit REMOVE/SET_QTY/MOD commands must retain sequential references for the engine. Distinguish genuine correction syntax/inline modifiers from ordinary sequential edits; do not resolve cart references inside the parser. Review the existing rewriting expectations in `tests/parser/rules.test.ts:302`. |
| P1 — `src/parser/rules/numbers.ts:75` | `one two burgers` becomes an accepted ADD of **three** burgers. Reject or clarify malformed adjacent number words instead of adding their values. |
| P1 — `src/parser/client.ts:125` | A mocked HTTP 503 with a strict `ApiError` carrying `INVALID_REQUEST` or `MENU_VERSION_MISMATCH` and `retryable:false` becomes a successful rules proposal. A foreign error `requestId` is also accepted as a fallback for the current request. Validate a present error envelope's identity and status/code agreement before fallback. Malformed input, menu mismatch, invalid model output and mismatched structured errors must fail closed; preserve intended availability fallback and transient proxy/non-JSON handling. |
| P2 — `src/parser/client.ts:89` | A mocked 503 response schedules cancellation as its body settles; the client returns a rules proposal with the caller's signal already aborted. Recheck cancellation after awaiting the exchange and before every fallback/settlement. A's controller still discards the result, but `interpret()` must itself throw `AbortError` and never run fallback after user cancellation. |
| P2 — `src/app/api/interpret/route.ts:38`, `:98`, `:120` | A valid request body held open remained pending after 5.1 seconds, then returned 200 when closed around 5.3 seconds. The deadline currently covers only the provider call. Bound the complete admission/parse lifecycle, including stalled body reads; cancel its reader on timeout/disconnect. A failing body stream also currently rejects `POST` uncaught rather than returning the defined error envelope. |
| P2 — `src/parser/gemini.server.ts:46`, `:225`; `src/app/api/interpret/route.ts:168` | HTTP 400/401/403/404 provider failures map to `PROVIDER_UNAVAILABLE` with `retryable:true`; permanent bad credentials/model/configuration are not transient. The route also marks an absent configured key retryable. Preserve the existing error vocabulary and allowed availability fallback, but mark permanent failures non-retryable and correct the tests that expect otherwise. |

All reproductions used local code, synthetic requests or injected transport. No live provider request, held-out evaluation, purchase or production mutation occurred. The engine correctly validates the altered operations it receives; these defects belong to C's parsing/transport paths.

**Next dependency:** C supplies a corrected ready SHA with regression tests for these cases. A then reviews the changes, runs the integration gates, wires the A-owned health route to C's mode helper and deploys the combined app. C's eval command still waits for its harness file. B's branch remains at bootstrap `1676b3d`; no B handoff is ready. The requested `note` result, injection-specific code and availability menu field are unnecessary for this slice and are not approved contract changes; retain V1 and `UNSUPPORTED`.

The deployed app remains the previously verified typed/rules starter at https://tartan-order.vercel.app. Treat this exact C SHA as already reviewed and blocked: do not repeatedly test or notify on it. Recheck when a corrected ready SHA or an explicit resolution arrives. No PR comment or message was sent on the user's behalf; this shared report is the author handoff.

## Corrected C intake — accepted

Ready SHA `62739552ca8c203d5150d56dd280ae4d9c53a280` in PR #1 supersedes the blocked `767e37c`. Reviewed against main `c455b5c` on September 11 around 11:43 p.m. EDT. All seven documented findings are resolved: signed/adjacent quantities reject, sequential references reach the engine, error identity/code mismatch fails closed, cancellation prevents fallback, body admission shares the five-second deadline and stream failures return envelopes, and permanent provider failures are non-retryable. Original reproductions and focused regressions passed. No additional contract or feature changes were requested.

The combined candidate passed fresh `npm ci` (zero reported vulnerabilities), typecheck, lint, **359 tests / 2 skipped live-Gemini checks**, production build, and the existing Playwright receipt test. A fresh local production browser additionally passed real same-origin HTTP ordering/edit/undo/ambiguity, input invalidating review, explicit receipt, the corrected negative/adjacent-number and sequential-reference cases, and an offline local-rules receipt with zero additional HTTP calls. No browser errors occurred. The original 1,000 generated engine sequences retain seed `20260912`.

A connected `/api/health` to `resolveParserMode().effective`, updated the controller's connection notice, and added [the one-page engineering explanation](engineering.md). The engine and V1 contracts are unchanged. Actual mode is typed/rules; no real Gemini call was made and no provider mode was enabled. B's V1 browser-voice PR #2 is queued separately; V1.1 direct audio remains deferred. C's separate evaluation harness is the next C handoff, after which A will add its package command. Production verification follows this accepted local checkpoint.

### Corrected C production verification

PR #1 was merged as `719be1a962ced4b12785af88804d57b5a1b3ac5d`; A's health/documentation integration is `2885a51`. That revision was deployed to the existing Vercel project: deployment `dpl_5ThjQU4VCF8uidGiF1VvCSAHYDaV`, READY, public https://tartan-order.vercel.app. Public health reports V1/demo-v1/rules. A fresh logged-out Chromium context passed eight real HTTP utterances covering totals, edits, undo, ambiguity, corrected number/reference cases and explicit review/receipt. Offline local-only typed confirmation passed with no additional HTTP calls. Zero page errors. No Gemini or voice success is claimed.

### C evaluation intake

Reviewed PR #3, ready SHA `15c18bca9499dd161efe843b0a4958ea9276515c`, after PR #1. Only C-owned evaluation/tests/docs change. Each case uses a fresh pure engine, exact expected cart comparison and actual parser labels; the stored runs preserve failures and separate adversarial cases. Held-out cases were not run. A added `"eval": "vitest run tests/parser/eval.test.ts"` to package.json; no dependency or contract change was needed.

The combined candidate passed fresh npm ci, typecheck, lint, production build, the existing Playwright receipt check, and **365 default tests / 8 skips** (two live Gemini, six optional HTTP evaluation assertions). `EVAL_BASE_URL=https://tartan-order.vercel.app npm run eval -- --reporter=verbose` then passed **12/12** in-process/deployed-HTTP evaluation integrity checks. Both transports measured the same 36 development and 24 adversarial cases: 12/12 exact development carts, 24/24 appropriate development responses and 5/5 completed development clarifications. Six adversarial expectations differed; zero unexpected accepted carts and zero harness errors. This counter describes engine outcomes, not an absence of raw parser proposals. No labels were changed and no held-out/Gemini/voice accuracy was measured.

The deployed sample's 57 parser-response rows measured p50 39.95 ms, p95 67.42 ms, max 333.63 ms from this Mac to the public API and then through the local pure engine. This is one typed rules run, not speech latency or a general performance guarantee. The checked-in C reports are separately identified local-server runs; these new deployed figures are A's run, not substitutions into C's files.

Next integration: B's ready V1 PR #2; direct-audio V1.1 remains deferred. Gemini requires real key/model verification before changing mode. C retains ownership of later held-out evaluation and voice-transcript analysis. The seven findings against `767e37c` are resolved by `6273955`; do not treat that historical hold as current.

PR #3 was merged as `954d682ed0be59d01a0e45a830094ad8143e3369`; A's evaluation command/evidence commit is `c0bf5dd569f4aa1f3df42393d1c45f50e365abdf`. Deployed to the existing project as `dpl_2966NZL1RGqLq3tmxJE1PFGBBHQH` (READY), serving https://tartan-order.vercel.app. Its public health returns V1/demo-v1/rules and a fresh logged-out Playwright receipt check passed. Application source is identical to the fully exercised parser deployment above; the follow-up adds evaluation tooling and documentation. No C integration blocker remains. B PR #2 is available for the next sequential review, not awaiting publication.

## First B intake — one draft-lifecycle correction required

Reviewed PR #2, ready SHA `afa4011758abee164a5d578c2777760cfb454dff`, against combined A/C main `e4c5cd0` in an isolated production worktree. It merges cleanly and changes only B-owned paths. Required checks ran once: fresh npm ci (zero reported vulnerabilities), typecheck, lint, build, **393 default tests passed / 8 optional checks skipped**, and **15/15 Playwright tests passed with no e2e skips**. Specifically, the HTTP 503 fallback test ran with C's HTTP client enabled, observed the intercepted request, applied local rules and displayed the fallback notice. Its network response is mocked; its passing result is not provider-availability evidence.

**Held before merge/deployment:** `src/ui/Kiosk.tsx:104` calls `startInput()` only when the phase is already reviewing. During editing, an unfinished typed draft leaves the real controller idle. Reproduced through the combined production browser: add fries ($3.00), type `lemonade` without submitting, click Review, then Confirm. Both buttons remain enabled and a fries receipt is created despite the active draft. This violates the agreed draft/capture busy boundary. The same conditional fails to cancel an older request when a replacement draft begins.

B needs to start the typed-input lifecycle on the first edit in any editable phase, preserving submit/discard/erase release behavior. Add B-owned regressions with the real controller for an unsent editing draft blocking review/confirmation and for a replacement draft cancelling an older HTTP request whose late response must not apply. Do not change core or V1 contracts. A requested this exact correction on PR #2 under the user's authorization to report B-owned defects to B; no implementation files were edited.

No other concrete blocker was found in the focused reset/manual/cancel/recognition-instance/review-snapshot integration check. Human microphone testing remains pending; all automated speech events are mocked. The live site remains the verified A/C typed-rules app. B must supply a corrected ready SHA before voice/UI deployment; do not repeatedly test or notify on unchanged `afa4011`. Direct Gemini audio remains excluded.

## C measured repeated-word fix — accepted

Reviewed PR #4, ready SHA `beecb6cac002fde27836d2a0bf7f65d1ccba7c0f`, against main `90476ac`. It addresses two measured adversarial-set failures: `remove the the fries` and `make that make that two`. Repeated function words/command prefixes are handled; quantities and item nouns are never silently combined or discarded. No contract, core, controller, HTTP or provider change occurs. Focused checks retained signed/excessive/adjacent-number rejection, separate repeated ADDs, sequential referents, ambiguity and whole-batch invalid-modifier rejection.

Executed once on the combined candidate: fresh npm ci, typecheck, lint, **373 tests passed / 8 optional skips**, build and the existing receipt e2e, all passing. Seed `20260912` and the 1,000 generated engine sequences remain unchanged. C's submitted local in-process/HTTP evaluation reports retain 36 development cases and 24 separate adversarial cases: development results unchanged, two additional adversarial expected carts matched, four rejection-code differences remain, zero unexpected accepted carts. No held-out, Gemini or real voice evaluation occurred.

At this check B's branch advanced to `c86f73f` with voice availability handling, but `onDraftChange` still restricts `startInput()` to phase reviewing. The already reported draft blocker remains; A did not rerun its passing suite or expand the B review. C PR #4 is integrated independently while that specific correction is pending.

PR #4 merged as `904b7ab33c068faf06ac4521f668bce83f6d50af`; integration revision `8d552681c30db5c5f6b13910b211b047c0499613` is deployed as `dpl_4FE8vFjQMwC4n98c2cKHmEGh7HgR` (READY) at https://tartan-order.vercel.app. GitHub CI passed. A fresh logged-out browser passed 11 real HTTP utterances: the full prior edit/undo/ambiguity/review/receipt journey plus both repeated-word cases, followed by offline local-only typed confirmation with no HTTP calls and zero page errors. Health remains rules. Next dependency remains B's actual draft-lifecycle correction; human microphone success is unverified.
