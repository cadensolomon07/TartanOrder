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
