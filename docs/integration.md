# Integration — V1 shared starter

Repository: https://github.com/ClearSky00/TartanOrder. One Next.js App Router app in the repository root. Node22.23.2, npm, React, TypeScript, ordinary CSS, Zod, Vitest, fast-check, Playwright; Vercel is the only deployment target.

## Ownership and branches

- A: root package/config/lockfiles, app page/layout/global CSS, health route, contracts, core, controller, core/contract tests, integration/runbook, deployment. Work branch `work/a-engine`.
- B: `src/ui/**`, `src/voice/**`, `tests/ui/**`, `tests/e2e/**`, `public/demo/**`, `docs/demo.md`. Work branch `work/b-kiosk`.
- C: `src/parser/**`, interpret API route, parser tests, `evals/**`, `docs/evaluation.md`. Work branch `work/c-parser`.

Pull the bootstrap on main before working. Preserve teammate changes. A integrates small handoffs sequentially and runs checks. Do not generate another app or edit the shared schema independently. Publish proposed correctness fixes to A first; no contract expansion after H8.

## Bootstrap stub handoff

**B/C files are handed over as soon as the bootstrap is pushed (before minute 30).** A will stop editing them at that handoff.

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

All IDs are at most100 characters. Generated ADD IDs must also satisfy this limit: requests whose derived line IDs overflow are rejected atomically. Real controller IDs are short. Manual replay IDs derive from session and recorded audit sequence. Browser validation is prototype correctness, not a production security boundary.

## Handoff checklist

Each handoff records SHA, owned files/exports, checks actually run, runnable example, deployment URL if available, actual parser/input mode, known failures and next dependency. Check remote branches before integrating, and never force-push shared branches.

Scheduled sequential merges: H1.5, H3, H5.5, H8, H11, H14. H3 must show a real rules text-to-receipt journey; if it fails, stop feature expansion. Cut import/replay UI and visual extras first, while keeping engine/export/replay tests, atomicity and explicit confirmation.
