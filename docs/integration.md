# Integration — conversational V2 release

The September 12 end-to-end goal supersedes the earlier ownership restrictions, V1 freeze and rules-only deployment plan. A now integrates and fixes the complete app. The former integration heartbeat is paused. The V1 notes below are historical evidence, not current implementation instructions or blockers.

## Current implementation

*Historical V2 description; the catalog and orders now live in Supabase, see [Supabase persistence — September 12, 2026, afternoon EDT](#supabase-persistence--september-12-2026-afternoon-edt) below.*

- One Next.js app and the existing GitHub/Vercel project remain. The page composes `useOrderController()` and `Kiosk({controller})`; no second app, database, purchase or POS dispatch was added.
- Shared strict schemas now export `API_VERSION=2`, `MENU_VERSION='demo-v2'`, bounded current-cart/recent-turn/pending context, unavailable-item notices and pending-choice resolution. Eleven authoritative menu items include burger double/no lettuce. Pizza remains unavailable. All consumers changed together. V1 audit files are intentionally rejected by V2 replay.
- Online is the default; Gemini interprets the whole utterance before any language guard. The verified local model is `gemini-3.6-flash`. A real `gemini-2.5-flash` generation request was unavailable for this credential; model-list presence was not treated as proof. The key remains server-only in ignored local configuration and protected Vercel settings.
- The engine validates every accepted operation atomically and owns line IDs, quantities, modifiers, prices, totals, references, undo, revision/dedup checks, review and simulated receipt. Unavailable independent items are notices; conditional replacements clarify. Spoken answers resolve recorded pending choices and revalidate their original batches.
- The controller supplies bounded context and generates successful change descriptions only from accepted before/after cart snapshots. Local rules fallback is explicitly labelled. It never silently supplies fixture results.
- Browser speech accumulates complete final chunks until Stop/end, submits once, ignores partial/cancelled results and cannot reopen a fallback recognizer after Stop. Draft/capture/parse input blocks review and confirmation. Actual human microphone success remains unverified.

Current exports remain in `src/contracts/index.ts`, `src/contracts/menu.ts`, `src/core/engine.ts`, `src/controller/useOrderController.ts`, `src/parser/client.ts`, `src/parser/rules.ts` and `src/ui/Kiosk.tsx`. Replay is a detached, read-only reconstruction from exported recorded events; it performs no recognition, HTTP or live-cart action.

## Final teammate reconciliation

Before release, main was confirmed at `13bb1fe`; PRs #1, #3 and #4 and B's PR #2 were already integrated and were not applied twice. B's remaining provider compatibility adjustment from `fc73c8c` was incorporated into the new shared implementation. C's newly published `work/c-gemini` (`b30e5b9` / implementation `36d40b7`) was inspected separately: its provider compatibility changes were already covered, its actual-client HTTP evaluation helper was retained with four transport regressions, and five original evidence files were preserved with [historical context](../evals/runs/HISTORICAL-C-36d40b7.md). The old pre-model grammar guard was not reinstated because it conflicts with the current conversational goal. The previous typed-draft and Stop fallback blockers are fixed in this V2 candidate.

## Release checks — September 12, 2026

Fresh `npm ci` completed with zero reported vulnerabilities. Typecheck, lint, production build, **472 default unit/contract/property tests** and **19/19 Playwright checks** passed. Four additional evaluation transport regressions also passed after C’s helper was incorporated; relevant evaluation checks, typecheck and focused lint passed. Eighteen opt-in checks were skipped by the default unit command; no browser test was skipped. The mocked HTTP 503 fallback test observed the actual client request and honest rules recovery. The engine property test ran **1,000 generated sequences of up to 50 events, seed 20260912**, including invalid/stale events. Mocked speech and TTS tests are not human microphone evidence.

The opt-in local real-HTTP Gemini acceptance run passed **nine scenarios**, including the exact long request, across-turn correction, mixed pizza subset, natural clarification answer, new menu/options, invalid quantities/pairings, conditional unavailable requests, and previously unused phrasings. The complete recorded evidence is [the live acceptance JSON](../evals/runs/live-app-gemini-2026-09-12T06-14-45-051Z.json). Every request had HTTP 200, Gemini mode and no fallback; actual native provider calls were independently observed. This small typed run is not a general accuracy or voice benchmark.

A fresh local production browser also completed a **$13.50 local-rules simulated receipt with browser networking disabled**, zero interpret requests and zero page errors. This V2 check used browser offline emulation; the physical Wi-Fi-off trial in the historical V1 notes is a separate earlier result.

Runnable checks:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
# Explicit real-provider usage against a configured running server:
LIVE_APP_URL=http://localhost:3000 npm run test:gemini
```

V2 is live at https://tartan-order.vercel.app: application revision `3bb09ba2ae0a8409f84bd22803b3266f18b2a918`, verified/promoted deployment `dpl_8ou8KnrR6r6tbP6rGbhBmRY5eoFV`. GitHub CI passed all gates, including **476 tests / 18 opt-in skips** and **19 browser checks**. Public health returns V2/demo-v2/Gemini. A real hosted request (“I would love a burger and a glass of lemonade, please.”) returned the two correct ADDs, Gemini and no fallback. The server recorded an actual provider call and nonzero token usage, so this is more than a mode flag.

The first V2 hosted candidate failed because its runtime lacked a usable key; it was not promoted as the release. A securely synchronized the locally verified key/settings to Vercel and verified the rebuilt deployment before promotion. Secrets were not printed or committed. The configured/verified model is Gemini 3.6 Flash. The [fresh public Chromium recording run](../evals/runs/production-browser-gemini-2026-09-12.json) passed with **five real Gemini responses, no fallback, and zero page errors**. It exercised the exact long order, across-turn correction, Undo, supported pizza subset, targeted ambiguity and natural answer, then a full review and explicit $10.50 simulated receipt. The silent, visibly labelled backup is saved locally at `test-results/demo-recording/tartanorder-gemini.webm` (**149.92 seconds**, 1280×800); playback frames at 25/65/110/140 seconds were inspected. It is a recorded typed demonstration, not live speech evidence. The final receipt remains visible for the presenter's architecture explanation. Human microphone trial instructions are in [demo.md](demo.md); recovery and setup are in [runbook.md](runbook.md).

---

## Historical V1 integration record

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

## Corrected B intake — draft fixed; Stop fallback correction required

Reviewed PR #2 ready SHA `f9ed637402b34cf5b3424ffc3443a910edd3c1cf` against main `915e770` on September 12 around 1:03 a.m. EDT. C PRs #1, #3 and #4 were first verified as already integrated; none was reapplied. The isolated `integration/b-corrected` candidate merges cleanly and changes only B-owned paths. The original typed-draft blocker is resolved: first meaningful input starts capture in editing, clarifying and reviewing, cancels prior parsing, and blocks review/confirmation until submission, discard or erase. B added real-controller regressions for draft and late-response behavior.

Required checks ran once: fresh npm ci (zero reported vulnerabilities), typecheck, lint, build, **422 default tests passed / 8 optional checks skipped**, and **18/18 Playwright tests passed without e2e skips**. The HTTP 503 fallback test actually ran with C's HTTP client. Seed `20260912` still covers 1,000 generated engine sequences. A fresh logged-out browser against the combined local production server passed five real HTTP rules utterances, edit/undo/ambiguity, draft and review guards, explicit $13.50 receipt, download of its 23-entry audit, and offline local-only typed confirmation with no additional HTTP calls or page errors. The receipt layout was visually inspected.

**Deployment held for one new concrete blocker:** B added on-device recognition fallback after the original intake. At `src/voice/useSpeech.ts:327–333`, an on-device `language-not-supported` error can reopen cloud recognition after the user has pressed **Stop — I'm done**. The opposite fallback direction checks `stoppedRef`; this branch does not. A targeted test using the actual hook and controller with a mocked recognizer reproduced it: first cloud-to-device capture submits lemonade; the next on-device capture is stopped; a delayed language error creates a fourth recognizer (three existed at Stop), starts cloud recognition and allows a new fries transcript to reach the parser and cart. The expected no-restart safety assertion failed. The temporary A-owned reproduction file was removed; no B source or tests were edited.

B needs to guard this fallback after Stop and settle the failed capture, while preserving final results from the stopped original engine. Add a B-owned regression proving no replacement starts and no new transcript reaches the controller in this sequence, then send a corrected ready SHA. A reported the exact correction on PR #2 under the user's authorization. This replaces the original draft hold; do not repeatedly test or notify on unchanged `f9ed637`.

While A reviewed this candidate, `levi10101010` independently merged PR #2 as `511dde43d810ea14bfbe5a396d3f7d82ee75a7a1` at 00:59:45 EDT. A discovered that concurrent merge when pushing the correction report, preserved it, and did not apply B twice or force-push. The [Stop correction review](https://github.com/cadensolomon07/TartanOrder/pull/2#pullrequestreview-5185330866) supersedes the old draft blocker. Its original wording says held before merge because A had not yet observed the concurrent merge; **B is now on main, but A has not approved or deployed that revision**.

Public HTTP verification after discovering the merge still returned the previous starter (no B kiosk marker), with rules health. Vercel inspection identifies the current public deployment as `dpl_GDNrzEtG26wcxEUF9H2r6JEmBmUF`, created at 00:16:20 EDT; this is a later deployment than A's recorded `8d55268` release. The combined B candidate runs on this Mac at http://127.0.0.1:3140. All automated voice evidence is mocked; human microphone success remains unverified. Core/contracts are unchanged, Gemini remains unverified and disabled, and direct audio remains deferred. The next dependency is a B-owned Stop correction atop current main, supplied as a ready commit or new PR; do not reinterpret the already merged PR as permission to deploy a known defect.

### Concurrent merge and automatic deployment recovery

A's report commit `6302b31` preserved the concurrent B merge; publishing it triggered Vercel's automatic production deployment `dpl_5r2ViPwMFoFoS34TbwkcjDwcGQzD`. A detected the public alias moving to that revision and rolled back to `dpl_GDNrzEtG26wcxEUF9H2r6JEmBmUF`. Rollback succeeded; a fresh inspection verified READY and all public aliases on that prior deployment. A fresh logged-out browser then passed 11 real rules HTTP utterances, the corrected C cases, edit/undo/ambiguity/review/receipt journey and offline local-only typed receipt with zero page errors. This browser run was recovery verification after the deployment changed, not an unchanged-suite rerun.

**Current production is the typed A/C starter. Main includes B, with the Stop defect awaiting B's correction.** Rollback pauses automatic production-domain assignment; A must deliberately promote a verified corrected deployment to resume normal release behavior. Preserve main and teammate ownership. No source revert or force-push occurred. The core and V1 contracts remain unchanged.

## Unsupported extras correction — September 12, 3:02 a.m. EDT

A real microphone report showed the complete transcript “Hi I'd like a burger and a veggie wrap and some fries with extra salt” but an empty cart and generic invalid-option message. The user reports voice generally working; this screenshot establishes the specific captured transcript and the former rejected result, not a full microphone benchmark.

The Gemini policy now proposes standard available items and valid options with a typed `unavailable_option` notice naming the item and unsupported extra. For the reported order, burger/veggie wrap/standard fries total **$18.50**, with an explicit extra-salt explanation. A conditional order (“only if” / “otherwise don't order”) clarifies before mutation. Unsupported-option-only edits to an existing cart reject with specific structured detail. These optional notices extend V2 proposal/reject metadata; existing V2 logs remain valid. Refresh an already-open kiosk to load the new consumer.

The engine and menu are unchanged: invalid raw operations still reject the entire batch, no unsupported modifier is invented, and Undo restores the whole accepted batch. Only accepted cart snapshots generate success claims. The controller formats option details from bounded structured fields rather than arbitrary model rejection prose.

Checks passed: typecheck, lint, **490 default tests / 20 opt-in skips**, production build and **19/19 browser checks**. The two focused real-Gemini acceptance scenarios passed using three local HTTP requests: the exact reported order, an unsupported-only follow-up, and a conditional order. Existing passing live scenarios were not rerun. Evidence: [live-app-gemini-2026-09-12T07-01-32-068Z.json](../evals/runs/live-app-gemini-2026-09-12T07-01-32-068Z.json). Production verification follows publication.

## Published campus catalog — September 12, 3:49 a.m. EDT

The user requested CMU-wide menu expansion using ScottyLabs. Current main was verified unchanged at `ffb7fb2`; no teammate changes were overwritten. The public v2 directory supplies 45 locations and 14 menu links, not item prices. The released catalog transcribes 410 explicitly priced configurations from 12 locations' CMU-hosted PDFs. Unavailable/conflicting/starting-price/required-choice entries remain omitted; other locations stay visible with honest source links. See [dining-data.md](dining-data.md) for coverage, source hashes/page references, dated-price limits and the read-only `npm run dining:check` command. Source checking matched all 13 PDF hashes and all directory links.

Contract remains API 2 with menu version `cmu-published-2026-09-12`. `LocationIdSchema` and optional request `locationId` scope interpretation; the canonical ItemId enum derives from released items. The controller exports `locationId`/`setLocation`, preserving the cart while cancelling input, parsing, review and old clarification context. The recorded `INPUT_STARTED.discardContinuation` option keeps that transition replayable. Engine cart validation/pricing/undo/confirmation logic stays intact. Each published item has its own location-qualified ID; review and receipt display the venue and source-price label. The original Demo Counter remains separately selectable with unchanged sample prices.

Gemini initially refused the larger repeated long-ID schema with HTTP 400. A per-request server dictionary now maps canonical IDs to short provider-only symbols in prompt/schema/context, then decodes exact symbols before the unchanged strict shared validation and engine. Unknown symbols and wrong-location additions reject. No arbitrary prices or canonical IDs are accepted. Real direct requests verified both Stack'd ordering and Nourish's honest OFF_MENU result after this correction; no credential/configuration change was needed. Real Gemini remains the online mode. Campus local rules accept one exact item/quantity per input plus remove, quantity edits and undo; every one of the 410 full labels was exercised in the parser test. Fixture/mock results remain identified as such.

Initial complete gates passed typecheck, lint, build, **528 default tests / 20 opt-in skips**, and **22 browser checks**. The provider-format correction added one regression: **131 focused parser tests passed**; production build/type validation, lint and the three relevant campus browser checks passed again. The browser suite includes actual invocation of mocked HTTP 503 fallback for both Demo Counter and a campus menu, location-switch review invalidation/cart retention, and a browser-offline prebuilt production $12.65 typed receipt with zero interpret requests. Mobile and desktop campus pages were visually inspected with no horizontal overflow; the input example was corrected to match the selected location.

The [local real-browser evidence](../evals/runs/campus-browser-gemini-2026-09-12T07-46-33-814Z.json) passed 13 cases with **14 real HTTP/Gemini requests**, no retries/fallback and zero page errors: one correctly priced item per imported location, plus a two-item Stack'd order, follow-up quantity correction, Undo, review and explicit simulated receipt. This is typed browser evidence, not a new microphone accuracy claim. The user reports prior live microphone success; a new campus spoken trial remains a human check. Reproduce deliberately with `npm run test:campus:live` against the prebuilt local server; `CAMPUS_APP_URL` selects another owned deployment. The command makes real provider requests and records a dated report.

Deployment verification follows publication. Remaining coverage blocker: authoritative item prices and resolved configurations for the unpriced locations/omitted items; the API alone cannot supply them. No real purchase, dispatch, tax, stock or meal-plan calculation was added.


## Deterministic wait milestone — September 12, 10:21 a.m. EDT

The user authorized this addition and whole-project integration. API 2 and the published menu version stay unchanged. The exact strict schemas and inferred types live only in `src/contracts/index.ts`; `src/contracts/waits.ts` reexports them. Existing logs without optional wait configuration still replay with the previous view shape. Gemini operations are unchanged and cannot generate a swap.

Shared shapes:

```ts
WaitTimeSnapshot = { id, source: "seeded" | "api", asOf, waits: Partial<Record<LocationId, number | null>> }
WaitEngineConfig = {
  snapshot: WaitTimeSnapshot, available: boolean, unavailableReason: string | null,
  evaluatedAt: string,
  groups: { id, itemIds: ItemId[], differences: Partial<Record<ItemId, string>> }[],
  nearbyPairs: { vendors: [LocationId, LocationId], sourceUrl, note }[],
  swapThresholdMinutes: number, priceToleranceCents: number
}
WaitView = {
  snapshotId, source, asOf, status: "empty" | "known" | "unavailable",
  estimateMinutes: number | null, lineWaits: Record<string, number | null>
}
SwapOffer = {
  offerId, originalLineId, revision, waitSnapshotId, quantity,
  original: { itemId, vendorId, waitMinutes, unitPriceCents },
  alternative: { itemId, vendorId, waitMinutes, unitPriceCents },
  retainedModifiers, removedModifiers, differences,
  priceDifferenceCents, currentCartEstimateMinutes, projectedCartEstimateMinutes,
  itemWaitReductionMinutes, cartWaitReductionMinutes
}
UiAction += { type: "ACCEPT_SWAP", offerId, revision } | { type: "DECLINE_SWAP", offerId }
OrderView += { wait?: WaitView, swapOffer?: SwapOffer | null }
ExportLog += { waitConfig?: WaitEngineConfig }
```

All objects are strict; IDs retain the 100-character bound, quantities 1–5, prices integer cents, and waits finite/nonnegative. Dates are ISO strings. A missing vendor value means unknown. Whole-cart estimates/reductions are nullable when any contributing wait is unknown. The signed price difference is for the full line quantity. `STALE_OFFER` is the new rejection code. Shared `WAIT_FIXTURE_CONFIG` and `WAIT_FIXTURE_OFFER` are explicitly test data; the offer fixture uses two sandwiches and +158 cents.

`loadWaitConfiguration()` in `src/waits/config.server.ts` runs outside the engine. The server page injects it through `OrderApp` → `useOrderController(locationId, waitConfig)` → `createOrderController({waitConfig})` → `createEngine(sessionId, config)`. A session retains that fixed configuration; export records it and replay loads it without API, clock, voice or live-session actions. API snapshot freshness is evaluated against recorded `evaluatedAt` with a five-minute bound, including rejection of future timestamps. The seeded fixture is deliberately labelled simulated and is not represented as a recent measured queue.

Only successful ADDs select one curated alternative. Accept revalidates the offer/revision/snapshot/item and replaces the row atomically with the same line ID/quantity. It updates the selected vendor and subsequent actual cart context. No wait data or offer wording enters Gemini context. New input/cart edits/review dismiss offers; declined/dismissed/accepted rows are suppressed for the session. Undo restores the prior cart and its fixed-snapshot estimate. The UI displays engine values and combines acknowledgment/offer in one speech request; speech tests remain mocks.

The seed demonstrates Stack’d Nashville sandwich (920 cents, 14 minutes) → The Grill at Scotty’s fried chicken sandwich (999 cents, 4 minutes), disclosing that Scotty’s toppings/bread/portion are unspecified. The second pair is the explicitly listed 12 oz latte at La Prima Gates → Wean, 500 cents each. Nearby pairs are curated from verified directory coordinates, with no walking-time claim. More detail: [wait-data.md](wait-data.md). Full integration and public release results follow below.


### Wait release checks

Final source typecheck and lint passed; **577 default tests passed / 20 opt-in checks skipped**. The existing 1,000 generated sequences (up to 50 events, seed `20260912`) remain green. Wait coverage includes 22 engine cases, 12 provider cases, strict contracts, controller context synchronization and 10 UI cases. The full production browser suite passed **24/24**, including both actual invocations of mocked HTTP 503 fallback and the new browser-offline wait swap/Undo/receipt. A final whitespace-only dismissal correction and plain-language price label were covered by focused UI tests, followed by final full unit/type/lint checks and rebuild/relevant browser checks. The correction dismisses on the first space and releases capture when erased.

The [real local Gemini wait journey](../evals/runs/waits-browser-gemini-2026-09-12T14-25-36-014Z.json) passed three actual HTTP requests without retries or fallback: the exact southern-style Nashville sandwich, “Make that two” after accepting Scotty’s replacement, and a combined fries/sandwich order. It verified $9.20/14 min → $9.99/4 min, correct conversational quantity changes, Undo, review and explicit receipt, plus the multi-item $12.65 → $13.44 case whose whole-cart estimate remains 14 min. Export includes the fixed wait configuration and swap actions. Desktop/mobile were inspected; no page errors or horizontal overflow occurred. These are typed provider checks; human microphone success remains the user's reported observation, not automated speech accuracy evidence.

Reproduce the deliberate live check with `npm run test:waits:live`; set `WAITS_APP_URL=https://tartan-order.vercel.app` for a fresh public browser. It requires actual Gemini responses and records a dated JSON report, screenshots and exported audit. This command incurs real provider requests; default CI uses explicit fixtures/rules instead. Public deployment is verified separately after publication.


## Requested menu consolidation — September 12, noon EDT

The public kiosk now contains the ten named venues plus Schatz in the supplied order: Hunan, The Exchange, Revolution Noodle, Tahini, Stack’d, Capital Grains, Au Bon Pain, Taste of India, Wild Blue, The Grill at Scotty’s, Schatz. The source's qualitative ranking is not represented as measured popularity. Other restaurants and Demo Counter are unavailable in the public selector and rejected from public requests/new cart additions. Internal historical data and fixtures remain for regression checks.

API stays 2; menu version is now `cmu-shortlist-2026-09-12`. `ACTIVE_LOCATION_IDS`, `ACTIVE_DINING_LOCATIONS`, `ACTIVE_CAMPUS_ITEMS` and `UNPRICED_MENU_ITEMS` come from the sole shared catalog. `PublicParseRequestSchema` validates active locations and bounded context; the HTTP handler also rejects retired ADDs in returned proposals. `createEngine(sessionId, waitConfig?, allowedLocationIds?)`, `createOrderController({allowedLocationIds})` and the controller hook's third parameter enforce the same explicit policy for the public app, including manual operations, temporary batches, clarification choices, swaps and reset. Export records `allowedLocationIds`; replay reconstructs it deterministically. Optional policy omission exists for internal regression fixtures, not a public request setting.

The eight priced venues have **237 orderable choices**. New PDF transcriptions cover Hunan sides/drinks, explicit Tahini configurations, Revolution bao/drinks and Wild Blue mini bowls/drinks. There are **50 disabled previews**, including Hunan's eight entrées with published base prices but unresolved included-side choices. Au Bon Pain, Capital Grains and Schatz have no complete priced configurations to order. Older Hunan/Tahini source dates are disclosed. Ten active PDF hashes and all directory baselines matched in the read-only source check; Schatz's non-PDF page was not checked. No prices were inferred from other restaurants or starting-at amounts. See dining-data.md for precise provenance and limitations.

The retained wait example is Stack’d Nashville sandwich → Scotty’s fried chicken sandwich. Retired café alternatives and their seeded values were removed. The snapshot is `seeded-waits-shortlist-v1`; the existing explicit simulated-wait and maximum-vendor-wait behavior remains.

Executed checks on the consolidated runtime: typecheck and lint passed; **607 default tests passed / 20 opt-in tests skipped**; production build passed; **26/26 browser checks passed with no skips**, including invoked HTTP 503 fallback, atomic rejection, current-campus ambiguity/edit/review/confirmation, disabled unpriced previews, and browser-offline typed/wait recovery. Existing generated evidence remains **1,000 sequences up to 50 events, seed 20260912**. The optional HTTP acceptance and recording recipes were migrated to current campus items; both recording recipes collect and the opt-in HTTP file collects its 11 cases. No new video or microphone trial is claimed.

The [real local browser run](../evals/runs/campus-browser-gemini-2026-09-12T16-00-40-130Z.json) passed **10 actual Gemini requests**, no retries/fallback, zero page errors: one correctly priced item from each priced venue, then a combined Stack’d burger/fries order, conversational quantity edit, Undo and explicitly confirmed $12.65 simulated receipt. This is typed provider evidence. Public deployment verification follows publication and is reported separately; this entry does not claim it has already run.

Runnable examples: choose Revolution Noodle, type `one steamed pork bao bun` → **$4.19**; choose Tahini, type `one falafel sandwich pita` → **$9.95**. Review and explicitly confirm. In Local only mode use one exact named item per input. Current demo/recovery instructions are in demo.md and the top of runbook.md. Remaining data blocker: authoritative complete prices/configurations for the disabled entries; no fabricated prices or real order dispatch was added.

## Supabase persistence — September 12, 2026, afternoon EDT

The user asked for the menu data and orders to be stored in Supabase instead of TypeScript constants and browser memory, using the current publishable/secret API keys rather than the deprecated `anon`/`service_role` JWTs, and without a local stack. The decision record is [adr-supabase-persistence.md](adr-supabase-persistence.md); the plan is `docs/plan/supabase-persistence.md`.

What changed, all consumers together:

- **Contract V3.** `API_VERSION=3`. `ItemIdSchema`, `LocationIdSchema` and `menuVersion` are bounded strings validated against the loaded catalog instead of import-time enums and literals; `CatalogSchema` describes one released version; `HealthResponseSchema` gained `catalog` and `orderPersistence`; new session/events/receipt request schemas and a persistence error/acknowledgement envelope. V2 exports are rejected on replay exactly as V1 exports were on V2.
- **Catalog as data.** The server loads the active version from the project (`src/db/catalog.server.ts`, publishable-key reader, cached per version) or the labelled bundled fallback (`src/catalog/bundled.ts`), and passes it as props. `createEngine(sessionId, { catalog, waitConfig?, allowedLocationIds? })`, `replayLog(json, catalog)`, per-catalog parser lexicons, and a React `CatalogProvider` replace every module-level import of `campus.ts`/`menu.ts`; the only runtime importer of those files is the bundled builder.
- **Database.** Migrations `20260912164718 init_catalog_and_orders` and `20260912164935 items_ordinal` were applied to project `rdjcqtpusbjxgigprpns`; the seed for `cmu-shortlist-2026-09-12` was applied through the secret key and verified by read-only SQL: 506 items, 46 locations (11 ranked in the requested order), 50 previews, 7 modifiers, exactly one active version, 237 orderable items. An `update` on `items` fails with `catalog rows are immutable; publish a new catalog version instead`. `npm run db:verify` through the publishable key matched those counts and saw zero rows in `sessions`, `audit_events` and `receipts`.
- **Orders.** `POST /api/sessions`, `POST /api/sessions/[id]/events` (idempotent on `seq`, 409 on a gap), `POST /api/sessions/[id]/receipt`, `GET /api/sessions/[id]/export`, all writer-backed and V3-validated; a write-behind persist port in the controller with a kiosk badge and Retry; the engineering panel fetches the server copy.

Evidence recorded during implementation:

- Layer test runs while porting: engine/waits/contracts 137 passed; parser suite 366 passed with `npm run eval` reproducing dev exact cart 12/12 and 0 leaked adversarial proposals (the pre-existing `dev-020` "a coke" label predates the `coke` alias added in `2feb66d` and now yields cola, counted as one dev-split leak); database/catalog/health 20 passed; controller/UI 268 passed; after wiring persistence, `tests/core tests/ui tests/persistence tests/contracts tests/catalog` 279 passed with 12 opt-in skips.
- Whole-tree unit suite before persistence wiring: **644 passed, 21 skipped**, typecheck and lint clean.
- `npm run test:db:live` against the project: one `e2e-` session created idempotently, overlapping audit appends acknowledged without duplicates, receipt saved twice without error, the stored export replayed to the identical `OrderView`, the publishable key returned zero session rows, and the session was deleted afterwards.
- Final whole-tree checks (typecheck, lint, unit suite, production build, key-leak grep of `.next/static`, keyless browser suite, live browser suite, deployed health): Final whole-tree checks on 2026-09-12 (local Node 26; Playwright Chromium): `tsc --noEmit` 0 errors; `eslint .` clean; `npm test` 41 files passed, 4 skipped (env-gated live tests), 660 tests passed, 21 skipped; `npm run build` compiled; `npm run check:build` found no Supabase key material or project URL in 12 client assets under `.next/static`; `npm run test:e2e` (keyless, bundled catalog, persistence off) 28 passed, 3 skipped; `npm run test:e2e:live` (Supabase catalog and persistence) 30 passed, 1 skipped, teardown deleted the 33 sessions the run created; `npm run test:db:live` 1 passed (export replays to the identical view; the publishable key reads zero order rows). Deployed health is not yet verified: the Vercel environment variables have not been set from this machine.

Not changed: engine transition semantics, wait-swap thresholds, parser decision logic and grammar coverage, the shortlist and preview policy, `LIMITS`, voice code. Still unverified: current register prices, stock and hours (unchanged from the catalog notes); there is no user identity, so a session id is the only handle on a stored order.
