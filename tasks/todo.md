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
