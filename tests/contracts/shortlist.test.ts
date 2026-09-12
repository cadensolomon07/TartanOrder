import { describe, expect, it } from "vitest";
import { ACTIVE_LOCATION_IDS, ACTIVE_DINING_LOCATIONS, ACTIVE_CAMPUS_ITEMS, UNPRICED_MENU_ITEMS } from "@/contracts/campus";
import { PUBLIC_FIXTURE_REQUEST } from "@/contracts/fixtures";
import { catalogGuard } from "@/catalog/lookup";
import { createOrderController } from "@/controller/controller";
import { replayLog } from "@/core/engine";
import { CATALOG, MENU, MENU_VERSION } from "../helpers/catalog";

const guard = catalogGuard(CATALOG);
const PublicParseRequestSchema = guard.publicParseRequestSchema;

describe("the requested public shortlist", () => {
  it("contains exactly the requested ten venues plus Schatz, in order, and 237 sourced configurations", () => {
    expect(ACTIVE_LOCATION_IDS).toEqual(["110", "92", "174", "82", "188", "179", "113", "114", "155", "109", "108"]);
    expect(ACTIVE_DINING_LOCATIONS.map(location => location.id)).toEqual(ACTIVE_LOCATION_IDS);
    expect(ACTIVE_CAMPUS_ITEMS).toHaveLength(237);
    expect([...new Set(ACTIVE_CAMPUS_ITEMS.map(item => item.locationId))].sort()).toEqual(["109", "110", "114", "155", "174", "188", "82", "92"]);
    expect(ACTIVE_CAMPUS_ITEMS.every(item => item.priceCents > 0 && Number.isSafeInteger(item.priceCents))).toBe(true);
    expect(UNPRICED_MENU_ITEMS).toHaveLength(50);
    expect(UNPRICED_MENU_ITEMS.every(item => !('id' in item) && !('ops' in item))).toBe(true);
    expect(MENU_VERSION).toBe("cmu-meal-2026-09-12");
    // The loaded catalog carries the same shortlist as ranked locations and the previews.
    expect(CATALOG.versionId).toBe(MENU_VERSION);
    expect(MENU.activeLocationIds).toEqual([...ACTIVE_LOCATION_IDS]);
    expect(MENU.activeLocations.map(location => location.activeRank)).toEqual(ACTIVE_LOCATION_IDS.map((_, index) => index + 1));
    // The fictional Demo Counter is public for the meal demonstration but never ranked.
    expect(MENU.publicLocationIds).toEqual([...ACTIVE_LOCATION_IDS, "demo"]);
    expect(CATALOG.items.filter(item => guard.isActiveItem(item.id))).toHaveLength(237);
    expect(CATALOG.items.filter(item => guard.isPublicItem(item.id))).toHaveLength(248);
    expect(CATALOG.previews).toHaveLength(50);
  });

  it("keeps published campus prices instead of pasted off-campus proxies", () => {
    expect(MENU.item("cmu_188_smash_d_burger")!.priceCents).toBe(920);
    expect(MENU.item("cmu_110_white_rice")!.priceCents).toBe(300);
    expect(MENU.item("cmu_82_falafel_pita")!.priceCents).toBe(995);
    expect(MENU.item("cmu_174_steamed-pork-bao-bun")!.priceCents).toBe(419);
  });

  it("rejects archived HTTP selections and cart context, regardless of fixture source", () => {
    for (const locationId of ["115", "94", "190", "84", "180", "91"]) {
      expect(PublicParseRequestSchema.safeParse({ ...PUBLIC_FIXTURE_REQUEST, locationId }).success).toBe(false);
    }
    expect(PublicParseRequestSchema.safeParse({ ...PUBLIC_FIXTURE_REQUEST, locationId: "demo" }).success).toBe(true);
    expect(guard.isPublicLocation("demo")).toBe(true);
    expect(guard.isActiveLocation("demo")).toBe(false);
    expect(PublicParseRequestSchema.parse({ ...PUBLIC_FIXTURE_REQUEST, locationId: undefined }).locationId).toBe(guard.defaultLocationId);
    expect(guard.defaultLocationId).toBe("188");
    expect(guard.isActiveLocation(guard.defaultLocationId)).toBe(true);
    expect(PublicParseRequestSchema.safeParse({ ...PUBLIC_FIXTURE_REQUEST, context: {
      lines: [{ lineId: "retired:0", itemId: "cmu_190_vanilla_milkshake", qty: 1, modifiers: [] }],
      lastLineId: "retired:0", pending: null, recent: [],
    } }).success).toBe(false);
  });

  it("enforces the same recorded policy for public controller selections, edits and reset", () => {
    expect(() => createOrderController({ catalog: CATALOG, locationId: "demo", allowedLocationIds: ACTIVE_LOCATION_IDS })).toThrow();
    const store = createOrderController({ catalog: CATALOG, locationId: "188", allowedLocationIds: ACTIVE_LOCATION_IDS });
    store.getSnapshot().act({ type: "MANUAL", ops: [{ type: "ADD", itemId: "cmu_188_smash_d_burger", qty: 1, modifiers: [] }] });
    store.getSnapshot().act({ type: "REVIEW" });
    store.getSnapshot().setLocation("190");
    expect(store.getSnapshot().locationId).toBe("188");
    expect(store.getSnapshot().state.review).toBeNull();
    store.getSnapshot().act({ type: "MANUAL", ops: [{ type: "ADD", itemId: "cmu_190_vanilla_milkshake", qty: 1, modifiers: [] }] });
    expect(store.getSnapshot().state.totalCents).toBe(920);
    expect(replayLog(store.getSnapshot().exportLog(), CATALOG)).toEqual(store.getSnapshot().state);
    store.getSnapshot().reset();
    store.getSnapshot().act({ type: "MANUAL", ops: [{ type: "ADD", itemId: "burger", qty: 1, modifiers: [] }] });
    expect(store.getSnapshot().state.lines).toEqual([]);
    expect(JSON.parse(store.getSnapshot().exportLog()).allowedLocationIds).toEqual(ACTIVE_LOCATION_IDS);
    store.dispose();
  });
});
