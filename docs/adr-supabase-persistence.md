# ADR — Supabase persistence for the catalog and orders

Status: accepted 2026-09-12. Plan: `docs/plan/supabase-persistence.md`. Supersedes the "no database" constraint in `tasks/beyond-wrapper-plan.md`.

## Decision summary

1. The menu catalog and every order (session, audit entries, receipt) live in the Supabase project **TartanOrder** (`rdjcqtpusbjxgigprpns`, org TartanHacks). The TypeScript catalog files remain only as the seed generator input and the labelled `bundled` fallback.
2. The application receives the catalog as **data**, never as a module constant. A validated `Catalog` value is loaded once per request on the server, passed to the client as props, and threaded into the engine, parsers and UI explicitly.
3. Two server-only Supabase clients: a **reader** built from the publishable key for catalog reads (RLS applies), and a **writer** built from the secret key for order writes and exports (bypasses RLS). The legacy `anon` / `service_role` JWT keys are never configured. The browser never talks to Supabase.
4. The shared contract moves to **API version 3**. Item, location and menu-version identifiers become bounded strings validated against the loaded catalog at runtime.

## How each invariant is kept

| Invariant | Mechanism |
|---|---|
| One immutable catalog per version | `catalog_versions` rows are addressed by id; `locations`, `modifiers`, `items`, `menu_previews` carry a `BEFORE UPDATE OR DELETE` trigger that raises; `catalog_versions` may only flip `is_active`. Every cart, review, export and replay carries the version id and is rejected against a different one. |
| Pure engine | `createEngine` receives the catalog in its options; no module in `src/core/**` imports the TS catalog or performs I/O. Persistence reads the append-only audit outside the engine. |
| Zod at every edge | `CatalogSchema` validates rows read from the database and the bundled builder; route bodies use the V3 schemas; the engine only ever sees a `Catalog` that passed the schema. Generated DB types are advisory. |
| No silent fallback | `CatalogConfig.source` is `supabase` or `bundled`; `bundled` is labelled in `/api/health`, the kiosk header and the engineering panel; a failed load yields an explicit unavailable state, never bundled data. |
| Server-only secrets | `src/db/client.server.ts` imports `server-only`; only `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS` are read; `npm run check:build` (`scripts/check-build-secrets.mjs`, run in CI after the build) fails if `.next/static` contains key prefixes, the env names or the project URL. |

## Data model (public schema)

| Table | Key | Notes |
|---|---|---|
| `catalog_versions` | `id text` | `source_snapshot jsonb`, `published_at`, `is_active`; partial unique index on `is_active where is_active`. |
| `locations` | `(version_id, id)` | `name, location, menu_url, directory_menu_url, detail_url, source_sha256, source_note, active_rank int null`; `active_rank` 1..11 is the public shortlist order, null = archived; unique `(version_id, active_rank)`. The Demo Counter is `id = 'demo'`, archived. |
| `modifiers` | `(version_id, id)` | `label, price_cents >= 0`. |
| `items` | `(version_id, id)` | `location_id` FK to `locations`, `label, category in (mains,sides,drinks), description, price_cents >= 0, aliases text[], allowed_modifiers text[], source_page int null, ordinal int` (unique per version; preserves the published display order when loading from the database). |
| `menu_previews` | `(version_id, location_id, ordinal)` | unpriced previews: `label, description, price_cents null, source_url, source_page, source_sha256`. |
| `sessions` | `id text` | `catalog_version_id` FK, `wait_config jsonb null`, `allowed_location_ids text[] null`, `created_at`. |
| `audit_events` | `(session_id, seq)` | `event jsonb, outcome, code, recorded_at`; FK cascade on session delete. |
| `receipts` | `id text` | `session_id` FK cascade, `review_id, lines jsonb, total_cents >= 0, created_at`. |

RLS is enabled on all eight tables. The five catalog tables have one `select` policy for `anon` and `authenticated`. The three order tables have no policies.

Migrations applied 2026-09-12: `20260912164718 init_catalog_and_orders`, `20260912164935 items_ordinal`, `20260912171110 fk_indexes` (covering indexes for the three foreign keys the performance advisor flagged). Advisors after apply: security reports only the intended INFO that `sessions`, `audit_events` and `receipts` have RLS enabled with no policies; performance reports only that the new indexes are not yet used. Seed counts for version `cmu-shortlist-2026-09-12`: 506 items (495 campus + 11 demo), 46 locations (45 directory + demo; 11 ranked), 50 previews, 7 modifiers.

## Shared contract (V3) — exact shapes

```ts
// src/contracts/index.ts
export const API_VERSION = 3 as const;
export const ItemIdSchema = z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9_-]*$/);
export const LocationIdSchema = z.string().min(1).max(20).regex(/^[a-z0-9]+$/);
export const MenuVersionSchema = IdSchema;                 // replaces z.literal(MENU_VERSION)
export const ModifierIdSchema = z.enum([...7 ids]);        // unchanged; modifiers are grammar
export type ItemId = string; export type LocationId = string;

export const CatalogLocationSchema = z.strictObject({ id: LocationIdSchema, name, location, menuUrl: url|null,
  directoryMenuUrl: url|null, detailUrl: url|null, sourceSha256: string|null, sourceNote: string|null, activeRank: int>0|null });
export const CatalogItemSchema = z.strictObject({ id: ItemIdSchema, locationId: LocationIdSchema, label, category: enum(mains|sides|drinks),
  description, priceCents: CentsSchema, aliases: string[] (min 1), allowedModifiers: ModifierIdSchema[], sourcePage: int|null });
export const CatalogPreviewSchema = z.strictObject({ locationId, label, description, priceCents: CentsSchema|null, sourceUrl: url|null, sourcePage: int|null, sourceSha256: string|null });
export const CatalogModifierSchema = z.strictObject({ id: ModifierIdSchema, label, priceCents: CentsSchema });
export const CatalogSchema = z.strictObject({
  versionId: MenuVersionSchema,
  snapshot: z.strictObject({ checkedAt: string, directoryUrl: url, sourceRepository: url }),
  locations: CatalogLocationSchema[], items: CatalogItemSchema[], previews: CatalogPreviewSchema[], modifiers: CatalogModifierSchema[],
}).superRefine(/* unique ids, item.locationId exists, allowedModifiers exist, activeRank unique and contiguous from 1 */);
export type Catalog = z.infer<typeof CatalogSchema>;

// ParseRequestSchema / ParseResponseSchema / ExportLogSchema / HealthResponseSchema: v: z.literal(3), menuVersion: MenuVersionSchema.
// PublicParseRequestSchema and ActiveLocationIdSchema leave contracts; see catalogGuard.
// HealthResponseSchema gains catalog: { source: "supabase"|"bundled"|"unavailable", versionId: string|null } and orderPersistence: "supabase"|"off".
// InterpretOptions gains catalog: Catalog (the client-side rules fallback needs it).
```

```ts
// src/catalog/lookup.ts (pure, client-safe)
export type CatalogIndex = {
  readonly catalog: Catalog;
  item(id: string): CatalogItem | undefined;   location(id: string): CatalogLocation | undefined;   modifier(id: ModifierId): CatalogModifier;
  itemsForLocation(locationId: string): readonly CatalogItem[];   previewsForLocation(locationId: string): readonly CatalogPreview[];
  locationName(locationId: string): string;    fullItemLabel(itemId: string): string;   // "Demo Counter" for 'demo'
  readonly activeLocations: readonly CatalogLocation[];   // by activeRank ascending
  readonly activeLocationIds: readonly string[];
  readonly itemIds: readonly string[];
};
export function indexCatalog(catalog: Catalog): CatalogIndex;   // memoised per catalog object (WeakMap)
export function catalogGuard(catalog: Catalog): { isItem(id), isActiveLocation(id), isActiveItem(id), publicParseRequestSchema };
//   publicParseRequestSchema = ParseRequestSchema.extend({ locationId: active-location enum defaulting to the first ranked location })
//   .superRefine(cart context contains only active items)  — the former PublicParseRequestSchema, now per catalog.
```

```ts
// src/catalog/bundled.ts — server and test use only; the client never imports it
export const BUNDLED_VERSION_ID = "cmu-shortlist-2026-09-12";
export function bundledCatalog(): Catalog;   // built from campus.ts + menu.ts, validated once, memoised

// src/catalog/config.server.ts
export type CatalogConfig = { catalog: Catalog | null; source: "supabase" | "bundled" | "unavailable"; versionId: string | null; unavailableReason: string | null };
export async function loadCatalogConfig(): Promise<CatalogConfig>;   // CATALOG_SOURCE=supabase|bundled, default supabase; never falls back silently
```

```ts
// src/core/engine.ts
export type EngineOptions = { catalog: Catalog; waitConfig?: WaitEngineConfig; allowedLocationIds?: readonly LocationId[] };
export function createEngine(sessionId: string, options: EngineOptions): EngineState;   // EngineState gains readonly catalog
export function totalCents(lines: readonly Line[], catalog: Catalog): number;
export function exportLog(state: EngineState): string;                         // menuVersion = state.catalog.versionId
export function replayLog(json: string, catalog: Catalog): OrderView;          // throws MENU_VERSION_MISMATCH on a different version
// src/core/waits.ts
export function deriveWaitView(lines, config, catalog): WaitView;
export function swapCandidates(lines, config, eligibleLineIds, catalog, allowedLocationIds?): Candidate[];
```

```ts
// parsers
export function parseRules(req: ParseRequest, catalog: Catalog): ParseResponse;
export function parseRulesWith(req, options, catalog): ParseResponse;
export function buildLexicon(catalog: Catalog): Lexicon;            // memoised; replaces the import-time ITEM_ALIASES / ALIAS_TOKENS / SOLE_ITEM_FOR_MODIFIER / VOCABULARY
export function parseGemini(req, config, catalog): Promise<GeminiOutcome>;
export function buildSystemInstruction(req, catalog): string;  export function buildProviderSchema(req, catalog): Record<string, unknown>;
export function interpret(req, options /* includes catalog */): Promise<ParseResponse>;
```

```ts
// controller / UI
createOrderController({ catalog, interpret?, sessionId?, locationId?, waitConfig?, allowedLocationIds?, persist? })
useOrderController(catalog, locationId, waitConfig?, allowedLocationIds?)
<CatalogProvider catalog={...}>  /  useCatalog(): CatalogIndex          // src/ui/CatalogContext.tsx
OrderApp({ catalogConfig, waitConfig })  // renders a labelled unavailable panel when catalogConfig.catalog is null
```

## Order persistence (write-behind)

Routes (all V3-validated, writer client, bodies bounded by `LIMITS.requestBytes`, transcripts never logged):
`POST /api/sessions` `{ v, sessionId, menuVersion, waitConfig?, allowedLocationIds? }` → idempotent create;
`POST /api/sessions/[id]/events` `{ v, entries: AuditEntry[] }` → entries with `seq <= stored max` are ignored as duplicates, the rest must start at `max + 1` else **409**;
`POST /api/sessions/[id]/receipt` `{ v, receipt }` → idempotent; `GET /api/sessions/[id]/export` → `ExportLog` assembled from rows (404 unknown).
The controller gets an injected `persist` port; after every accepted audit entry it enqueues a flush (one in flight, coalesced), never awaited by ordering. `OrderController.persistence = { state: "off"|"saved"|"saving"|"failed", savedSeq, retry() }`. `ORDER_PERSISTENCE=off` disables the port and labels the state.

## Known limitations (accepted 2026-09-12)

- **No request rate limiting.** The session routes are anonymous by design. A per-session cap (`MAX_SESSION_AUDIT_ENTRIES = 1000`, 413 `SESSION_LIMIT`) bounds one session's growth, but nothing bounds how many sessions a scripted client can create. Mitigation belongs at the edge (Vercel WAF or a rate limiter) before this runs beyond a demo.
- **Stored audit entries are validated for shape and sequence, not re-derived.** The server trusts the caller's `outcome` / `code`; `replayLog` recomputes them and rejects any forged history on replay, so a tampered session is detectable but is stored until then. Re-running the engine server-side per append is the hardening step if this ever matters.
- **A session id is the only handle.** It is a client-generated UUID sent only in same-origin request bodies and paths; anyone holding it can append to that session's simulated order.

## Not changed

Engine transition semantics, wait-swap semantics and thresholds, parser decision logic and grammar coverage, the shortlist and preview policy (still expressed through `allowedLocationIds` and `activeRank`), `LIMITS`, voice and speech code, visual design.

## Environment

`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS` (names as already listed in `.env.example`; Supabase's own docs use the singular `SUPABASE_SECRET_KEY`), `CATALOG_SOURCE=supabase|bundled` (default `supabase`), `ORDER_PERSISTENCE=supabase|off` (default `supabase`). Migrations under `supabase/migrations/` are applied through the Supabase MCP `apply_migration`; no local stack.
