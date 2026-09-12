import { describe, expect, it } from "vitest";
import { CatalogSchema } from "@/contracts";
import { bundledCatalog, BUNDLED_VERSION_ID } from "@/catalog/bundled";
import { catalogGuard, indexCatalog } from "@/catalog/lookup";

describe("bundled catalog", () => {
  const catalog = bundledCatalog();
  const menu = indexCatalog(catalog);

  it("is the released shortlist version with the documented counts", () => {
    expect(catalog.versionId).toBe(BUNDLED_VERSION_ID);
    expect(BUNDLED_VERSION_ID).toBe("cmu-dietary-2026-09-12");
    expect(catalog.items).toHaveLength(506);
    expect(catalog.locations).toHaveLength(46);
    expect(catalog.previews).toHaveLength(50);
    expect(catalog.modifiers.length).toBeGreaterThan(7);
    expect(catalog.modifiers.slice(0, 7).map((modifier) => modifier.id)).toEqual(["no_onions", "double", "extra_cheese", "no_lettuce", "no_mayo", "dressing_on_side", "no_ice"]);
    // Venues without a single complete price were removed from the public shortlist; their rows stay archived.
    expect(menu.activeLocationIds).toEqual(["110", "92", "174", "82", "188", "114", "155", "109"]);
    for (const archived of ["179", "113", "108"]) expect(menu.location(archived)?.activeRank).toBeNull();
    expect(menu.publicLocationIds).toEqual([...menu.activeLocationIds, "demo"]);
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

  it("carries food evidence and generated removal modifiers as catalog data", () => {
    const ids = new Set(catalog.modifiers.map((modifier) => modifier.id));
    expect(catalog.items.every((item) => item.allowedModifiers.every((modifier) => ids.has(modifier)))).toBe(true);
    expect(catalog.items.filter((item) => item.locationId === "demo").every((item) => item.foodEvidence.provenance.kind === "fictional_demo")).toBe(true);
    const campus = catalog.items.filter((item) => item.locationId !== "demo");
    expect(campus.every((item) => ["inferred_campus", "unverified_campus"].includes(item.foodEvidence.provenance.kind))).toBe(true);
    expect(campus.filter((item) => item.foodEvidence.provenance.kind === "inferred_campus").length).toBeGreaterThan(150);
    expect(campus.every((item) => item.foodEvidence.completeness !== "complete")).toBe(true);
    const generated = catalog.modifiers.slice(7);
    expect(generated.every((modifier) => modifier.id.startsWith("no_") && modifier.priceCents === 0 && modifier.effect?.remove.length === 1 && modifier.effect.add.length === 0)).toBe(true);
    expect(generated.map((modifier) => modifier.id)).toEqual([...generated.map((modifier) => modifier.id)].sort());
    const bacon = catalog.items.find((item) => item.label === "Smash'd Bacon Burger")!;
    expect(bacon.allowedModifiers).toEqual(["no_bacon"]);
    expect(bacon.foodEvidence.ingredients.map((ingredient) => ingredient.id)).toEqual(["beef", "bacon"]);
    expect(menu.modifier("no_bacon")).toEqual({ id: "no_bacon", label: "No bacon", priceCents: 0, effect: { remove: ["bacon"], add: [] } });
    expect(menu.modifier("no_onions")?.effect).toEqual({ remove: ["onions"], add: [] });
    // Archived venues get no removals and the demo modifiers keep their fictional effects.
    expect(catalog.items.filter((item) => item.locationId === "136").every((item) => item.allowedModifiers.length === 0)).toBe(true);
    expect(menu.modifier("extra_cheese")?.effect?.add[0]?.id).toBe("cheese");
  });

  it("guards public requests to the active shortlist", () => {
    const guard = catalogGuard(catalog);
    expect(guard.defaultLocationId).toBe("188");
    expect(guard.isActiveLocation("188")).toBe(true);
    expect(guard.isActiveLocation("demo")).toBe(false);
    expect(guard.isActiveItem("burger")).toBe(false);
    expect(guard.isPublicLocation("demo")).toBe(true);
    expect(guard.isPublicItem("burger")).toBe(true);
    expect(guard.isPublicItem("cmu_190_vanilla_milkshake")).toBe(false);
    expect(guard.isActiveItem("cmu_188_smash_d_burger")).toBe(true);
    const base = { v: 3, requestId: "r1", baseRevision: 0, menuVersion: catalog.versionId, text: "hi", source: "text", asrConfidence: null };
    expect(guard.publicParseRequestSchema.parse(base).locationId).toBe("188");
    expect(guard.publicParseRequestSchema.safeParse({ ...base, locationId: "demo" }).success).toBe(true);
    expect(guard.publicParseRequestSchema.safeParse({ ...base, locationId: "190" }).success).toBe(false);
    expect(guard.publicParseRequestSchema.safeParse({ ...base, locationId: "188", context: { lines: [{ lineId: "l1", itemId: "cmu_190_vanilla_milkshake", qty: 1, modifiers: [] }], lastLineId: null, pending: null, recent: [] } }).success).toBe(false);
    expect(guard.publicParseRequestSchema.safeParse({ ...base, locationId: "188", context: { lines: [{ lineId: "l1", itemId: "burger", qty: 1, modifiers: [] }], lastLineId: null, pending: null, recent: [] } }).success).toBe(true);
    expect(guard.publicParseRequestSchema.safeParse({ ...base, locationId: "demo", context: { lines: [], lastLineId: null, pending: null, recent: [], requirements: { locationId: "190", meal: null, profile: { preference: "none", allergies: [], dislikes: [], exceptions: [] }, decision: null, checks: [], message: null, remainingCents: null, solver: null } } }).success).toBe(false);
    expect(catalogGuard(catalog)).toBe(guard);
  });
});
