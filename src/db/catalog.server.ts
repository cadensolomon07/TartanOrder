// Server-only catalog loader. Reads the five catalog tables through the
// publishable-key reader (RLS applies), validates every row through the shared
// Catalog schema, freezes the result and caches it by version id: released
// versions are immutable, so one fetch per version per process is enough.
import "server-only";
import { CatalogSchema, type Catalog } from "@/contracts";
import { freezeCatalog } from "@/catalog/lookup";
import { readerClient } from "./client.server";

const MAX_ROWS = 10000;
const versions = new Map<string, Catalog>();

export class CatalogLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogLoadError";
  }
}

type Row = Record<string, unknown>;
type Query = PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
type Ordered = { order(column: string, options?: { ascending?: boolean }): Ordered; limit(count: number): Query };
/** The structural subset of a Supabase client the loader needs; tests supply a fake. */
export type CatalogReader = {
  from(table: string): { select(columns: string): { eq(column: string, value: string | boolean): Ordered } };
};

async function rows(query: Query, table: string): Promise<Row[]> {
  const { data, error } = await query;
  if (error) throw new CatalogLoadError(`Could not read ${table}: ${error.message}`);
  return data ?? [];
}

const nullable = (value: unknown): unknown => (value === undefined ? null : value);

function toCatalog(versionId: string, version: Row, locations: Row[], modifiers: Row[], items: Row[], previews: Row[]): Catalog {
  const parsed = CatalogSchema.safeParse({
    versionId,
    snapshot: version.source_snapshot,
    locations: locations.map((row) => ({
      id: row.id, name: row.name, location: row.location, menuUrl: nullable(row.menu_url), directoryMenuUrl: nullable(row.directory_menu_url),
      detailUrl: nullable(row.detail_url), sourceSha256: nullable(row.source_sha256), sourceNote: nullable(row.source_note), activeRank: nullable(row.active_rank),
    })),
    items: items.map((row) => ({
      id: row.id, locationId: row.location_id, label: row.label, category: row.category, description: row.description, priceCents: row.price_cents,
      aliases: row.aliases, allowedModifiers: row.allowed_modifiers, sourcePage: nullable(row.source_page),
    })),
    previews: previews.map((row) => ({
      locationId: row.location_id, label: row.label, description: row.description, priceCents: nullable(row.price_cents),
      sourceUrl: nullable(row.source_url), sourcePage: nullable(row.source_page), sourceSha256: nullable(row.source_sha256),
    })),
    modifiers: modifiers.map((row) => ({ id: row.id, label: row.label, priceCents: row.price_cents })),
  });
  if (!parsed.success) {
    // Issue paths only: never row contents.
    const paths = parsed.error.issues.slice(0, 3).map((issue) => issue.path.map(String).join(".") || "$").join(", ");
    throw new CatalogLoadError(`Catalog version ${versionId} failed validation at ${paths}.`);
  }
  return freezeCatalog(parsed.data);
}

function defaultReader(): CatalogReader {
  return readerClient() as unknown as CatalogReader;
}

/** Fetches one released version; the result is cached for the life of the process. */
export async function loadCatalogVersion(versionId: string, reader: CatalogReader = defaultReader()): Promise<Catalog> {
  const cached = versions.get(versionId);
  if (cached) return cached;
  const [version, locations, modifiers, items, previews] = await Promise.all([
    rows(reader.from("catalog_versions").select("id, source_snapshot").eq("id", versionId).limit(1), "catalog_versions"),
    rows(reader.from("locations").select("*").eq("version_id", versionId).order("id").limit(MAX_ROWS), "locations"),
    rows(reader.from("modifiers").select("*").eq("version_id", versionId).order("id").limit(MAX_ROWS), "modifiers"),
    rows(reader.from("items").select("*").eq("version_id", versionId).order("ordinal").limit(MAX_ROWS), "items"),
    rows(reader.from("menu_previews").select("*").eq("version_id", versionId).order("location_id").order("ordinal").limit(MAX_ROWS), "menu_previews"),
  ]);
  if (version.length !== 1) throw new CatalogLoadError(`Catalog version ${versionId} does not exist.`);
  const catalog = toCatalog(versionId, version[0], locations, modifiers, items, previews);
  versions.set(versionId, catalog);
  return catalog;
}

/** The single active version, or a CatalogLoadError; never a bundled substitute. */
export async function loadActiveCatalog(reader: CatalogReader = defaultReader()): Promise<Catalog> {
  const active = await rows(reader.from("catalog_versions").select("id").eq("is_active", true).limit(2), "catalog_versions");
  if (active.length !== 1 || typeof active[0].id !== "string") throw new CatalogLoadError("No single active catalog version is published.");
  return loadCatalogVersion(active[0].id, reader);
}
