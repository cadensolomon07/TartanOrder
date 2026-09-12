# Supabase persistence plan — catalog and orders in the TartanHacks project

Written 2026-09-12; revised the same day for the new Supabase API keys, no local stack, and the eleven-venue catalog commit `551651c`. Objective: stop storing the menu catalog as TypeScript constants and orders in browser memory. Store both in the Supabase project **TartanOrder** (ref `rdjcqtpusbjxgigprpns`, organization **TartanHacks** `eabunjgetvxxnoksteib`, region us-west-2, Postgres 17.6, API URL `https://rdjcqtpusbjxgigprpns.supabase.co`). At planning time the project has **no tables and no migrations**; `pgcrypto`, `uuid-ossp`, `pg_stat_statements` and `supabase_vault` are installed. It is the only database: there is **no local Supabase stack and no Docker** anywhere in this plan.

This plan supersedes the "no database" constraint recorded in `tasks/beyond-wrapper-plan.md`; that constraint belonged to the hackathon workstream split and the user has since asked for a database explicitly.

## Where the data lives today

- **Catalog.** `src/contracts/campus.ts` exports `DINING_SNAPSHOT`, `DINING_LOCATIONS` (45 directory rows, each with `menuUrl`, `directoryMenuUrl`, `detailUrl`, `sourceSha256`, `sourceNote`), `CAMPUS_ITEMS` (495 priced configurations with location, source page and provenance), `ACTIVE_LOCATION_IDS` (the eleven-venue public shortlist in display order), `ACTIVE_DINING_LOCATIONS`, `ACTIVE_CAMPUS_ITEMS` (237 orderable configurations across eight of those venues) and `UNPRICED_MENU_ITEMS` (50 disabled previews with no complete price). `src/contracts/menu.ts` exports the eleven-item `DEMO_MENU`, the merged frozen `MENU`, `MODIFIERS` (7) and the helpers `itemsForLocation`, `locationName`, `fullItemLabel`. `src/contracts/index.ts` pins `MENU_VERSION = "cmu-shortlist-2026-09-12"`, `API_VERSION = 2`, and builds `ItemIdSchema` / `LocationIdSchema` as Zod enums **at import time**. Sixteen source modules import the catalog at module level (engine, waits, four parser modules, gemini adapter, controller, seven UI modules, wait providers). Twelve test files and two scripts import it directly; `tests/core/catalog-policy.test.ts`, `tests/contracts/shortlist.test.ts` and `tests/ui/catalog.test.tsx` encode the shortlist and preview policy.
- **Orders.** `EngineState` lives in the controller's closure. `OrderView` carries lines, review, receipt and the full `audit` array. `exportLog()` serialises an `ExportLog` (`v`, `menuVersion`, `sessionId`, `audit`, `waitConfig`) for download from the engineering panel; `replayLog()` rebuilds a detached view from it. Nothing survives a reload. There is no authentication or user identity; a session id is `crypto.randomUUID()` in the browser.
- **Bootstrap pattern to copy.** `src/app/page.tsx` is `force-dynamic`, calls `loadWaitConfiguration()` on the server and passes `waitConfig` to the client as props. Environment modes are read only inside `*.server.ts` modules. `/api/health` reports the *effective* mode honestly.
- **Environment names already chosen.** The working-tree `.env.example` lists `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS`; this plan keeps those names and adds `SUPABASE_URL`.

## Invariants that must survive

1. **One immutable catalog per version.** A live cart, review or replay is never repriced by a remote update. Rows of a published version are never updated or deleted; a change is a new version.
2. **The engine stays pure.** No clock, network, randomness or I/O inside `src/core/**`. Persistence happens outside it, from recorded audit entries.
3. **Zod is the validation boundary at every edge**: client → route, route → database write, database read → application. Generated database types are a convenience, not the contract.
4. **No silent fallback.** A failed catalog load or a failed order write is shown and logged. Bundled data never quietly replaces database data.
5. **Secrets are server-only.** The secret key is used only in `*.server.ts` modules that import `server-only`; it never appears in `.next/static`. The legacy `anon` and `service_role` JWT keys are never used or configured.

## Decisions fixed by this plan (Step 1 confirms them or amends them with written reasons)

- **API keys.** Supabase's current keys are the **publishable key** (`sb_publishable_…`, replaces `anon`) and the **secret key** (`sb_secret_…`, replaces `service_role`); the legacy JWT keys are deprecated and keep working only until the end of 2026. The server holds two clients: a **reader** built from `SUPABASE_PUBLISHABLE_KEYS`, subject to Row Level Security, used for catalog reads; and a **writer** built from `SUPABASE_SECRET_KEYS`, which bypasses RLS, used only for session, audit and receipt writes and exports. Both are created with `persistSession`, `autoRefreshToken` and `detectSessionInUrl` off, in a module that imports `server-only`. The browser never talks to Supabase.
- **Row Level Security.** Enabled on every table. Catalog tables (`catalog_versions`, `locations`, `modifiers`, `items`, `menu_previews`) get a `select` policy for `anon` because menu data is public and the reader must see it. Order tables (`sessions`, `audit_events`, `receipts`) get **no policies**, so the publishable key can neither read nor write orders. Catalog tables additionally carry a `BEFORE UPDATE OR DELETE` trigger that raises, enforcing invariant 1 in the database.
- **Schema (public).** `catalog_versions(id, source_snapshot jsonb, published_at, is_active)` with a partial unique index on `is_active`; `locations(version_id, id, name, location, menu_url, directory_menu_url, detail_url, source_sha256, source_note, active_rank int null)` where `active_rank` 1–11 encodes the shortlist order and null means archived; `modifiers(version_id, id, label, price_cents)`; `items(version_id, id, location_id, label, category, description, price_cents, aliases text[], allowed_modifiers text[], source_page)`; `menu_previews(version_id, location_id, label, description, price_cents null, source_url, source_page, source_sha256)`; `sessions(id, catalog_version_id, wait_config jsonb, created_at)`; `audit_events(session_id, seq, event jsonb, outcome, code, recorded_at)` with primary key `(session_id, seq)`; `receipts(id, session_id, review_id, lines jsonb, total_cents, created_at)`. Item and location ids keep their current strings. The Demo Counter lives in the same tables with `location_id = 'demo'` and no `active_rank`.
- **Environment modes mirror the existing ones.** `CATALOG_SOURCE=supabase|bundled` (default `supabase`; `bundled` serves the in-repo TS catalog, is labelled in `/api/health` and the engineering panel, and exists for offline development, unit tests and CI). `ORDER_PERSISTENCE=supabase|off` (default `supabase`).
- **Migrations and seed.** SQL files under `supabase/migrations/` and `supabase/seed.sql` are the source of truth and are applied to the TartanHacks project through the Supabase MCP `apply_migration` (which records them in the project's migration history) or, equivalently, `supabase db push --linked` from the CLI without Docker. The remote schema is never hand-edited. Types are generated through the MCP `generate_typescript_types`. `supabase/seed.sql` is generated from the TS catalog by `scripts/seed-catalog.mjs`; after cutover the TS catalog files are only the generator input plus the `bundled` source, and no `src/**` module imports them at runtime.
- **Testing without a local stack.** Unit and route tests mock the data layer. Integration and end-to-end tests that need a database run against the TartanHacks project only when `.env.local` supplies the keys, skip cleanly otherwise, prefix their session ids with `e2e-`, and delete those sessions afterwards with the writer client. CI runs with no keys: unit tests plus Playwright in `bundled` mode.
- **Contract.** `menuVersion` fields become strings validated against the loaded version id; `ItemIdSchema` and `LocationIdSchema` become bounded strings validated against the loaded catalog at runtime; the `Catalog` shape carries the ranked location order and the previews so the shortlist and preview policy tests keep passing. `API_VERSION` bumps to 3 because `ExportLog`, `HealthResponse` and `ParseRequest` change shape (precedent: V1 logs are already unreplayable on V2).

## Prerequisites

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS` in `.env.local` locally and in Vercel project settings for production and preview. Never in chat, never committed. `.env.example` lists the names only.
- The Supabase MCP server (already configured in `.mcp.json`, which contains no secret) for applying migrations, generating types and running read-only verification SQL.
- Node 22.23.2 and `npm ci` as in the README. No Docker.

---

## Step 1. Design the persistence boundary and data model

**Intent.** Produce an architecture decision record that fixes the persistence boundary before any code moves. Evaluate the decisions above against the five invariants and the existing `waitConfig` bootstrap pattern, and choose: the exact columns and constraints for the eight tables; how the loaded `Catalog` value (ranked locations, items, previews, modifiers) is threaded into the engine, parsers and UI as data, passed as props from `page.tsx`; how `ItemIdSchema` / `LocationIdSchema` change from import-time enums to runtime validation without weakening any strict schema; the write-behind design for orders (append-only audit entries keyed by `(session_id, seq)`, receipts written on confirmation, a visible saved / saving / not-saved state, no retry storms); the reader / writer client split; and the V3 contract diff.

**Acceptance.** `docs/adr-supabase-persistence.md` exists with the table definitions, the catalog injection path naming every module that changes, the V3 contract diff, the RLS and key-handling stance (publishable reader, secret writer, no legacy keys), the fallback labelling rule, and an explicit list of what is not changed (engine purity, wait module semantics, parser decision logic, shortlist and preview policy). Every invariant above has a sentence explaining how the design keeps it.

**Out of scope.** Migrations or application code; user authentication; kitchen board or order history UI.

---

## Step 2. Create the schema, RLS, immutability trigger and seed, and apply them to the project

**Intent.** Write `supabase/migrations/0001_init.sql` creating the eight tables from the ADR with primary keys, foreign keys on `(version_id, id)`, non-negative cents checks, a category check, the partial unique index guaranteeing one active catalog version, `enable row level security` on every table, `select` policies for `anon` on the five catalog tables only, and the raise-on-update-or-delete trigger on the catalog tables. Write `scripts/seed-catalog.mjs`, which imports the TS catalog with Node 22 native TypeScript (the approach `scripts/check-dining.mjs` already uses) and emits `supabase/seed.sql` for version `cmu-shortlist-2026-09-12` including all 495 campus items, the 11 demo items, the 50 previews, the 46 locations with `active_rank` for the eleven shortlisted venues, and the 7 modifiers. Apply the migration and the seed to project `rdjcqtpusbjxgigprpns` through the Supabase MCP `apply_migration`, then generate `src/db/types.ts` through the MCP. Add `npm run db:seed:generate`.

**Acceptance.** Read-only SQL through the MCP shows 506 `items`, 46 `locations` of which 11 have `active_rank`, 50 `menu_previews`, 7 `modifiers`, and exactly one active `catalog_versions` row; an `update items set price_cents = 0 where …` attempt is rejected by the trigger; a request with the publishable key returns catalog rows and zero rows from every order table; the MCP `list_migrations` shows the migration.

**Out of scope.** Application code changes; a local Supabase stack.

---

## Step 3. Build the server-only data layer and catalog bootstrap

**Intent.** Add `src/db/client.server.ts`, importing `server-only`, exposing a memoised **reader** (publishable key) and **writer** (secret key) that validate `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS` at first use and throw a clear error otherwise, with session persistence, token refresh and URL detection disabled. Add `src/db/catalog.server.ts` (`loadActiveCatalog()` and `loadCatalogVersion(id)` using the reader, every row validated through Zod into the shared `Catalog` shape, each version cached in module memory by id because versions are immutable) and `src/catalog/bundled.ts` (the same `Catalog` shape from the TS files for `CATALOG_SOURCE=bundled`). Add `src/catalog/config.server.ts` mirroring `src/waits/config.server.ts`: it reads `CATALOG_SOURCE`, calls the matching source, and returns a validated `CatalogConfig { catalog, source, versionId, unavailableReason }`. Extend `/api/health` to report `catalog: { source, versionId }` and `orderPersistence`. Pin the exact `@supabase/supabase-js` version in `package.json` after confirming current server-side usage through Context7.

**Acceptance.** Unit tests with a mocked Supabase client cover: missing env fails fast with a named error; malformed rows are rejected by Zod, never partially accepted; a version is fetched once and served from cache afterwards; `bundled` mode never constructs a Supabase client; the reader is never given the secret key. `grep -rl "sb_secret\|SUPABASE_SECRET" .next/static` after `npm run build` returns no matches.

**Out of scope.** Changing any consumer of `MENU`; order persistence routes.

---

## Step 4. Port contracts, engine, and waits to an injected catalog

**Intent.** Migrate the pure layer off module-level catalog imports. In `src/contracts/index.ts` replace the import-time enums with bounded string schemas plus a `Catalog` schema (version, ranked locations, items, previews, modifiers) and a `catalogGuard(catalog)` helper that produces the strict item, location and modifier validators for a loaded catalog; make `menuVersion` a string; bump `API_VERSION` to 3; delete `MENU_VERSION`. Port `src/core/engine.ts` and `src/core/waits.ts` so `createEngine(sessionId, config)` receives the catalog inside its config and every `MENU[...]` / `MODIFIERS[...]` lookup, `totalCents`, `deriveWaitView`, `swapCandidates`, `exportLog` and `replayLog` read from it; `replayLog` embeds the catalog version id in the log and rejects a log whose version differs from the catalog supplied for replay. Update `src/contracts/fixtures.ts` and the contract, shortlist, catalog-policy, engine, engine property and waits tests to construct the bundled catalog through the Step 3 builder.

**Acceptance.** `npm run typecheck` passes with no remaining import of `@/contracts/menu` or `@/contracts/campus` under `src/core/**` or `src/contracts/index.ts`; `tests/core/**` and `tests/contracts/**` pass with the 1,000-sequence property suite unchanged in seed and length; a new test proves replay of a log recorded under version A against catalog B is rejected with `MENU_VERSION_MISMATCH`.

**Out of scope.** Parser, route, controller and UI modules; wait semantics; LIMITS.

---

## Step 5. Port the parsers and the interpret route to the loaded catalog

**Intent.** Migrate `src/parser/rules.ts`, `src/parser/rules/lexicon.ts`, `src/parser/rules/phonetic.ts`, `src/parser/campus.rules.ts` and `src/parser/gemini.server.ts` so the alias lexicon, phonetic table, per-location item lists and the menu sent to Gemini are derived from a `Catalog` argument instead of module constants; keep every existing fail-closed rule. In `src/app/api/interpret/route.ts` load the catalog through `src/catalog/config.server.ts`, return 409 `MENU_VERSION_MISMATCH` when the request's `menuVersion` is not the loaded version id (before the strict schema, as today), and pass the catalog into whichever parser runs. Update `src/parser/client.ts` only where the V3 envelope requires it. Port `tests/parser/**` and `evals/**` to build the bundled catalog once per file.

**Acceptance.** `npm run eval` (dev plus adversarial, in-process and HTTP) reproduces the last recorded outcomes exactly: dev 12/12 exact cart, 0 leaked proposals; `tests/parser/**` passes; a mocked-provider route test shows the Gemini request body contains only the loaded catalog's items for the selected location and no prices.

**Out of scope.** Grammar coverage, prompts, cross-check policy; controller and UI modules.

---

## Step 6. Port the controller and kiosk UI to the loaded catalog

**Intent.** Migrate `src/app/page.tsx` to load `catalogConfig` next to `waitConfig` and pass both as props; migrate `OrderApp`, `useOrderController`, `createOrderController` and the seven UI modules (`Kiosk`, `MenuButtons`, `DiningLocation`, `labels`, `LinePrice`, `SwapOfferPanel`, `reviewSpeech`) to read items, ranked locations, previews, labels, disclosures and the snapshot date from the catalog prop, preserving the shortlist order and the disabled preview rendering. When `catalogConfig.source` is `bundled` or the catalog is unavailable, the kiosk shows a labelled state in the header and the engineering panel, never an unlabelled menu. Port `tests/ui/**` and `tests/core/controller*.test.*` fixtures.

**Acceptance.** No module under `src/**` imports `@/contracts/menu` or `@/contracts/campus` except `src/catalog/bundled.ts`; `npm test` passes in full including the shortlist, catalog-policy and UI catalog tests; the Playwright suite passes unchanged against a production build with `CATALOG_SOURCE=bundled`; a UI test asserts the bundled label is visible in that mode.

**Out of scope.** Visual redesign; order persistence UI beyond what Step 7 adds.

---

## Step 7. Persist sessions, audit events, and receipts

**Intent.** Add server routes validated by the shared V3 schemas: `POST /api/sessions` (creates a row with the active catalog version id and the session's `waitConfig`), `POST /api/sessions/[id]/events` (upserts audit entries idempotently on `(session_id, seq)`, rejecting any entry whose seq is not contiguous with what is stored), `POST /api/sessions/[id]/receipt`, and `GET /api/sessions/[id]/export` (assembles an `ExportLog` from rows). Add `src/db/orders.server.ts` using the writer client. Extend the controller's injected `Dependencies` with a `persist` port implemented by a small fetch client; after each accepted audit entry the controller enqueues it write-behind so ordering never waits on the network; the kiosk shows saved / saving / not saved with a manual retry, and the engineering panel export can fetch the server copy. `ORDER_PERSISTENCE=off` disables the port and labels the state. Requests are bounded by the existing `LIMITS.requestBytes` and validated before any database call; the routes never echo transcripts into logs.

**Acceptance.** Route tests with a mocked data layer cover invalid bodies (400), unknown session (404), duplicate seq (idempotent 200), gap in seq (409), and oversized body (413); a controller test with a fake persist port shows a failed write never changes `OrderView` and surfaces the not-saved state; an env-gated integration test against the TartanHacks project, using an `e2e-`-prefixed session that it deletes afterwards, proves `replayLog(GET export)` equals the in-memory `getView` after a multi-step order with a clarification, Undo and confirmation.

**Out of scope.** User accounts, order history UI, a kitchen board, extra rate limiting.

---

## Step 8. End-to-end verification against the TartanHacks project

**Intent.** Make the database part of the end-to-end workflow without any local stack: a Playwright project that reads `.env.local`, skips with a clear message when the Supabase keys are absent, launches the production build with `CATALOG_SOURCE=supabase` and `ORDER_PERSISTENCE=supabase`, prefixes every session id with `e2e-`, and deletes those sessions in `globalTeardown` with the writer client. Add e2e journeys: the shortlist menu renders from the database in the ranked order with a known item and its published price and a disabled preview; order → clarify → Undo → review → confirm → reload → the session export from the server replays to the same receipt; the bundled-mode label appears when `CATALOG_SOURCE=bundled`. CI keeps running with no keys: `npm test` plus Playwright in `bundled` mode.

**Acceptance.** `npm run test:e2e` passes locally against the TartanHacks project; CI passes on the branch without any Supabase key; a read-only SQL count of sessions whose id starts with `e2e-` is zero after a run; no test reads production credentials from anywhere but `.env.local`.

**Out of scope.** A local Supabase stack; load or performance testing.

---

## Step 9. Configure Vercel, deploy, and verify

**Intent.** Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS` in Vercel for production and preview (the migration and seed were applied in Step 2), deploy, and confirm `/api/health` on the deployment reports `catalog.source = "supabase"` with version `cmu-shortlist-2026-09-12` and `orderPersistence = "supabase"`. Place one real simulated order on the deployment and confirm its `receipts` row by read-only SQL. Run the Supabase security and performance advisors and record their output. Keep the previous deployment available for rollback as the runbook describes. Confirm no legacy `anon` or `service_role` key is configured in Vercel or `.env.local`.

**Acceptance.** Deployed `/api/health` reports the Supabase catalog and persistence; the receipts row exists; the advisors report no security findings on the eight tables; only the new-format keys are configured.

**Out of scope.** Schema changes; deleting the TS catalog files.

---

## Step 10. Documentation and evidence

**Intent.** Update `README.md` (setup now names the three environment variables; menu and orders live in Supabase; a simulated order is still not a purchase; remove the "no database" line; no Docker required), `docs/engineering.md` (catalog and orders are loaded from and written to the database, engine still pure, immutability now enforced by the database trigger, reader / writer key split), `docs/dining-data.md` (the canonical released data is now the seeded catalog version; the TS files are the generator input), `docs/runbook.md` (environment variables, applying a migration through the MCP, rolling back a bad seed by publishing a new version, never editing rows, key rotation for the new-format keys), and `.env.example` (add `SUPABASE_URL`, `CATALOG_SOURCE`, `ORDER_PERSISTENCE`). Record the Step 8 and Step 9 evidence with dates and the deployed SHA.

**Acceptance.** A new contributor can follow README from clone to a passing `npm test` with no Docker; every claim in the docs about persistence points at a test, a migration file, or a recorded check; no document still says state lives only in browser memory or mentions the legacy keys as something to configure.

**Out of scope.** Marketing copy; unobserved production traffic claims.
