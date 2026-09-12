# TODO — Supabase persistence (catalog + orders)

Plan: `docs/plan/supabase-persistence.md` (revised 2026-09-12: new `sb_publishable_`/`sb_secret_` API keys, no local stack, eleven-venue catalog `cmu-shortlist-2026-09-12`). Orchestrate commands were generated from it with `/ecc:plan-orchestrate`. Implemented 2026-09-12 except the Vercel part of Step 9 (no Vercel CLI or auth on this machine).

- [x] Step 1 — ADR (docs/adr-supabase-persistence.md, 2026-09-12): persistence boundary, eight table definitions, catalog injection path, reader/writer key split, V3 contract diff
- [x] Step 2 (applied to project 2026-09-12; counts verified) — `supabase/migrations/0001_init.sql` (8 tables, RLS, anon select on catalog only, immutability trigger), seed generator, apply migration + seed to project `rdjcqtpusbjxgigprpns` via MCP, generate types
- [x] Step 3 — server-only data layer (publishable reader, secret writer), catalog bootstrap (`CATALOG_SOURCE`), health reporting, key-leak grep
- [x] Step 4 — port contracts, engine, waits to injected catalog; replay rejects cross-version logs
- [x] Step 5 — port rules/phonetic/campus/gemini parsers and `/api/interpret`; evals reproduce recorded outcomes
- [x] Step 6 — port controller and kiosk UI (shortlist order, previews); labelled bundled/unavailable state
- [x] Step 7 (live parity test: npm run test:db:live) — sessions, audit events, receipts routes; write-behind persist port; env-gated replay parity test against the project
- [x] Step 8 (keyless 28 passed / live 30 passed, sessions cleaned up; CI pinned keyless) — Playwright against the project with `e2e-` sessions and teardown; keyless CI in bundled mode
- [~] Step 9 (advisors run and clean; fk_indexes migration applied; Vercel env + deploy pending: no Vercel CLI or auth on this machine) — Vercel env (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`), deploy, deployed health check, advisors, no legacy keys
- [x] Step 10 — README, engineering, dining-data, runbook, `.env.example`, evidence

## Review (2026-09-12)

- **Done.** Catalog and orders live in Supabase project `rdjcqtpusbjxgigprpns`: three migrations recorded (`init_catalog_and_orders`, `items_ordinal`, `fk_indexes`), seed applied (506 items, 46 locations / 11 ranked, 50 previews, 7 modifiers, one active version), immutability trigger verified, RLS on all eight tables with anon select on catalog tables only. App loads the catalog per request through the publishable-key reader, passes it as props, and threads it through engine, parsers and UI; orders are written behind the engine through the secret-key writer via four `/api/sessions` routes; kiosk shows menu source and save state. Contract is API 3.
- **Verified.** tsc 0 errors; eslint clean; 660 unit tests; build + `check:build`; e2e keyless 28 passed; e2e live 30 passed with cleanup; `test:db:live` passed; Supabase advisors: only the intended RLS-no-policy INFO and unused-new-index INFO.
- **Reviews.** code-reviewer: approve, one MEDIUM fixed (client no longer imports the seed-data module). security-reviewer: no critical/high in code; fixed the malformed-session-id URIError, added a per-session audit cap (413 `SESSION_LIMIT`), added the real build secret check to CI; rate limiting and server-side re-derivation of audit outcomes recorded as known limitations in the ADR.
- **Not done / needs the user.** Step 9 Vercel: set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS` (and optionally `CATALOG_SOURCE`, `ORDER_PERSISTENCE`) in the Vercel project for production and preview, deploy, then check `/api/health` reports `catalog.source: "supabase"` with version `cmu-shortlist-2026-09-12`. Nothing is committed; `git status` lists the change set.
- **Noticed, not changed.** `evals/cases/dev.jsonl` case dev-020 ("a coke", labelled reject OFF_MENU) is stale since commit 2feb66d made "coke" a cola alias; it shows as 1 leaked proposal on the dev split (adversarial stays 0). The label is a product call.

## Merge with upstream (2026-09-12, later)

- Upstream `origin/main` gained the kiosk redesign and the meal-budget / dietary-requirements release (4 commits, `bd87282`). Committed the persistence work on `feat/supabase-persistence` (`635b725`) and merged upstream into it: 21 conflicted files resolved by layer (contracts/core, parsers/route, controller/UI, docs/package.json); upstream's new food, meal, compatibility, requirements-parser and RequirementsPanel modules ported to the runtime catalog; `PUBLIC_LOCATION_IDS` became `menu.publicLocationIds` (ranked shortlist plus the fictional Demo Counter); badges live in the redesign's footer bar with unchanged test ids.
- Upstream changed Demo Counter item data and bumped the menu version, so the merged bundled catalog is `cmu-meal-2026-09-12`, published to the project as a second immutable version and activated (`npm run db:seed:apply`, `npm run db:verify`).
- Evidence: tsc 0, eslint clean, unit 751 passed / 30 skipped, build + check:build, e2e keyless 33 passed, e2e live 35 passed with cleanup, db live passed.
- Upstream moved again (46ded0f, 1929df3: meal/dietary controls integrated into the redesign); merged as `ad28f16` with five small conflicts resolved on top of the catalog wiring. `main` fast-forwarded to `ad28f16` and pushed to origin on 2026-09-12. Still pending: Vercel environment variables and the deployed health check.

## Dietary marks, ingredient modifiers, unavailable venues (2026-09-12, branch feat/dietary-marks)

Request: mark items for dietary restrictions from their published description and ingredients, offer ingredient modifications based on what the menu says, and remove venues with no orderable menu.

Design (see docs/adr-supabase-persistence.md invariants; evidence model from the meal release):
- Food evidence becomes catalog data: `CatalogItem.foodEvidence` (jsonb `items.food_evidence`), fictional recipes for the Demo Counter, ingredients INFERRED from the published name and description for campus items (provenance `inferred_campus`, completeness `partial`). Inference only adds ingredients: a detected meat, dairy, egg, wheat, soy, nut, sesame, fish or shellfish yields a conflict for the matching restriction; absence stays unverified. A published "veggie"/"vegan" word is a `dietaryClaims` entry that satisfies a preference (never an allergy).
- Modifiers become catalog data: `ModifierIdSchema` is a bounded string; `catalog.modifiers` carries the seven demo modifiers plus generated `no_<ingredient>` removals (price 0, `effect.remove`) for removable inferred toppings; each item's `allowedModifiers` lists the removals that apply to it. `foodEvidenceFor(menu, itemId, modifiers)` applies effects as data.
- Public shortlist drops the three venues with zero priced items (Au Bon Pain 113, Capital Grains 179, Schatz 108); their rows stay archived. Eight venues remain.
- New catalog version `cmu-dietary-2026-09-12` seeded to the project after a migration adding `items.food_evidence` and `modifiers.effect`.

- [x] Contract: ModifierIdSchema string, FoodEvidence/ModifierEffect schemas in contracts/index.ts, CatalogItem.foodEvidence, CatalogModifier.effect, src/catalog/food.ts
- [x] Inference module, bundled builder, seed rows, loader, migration, compatibility, lexicon and Gemini modifier enums, tests
- [x] UI marks on cards and cart, eight-venue selector, e2e and docs
- [x] Migration + seed applied (version cmu-dietary-2026-09-12 active), verify, full checks, committed on feat/dietary-marks (not merged or pushed)

## Audio-clip language fallback (planned 2026-09-12, not started)

Plan: `docs/plan/audio-language-fallback.md`. Orchestrate commands: `tasks/audio-language-fallback-orchestrate.md` (generated with `/ecc:plan-orchestrate`). Branch `feat/audio-language-fallback` from `main` once `feat/dietary-marks` is committed (both touch `src/contracts/index.ts` and `src/parser/gemini.server.ts`).

- [ ] Step 1 — ADR `docs/adr-audio-language-fallback.md` + Chrome concurrent-capture check on `public/demo/clip-check.html`
- [ ] Step 2 — additive contracts (`LIMITS.audioBytes/audioMs`, `AUDIO_MIME_TYPES`, `TranscribeResponseSchema`) + `src/parser/transcribe.server.ts`
- [ ] Step 3 — `POST /api/transcribe` route (caps, key check, envelope, log hygiene)
- [ ] Step 4 — `src/voice/useAudioClip.ts` + `src/voice/transcribe.client.ts`
- [ ] Step 5 — `src/voice/fallbackPolicy.ts`, `submit` returns `{ outcome, code }`, `useSpeech` lang reset, `sessionLang`
- [ ] Step 6 — Kiosk wiring, notices, engineering panel, real-controller test
- [ ] Step 7 — Playwright spec, opt-in live test on a Spanish clip, eval rows
- [ ] Step 8 — security review + chaos drill
- [ ] Step 9 — docs, runbook, evidence
