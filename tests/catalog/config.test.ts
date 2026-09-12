import { describe, expect, it, vi } from "vitest";
const createClient = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("server-only", () => ({}));
import { loadCatalogConfig, resolveCatalogSource } from "@/catalog/config.server";
import { CATALOG } from "../helpers/catalog";

describe("catalog configuration", () => {
  it("defaults to supabase and treats anything else as unavailable", () => {
    expect(resolveCatalogSource({})).toBe("supabase");
    expect(resolveCatalogSource({ CATALOG_SOURCE: " bundled " })).toBe("bundled");
    expect(resolveCatalogSource({ CATALOG_SOURCE: "unavailable" })).toBe("unavailable");
    expect(resolveCatalogSource({ CATALOG_SOURCE: "sqlite" })).toBe("unavailable");
  });

  it("serves the labelled bundled catalog without constructing a Supabase client", async () => {
    const config = await loadCatalogConfig({ CATALOG_SOURCE: "bundled" });
    expect(config.source).toBe("bundled");
    expect(config.versionId).toBe(CATALOG.versionId);
    expect(config.catalog).toBe(CATALOG);
    expect(config.unavailableReason).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("reports supabase with the loaded version", async () => {
    const config = await loadCatalogConfig({}, async () => CATALOG);
    expect(config).toEqual({ catalog: CATALOG, source: "supabase", versionId: CATALOG.versionId, unavailableReason: null });
  });

  it("never falls back: a failed database load is an explicit unavailable state with a safe reason", async () => {
    const config = await loadCatalogConfig({ CATALOG_SOURCE: "supabase" }, async () => { throw new Error("Could not read items: key sb_secret_abc123 rejected"); });
    expect(config.catalog).toBeNull();
    expect(config.source).toBe("unavailable");
    expect(config.versionId).toBeNull();
    expect(config.unavailableReason).toContain("could not be loaded");
    expect(config.unavailableReason).toContain("[key]");
    expect(config.unavailableReason).not.toContain("sb_secret_abc123");
  });

  it("labels a misconfigured source as unavailable", async () => {
    const config = await loadCatalogConfig({ CATALOG_SOURCE: "sqlite" });
    expect(config.source).toBe("unavailable");
    expect(config.unavailableReason).toMatch(/CATALOG_SOURCE/);
  });
});
