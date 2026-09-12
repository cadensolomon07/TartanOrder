import { describe, expect, it } from "vitest";
import { MENU_VERSION, PublicParseRequestSchema } from "@/contracts";
import { ACTIVE_LOCATION_IDS, ACTIVE_DINING_LOCATIONS, ACTIVE_CAMPUS_ITEMS, UNPRICED_MENU_ITEMS } from "@/contracts/campus";
import { PUBLIC_FIXTURE_REQUEST } from "@/contracts/fixtures";
import { MENU } from "@/contracts/menu";
import { createOrderController } from "@/controller/controller";
import { replayLog } from "@/core/engine";

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
  });

  it("keeps published campus prices instead of pasted off-campus proxies", () => {
    expect(MENU.cmu_188_smash_d_burger.priceCents).toBe(920);
    expect(MENU.cmu_110_white_rice.priceCents).toBe(300);
    expect(MENU.cmu_82_falafel_pita.priceCents).toBe(995);
    expect(MENU["cmu_174_steamed-pork-bao-bun"].priceCents).toBe(419);
  });

  it("rejects archived HTTP selections and cart context, regardless of fixture source", () => {
    for (const locationId of ["115", "94", "190", "84", "180", "91"]) {
      expect(PublicParseRequestSchema.safeParse({ ...PUBLIC_FIXTURE_REQUEST, locationId }).success).toBe(false);
    }
    expect(PublicParseRequestSchema.safeParse({ ...PUBLIC_FIXTURE_REQUEST, locationId: "demo" }).success).toBe(true);
    expect(PublicParseRequestSchema.parse({ ...PUBLIC_FIXTURE_REQUEST, locationId: undefined }).locationId).toBe("188");
    expect(PublicParseRequestSchema.safeParse({ ...PUBLIC_FIXTURE_REQUEST, context: {
      lines: [{ lineId: "retired:0", itemId: "cmu_190_vanilla_milkshake", qty: 1, modifiers: [] }],
      lastLineId: "retired:0", pending: null, recent: [],
    } }).success).toBe(false);
  });

  it("enforces the same recorded policy for public controller selections, edits and reset", () => {
    expect(() => createOrderController({ locationId: "demo", allowedLocationIds: ACTIVE_LOCATION_IDS })).toThrow();
    const store = createOrderController({ locationId: "188", allowedLocationIds: ACTIVE_LOCATION_IDS });
    store.getSnapshot().act({ type: "MANUAL", ops: [{ type: "ADD", itemId: "cmu_188_smash_d_burger", qty: 1, modifiers: [] }] });
    store.getSnapshot().act({ type: "REVIEW" });
    store.getSnapshot().setLocation("190");
    expect(store.getSnapshot().locationId).toBe("188");
    expect(store.getSnapshot().state.review).toBeNull();
    store.getSnapshot().act({ type: "MANUAL", ops: [{ type: "ADD", itemId: "cmu_190_vanilla_milkshake", qty: 1, modifiers: [] }] });
    expect(store.getSnapshot().state.totalCents).toBe(920);
    expect(replayLog(store.getSnapshot().exportLog())).toEqual(store.getSnapshot().state);
    store.getSnapshot().reset();
    store.getSnapshot().act({ type: "MANUAL", ops: [{ type: "ADD", itemId: "burger", qty: 1, modifiers: [] }] });
    expect(store.getSnapshot().state.lines).toEqual([]);
    expect(JSON.parse(store.getSnapshot().exportLog()).allowedLocationIds).toEqual(ACTIVE_LOCATION_IDS);
    store.dispose();
  });
});
