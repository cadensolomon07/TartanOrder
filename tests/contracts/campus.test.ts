import { describe, expect, it } from "vitest";
import {
  API_VERSION, AuditEventSchema, DEMO_ITEM_IDS, ItemIdSchema,
  LineSchema, LocationIdSchema, ParseRequestSchema,
} from "@/contracts";
import { CAMPUS_ITEMS, DINING_LOCATIONS } from "@/contracts/campus";
import { DEMO_MENU } from "@/contracts/menu";
import { catalogGuard } from "@/catalog/lookup";
import { CATALOG, MENU, MENU_VERSION } from "../helpers/catalog";

// Page counts of the CMU-hosted PDFs reviewed for this released snapshot.
const sourcePages: Record<string, number> = {
  "110": 2, "82": 1, "174": 2, "155": 2, "109": 8, "114": 1, "115": 3, "136": 5, "186": 2, "188": 2,
  "190": 1, "201": 8, "204": 2, "91": 4, "92": 9, "94": 2,
};
const guard = catalogGuard(CATALOG);

describe("published campus catalog contract", () => {
  it("includes all reviewed fixed-price variants, including the internal archive, in the 45-location directory", () => {
    expect(CAMPUS_ITEMS).toHaveLength(495);
    expect(DINING_LOCATIONS).toHaveLength(45);
    expect(new Set(DINING_LOCATIONS.map(location => location.id)).size).toBe(45);
    expect([...new Set(CAMPUS_ITEMS.map(item => item.locationId))].sort()).toEqual(Object.keys(sourcePages).sort());
    expect(new Set(CAMPUS_ITEMS.map(item => item.id)).size).toBe(CAMPUS_ITEMS.length);
    expect(new Set(CATALOG.items.map(item => item.id))).toEqual(new Set([...DEMO_ITEM_IDS, ...CAMPUS_ITEMS.map(item => item.id)]));
    expect(new Set(CATALOG.locations.map(location => location.id))).toEqual(new Set(["demo", ...DINING_LOCATIONS.map(location => location.id)]));
  });

  it("links every integer-cent price and accepted item ID to its reviewed CMU source page", () => {
    for (const item of CAMPUS_ITEMS) {
      const location = DINING_LOCATIONS.find(candidate => candidate.id === item.locationId)!;
      expect(location, item.id).toBeDefined();
      expect(location.menuUrl, item.id).toMatch(/^https:\/\/apps\.studentaffairs\.cmu\.edu\/dining\/dashboard_images\/Production\/menus\/\d+\/.+\.pdf$/i);
      expect(location.detailUrl).toBe(`https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/${location.id}`);
      expect(location.sourceSha256, item.id).toMatch(/^[a-f0-9]{64}$/);
      expect(Number.isInteger(item.sourcePage), item.id).toBe(true);
      expect(item.sourcePage, item.id).toBeGreaterThanOrEqual(1);
      expect(item.sourcePage, item.id).toBeLessThanOrEqual(sourcePages[item.locationId]);
      expect(Number.isSafeInteger(item.priceCents), item.id).toBe(true);
      expect(item.priceCents, item.id).toBeGreaterThan(0);
      expect(item.label.trim(), item.id).not.toBe("");
      expect(ItemIdSchema.parse(item.id)).toBe(item.id);
      expect(LineSchema.safeParse({ lineId: "source:0", itemId: item.id, qty: 1, modifiers: [] }).success, item.id).toBe(true);
      const loaded = MENU.item(item.id)!;
      expect(loaded, item.id).toMatchObject(item);
      if (MENU.location(item.locationId)?.activeRank === null) expect(loaded.allowedModifiers, item.id).toEqual([]);
      else expect(loaded.allowedModifiers.every((modifier) => modifier.startsWith("no_") && MENU.modifier(modifier)?.priceCents === 0), item.id).toBe(true);
      expect(Object.isFrozen(loaded), item.id).toBe(true);
      expect(Object.isFrozen(loaded.allowedModifiers), item.id).toBe(true);
    }
    // A well-formed id is only orderable if the loaded catalog contains it.
    expect(ItemIdSchema.safeParse("cmu_188_invented_burger").success).toBe(true);
    expect(MENU.item("cmu_188_invented_burger")).toBeUndefined();
    expect(guard.isItem("cmu_188_invented_burger")).toBe(false);
  });

  it("preserves seeded demo prices separately from the sourced campus catalog", () => {
    expect(Object.fromEntries(Object.entries(DEMO_MENU).map(([id, item]) => [id, item.priceCents]))).toEqual({
      burger: 800, chicken_sandwich: 850, veggie_wrap: 750, grilled_cheese: 650,
      fries: 300, onion_rings: 350, side_salad: 400, lemonade: 250,
      iced_tea: 250, cola: 250, water: 150,
    });
    expect(MENU.itemsForLocation("demo").map(item => item.id)).toEqual([...DEMO_ITEM_IDS]);
    expect(MENU.item("burger")!.allowedModifiers).toContain("double");
    expect(MENU.item("cmu_188_smash_d_burger")!.priceCents).toBe(920);
    expect(MENU.item("cmu_188_fresh_cut_fries")!.priceCents).toBe(345);
    // Capital Grains lists starting prices, so its directory entry must not invent an orderable total.
    expect(LocationIdSchema.parse("179")).toBe("179");
    expect(MENU.location("179")).toBeDefined();
    expect(MENU.itemsForLocation("179")).toEqual([]);
  });

  it("distinguishes the same named food and its price at different counters", () => {
    const india = MENU.item("cmu_114_bottled-water")!;
    const exchange = MENU.item("cmu_92_bottled-water")!;
    expect(india.label).toBe(exchange.label);
    expect(india.id).not.toBe(exchange.id);
    expect(india.locationId).toBe("114");
    expect(exchange.locationId).toBe("92");
    expect(india.priceCents).toBe(195);
    expect(exchange.priceCents).toBe(235);
    expect(MENU.fullItemLabel(india.id)).not.toBe(MENU.fullItemLabel(exchange.id));
    expect(MENU.itemsForLocation("114")).toContain(india);
    expect(MENU.itemsForLocation("114")).not.toContain(exchange);
  });

  it("accepts well-formed location IDs, decides membership against the catalog, and records explicit continuation discard", () => {
    const request = {
      v: API_VERSION, menuVersion: MENU_VERSION, requestId: "campus-contract",
      baseRevision: 0, text: "A burger", source: "fixture", asrConfidence: null,
    };
    expect(ParseRequestSchema.parse(request)).not.toHaveProperty("locationId");
    for (const locationId of CATALOG.locations.map(location => location.id)) {
      expect(ParseRequestSchema.parse({ ...request, locationId }).locationId).toBe(locationId);
      expect(guard.isLocation(locationId)).toBe(true);
    }
    expect(ParseRequestSchema.safeParse({ ...request, locationId: "unknown-counter" }).success).toBe(false);
    expect(ParseRequestSchema.safeParse({ ...request, locationId: "999" }).success).toBe(true);
    expect(guard.isLocation("999")).toBe(false);
    expect(ParseRequestSchema.safeParse({ ...request, locationId: 188 }).success).toBe(false);
    expect(ParseRequestSchema.safeParse({ ...request, locationId: "188", prices: {} }).success).toBe(false);
    expect(AuditEventSchema.parse({ type: "INPUT_STARTED", discardContinuation: true })).toEqual({ type: "INPUT_STARTED", discardContinuation: true });
    expect(AuditEventSchema.safeParse({ type: "INPUT_STARTED", discardContinuation: true, locationId: "188" }).success).toBe(false);
  });
});
