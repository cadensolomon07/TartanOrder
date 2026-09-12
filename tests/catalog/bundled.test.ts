import { describe, expect, it } from "vitest";
import { CatalogSchema } from "@/contracts";
import { bundledCatalog, BUNDLED_VERSION_ID } from "@/catalog/bundled";
import { catalogGuard, indexCatalog } from "@/catalog/lookup";

describe("bundled catalog", () => {
  const catalog = bundledCatalog();
  const menu = indexCatalog(catalog);

  it("is the released shortlist version with the documented counts", () => {
    expect(catalog.versionId).toBe(BUNDLED_VERSION_ID);
    expect(catalog.items).toHaveLength(506);
    expect(catalog.locations).toHaveLength(46);
    expect(catalog.previews).toHaveLength(50);
    expect(catalog.modifiers).toHaveLength(7);
    expect(menu.activeLocationIds).toEqual(["110", "92", "174", "82", "188", "179", "113", "114", "155", "109", "108"]);
    expect(catalog.items.filter((item) => menu.activeLocationIds.includes(item.locationId))).toHaveLength(237);
    expect(catalog.items.filter((item) => item.locationId === "demo")).toHaveLength(11);
  });

  it("passes the shared schema, is frozen, and is built once", () => {
    expect(CatalogSchema.safeParse(catalog).success).toBe(true);
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.items[0])).toBe(true);
    expect(Object.isFrozen(catalog.items[0].aliases)).toBe(true);
    expect(bundledCatalog()).toBe(catalog);
    expect(indexCatalog(catalog)).toBe(menu);
  });

  it("indexes items, locations, labels and previews", () => {
    expect(menu.item("burger")?.priceCents).toBe(800);
    expect(menu.item("cmu_188_smash_d_burger")?.locationId).toBe("188");
    expect(menu.item("nope")).toBeUndefined();
    expect(menu.locationName("demo")).toBe("Demo Counter");
    expect(menu.locationName("188")).toBe("Stack'd Underground");
    expect(menu.locationName("zzz")).toBe("Unknown location");
    expect(menu.fullItemLabel("burger")).toBe("Burger");
    expect(menu.fullItemLabel("cmu_188_smash_d_burger")).toBe("Smash'd Burger · Stack'd Underground");
    expect(menu.itemsForLocation("demo")).toHaveLength(11);
    expect(menu.itemsForLocation("188").every((item) => item.locationId === "188")).toBe(true);
    expect(menu.previewsForLocation("113").length).toBeGreaterThan(0);
    expect(menu.modifier("double")?.priceCents).toBe(250);
  });

  it("guards public requests to the active shortlist", () => {
    const guard = catalogGuard(catalog);
    expect(guard.defaultLocationId).toBe("188");
    expect(guard.isActiveLocation("188")).toBe(true);
    expect(guard.isActiveLocation("demo")).toBe(false);
    expect(guard.isActiveItem("burger")).toBe(false);
    expect(guard.isActiveItem("cmu_188_smash_d_burger")).toBe(true);
    const base = { v: 3, requestId: "r1", baseRevision: 0, menuVersion: catalog.versionId, text: "hi", source: "text", asrConfidence: null };
    expect(guard.publicParseRequestSchema.parse(base).locationId).toBe("188");
    expect(guard.publicParseRequestSchema.safeParse({ ...base, locationId: "demo" }).success).toBe(false);
    expect(guard.publicParseRequestSchema.safeParse({ ...base, locationId: "188", context: { lines: [{ lineId: "l1", itemId: "burger", qty: 1, modifiers: [] }], lastLineId: null, pending: null, recent: [] } }).success).toBe(false);
    expect(catalogGuard(catalog)).toBe(guard);
  });
});
