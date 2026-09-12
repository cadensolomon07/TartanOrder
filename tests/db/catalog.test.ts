import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { CatalogLoadError, loadActiveCatalog, loadCatalogVersion, type CatalogReader } from "@/db/catalog.server";
import { seedRows } from "@/db/seed-rows";
import { CATALOG } from "../helpers/catalog";

type Tables = Record<string, Record<string, unknown>[]>;

/** Minimal PostgREST-shaped fake: from().select().eq().order()...limit() resolves to filtered rows. */
function fakeReader(tables: Tables, failing: string | null = null) {
  const calls: string[] = [];
  const reader: CatalogReader = {
    from(table) {
      calls.push(table);
      const eq = (column: string, value: string | boolean) => {
        const filtered = (tables[table] ?? []).filter((row) => row[column] === value);
        const ordered = {
          order: () => ordered,
          limit: async (count: number) => (failing === table ? { data: null, error: { message: "boom" } } : { data: filtered.slice(0, count), error: null }),
        };
        return ordered;
      };
      return { select: () => ({ eq }) };
    },
  };
  return { reader, calls };
}

function seededTables(versionId: string): Tables {
  const rows = seedRows(CATALOG);
  const rename = (row: Record<string, unknown>) => ({ ...row, version_id: versionId });
  return {
    catalog_versions: [{ id: versionId, source_snapshot: rows.version.source_snapshot, is_active: true }],
    locations: rows.locations.map(rename),
    modifiers: rows.modifiers.map(rename),
    items: rows.items.map(rename),
    menu_previews: rows.previews.map(rename),
  };
}

describe("catalog loader", () => {
  it("loads, validates, freezes and caches a version; the second load never touches the client", async () => {
    const versionId = "test-cache-2026-09-12";
    const { reader, calls } = fakeReader(seededTables(versionId));
    const first = await loadCatalogVersion(versionId, reader);
    expect(first.versionId).toBe(versionId);
    expect(first.items).toHaveLength(506);
    expect(first.locations.filter((location) => location.activeRank !== null)).toHaveLength(11);
    expect(Object.isFrozen(first)).toBe(true);
    const callsAfterFirst = calls.length;
    expect(callsAfterFirst).toBe(5);
    const second = await loadCatalogVersion(versionId, reader);
    expect(second).toBe(first);
    expect(calls.length).toBe(callsAfterFirst);
    // Row order from the database is preserved as the catalog's item order.
    expect(first.items.map((item) => item.id)).toEqual(CATALOG.items.map((item) => item.id));
  });

  it("rejects malformed rows through Zod and caches nothing", async () => {
    const versionId = "test-malformed-2026-09-12";
    const tables = seededTables(versionId);
    tables.items = tables.items.map((row, index) => index === 0 ? { ...row, price_cents: -1 } : row);
    const { reader, calls } = fakeReader(tables);
    await expect(loadCatalogVersion(versionId, reader)).rejects.toBeInstanceOf(CatalogLoadError);
    await expect(loadCatalogVersion(versionId, reader)).rejects.toThrow(/failed validation at items\.0\.priceCents/);
    expect(calls.length).toBe(10);
  });

  it("surfaces a read failure and an unknown version without leaking row contents", async () => {
    const versionId = "test-missing-2026-09-12";
    const { reader } = fakeReader(seededTables(versionId), "items");
    await expect(loadCatalogVersion(versionId, reader)).rejects.toThrow(/Could not read items: boom/);
    const empty = fakeReader({});
    await expect(loadCatalogVersion("nope-2026", empty.reader)).rejects.toThrow(/does not exist/);
  });

  it("loads exactly one active version and refuses zero or many", async () => {
    const versionId = "test-active-2026-09-12";
    const { reader } = fakeReader(seededTables(versionId));
    const catalog = await loadActiveCatalog(reader);
    expect(catalog.versionId).toBe(versionId);
    const none = fakeReader({ catalog_versions: [] });
    await expect(loadActiveCatalog(none.reader)).rejects.toThrow(/No single active catalog version/);
    const many = fakeReader({ catalog_versions: [{ id: "a-1", is_active: true }, { id: "b-1", is_active: true }] });
    await expect(loadActiveCatalog(many.reader)).rejects.toThrow(/No single active catalog version/);
  });
});
