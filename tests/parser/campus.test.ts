import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { API_VERSION, DEMO_ITEM_IDS, MENU_VERSION, ParseResponseSchema, type ItemId, type Line, type LocationId, type Op, type ParseRequest, type ParseResult } from "@/contracts";
import { CAMPUS_ITEMS, DINING_LOCATIONS } from "@/contracts/campus";
import { MENU, itemsForLocation, locationName } from "@/contracts/menu";
import { interpretWith } from "@/parser/client";
import { buildProviderSchema, buildSystemInstruction, parseGemini } from "@/parser/gemini.server";
import { guardCampusQuantities } from "@/parser/campus.rules";
import { parseRules } from "@/parser/rules";

// All provider calls below are mocked. This file is correctness evidence, not live Gemini evidence.
const smash = MENU.cmu_188_smash_d_burger;
const latte = MENU["cmu_115_la-prima-rohr-latte-12-oz"];
const missing = DINING_LOCATIONS.find((location) => itemsForLocation(location.id).length === 0)!;
const add = (itemId: ItemId, qty = 1): Op => ({ type: "ADD", itemId, qty, modifiers: [] });
function request(text: string, locationId: LocationId = "188", lines: Line[] = []): ParseRequest {
  return { v: API_VERSION, menuVersion: MENU_VERSION, requestId: "campus-1", baseRevision: 1, text, locationId,
    source: "text", asrConfidence: null, context: { lines, lastLineId: lines.at(-1)?.lineId ?? null, pending: null, recent: [] } };
}
const line: Line = { lineId: "coffee:0", itemId: latte.id, qty: 1, modifiers: [] };
function wireResult(result: ParseResult, req: ParseRequest): unknown {
  const ids = [...new Set([...itemsForLocation(req.locationId ?? "demo").map(item => item.id), ...(req.context?.lines.map(line => line.itemId) ?? [])])];
  return JSON.parse(JSON.stringify(result), (key, value) => key === "itemId" && ids.includes(value) ? `i${ids.indexOf(value)}` : value);
}
const provider = (result: ParseResult, req = request("a smashd burger")) => vi.fn<typeof fetch>(async () => Response.json({
  candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(wireResult(result, req)) }] } }],
}));
const callModel = (req: ParseRequest, result: ParseResult) => parseGemini(req, {
  apiKey: "mock-key", model: "gemini-2.5-flash", timeoutMs: 1000, fetchImpl: provider(result, req),
});
function itemEnums(schema: unknown): string[][] {
  if (Array.isArray(schema)) return schema.flatMap(itemEnums);
  if (typeof schema !== "object" || schema === null) return [];
  const node = schema as Record<string, unknown>;
  const properties = node.properties as Record<string, { enum?: string[] }> | undefined;
  return [...(properties?.itemId?.enum ? [properties.itemId.enum] : []), ...Object.values(node).flatMap(itemEnums)];
}

describe("campus Gemini scope (mocked transport)", () => {
  it("narrows every item enum to the selected menu plus current cart, with a demo default", () => {
    const scoped = itemEnums(buildProviderSchema(request("add a smashd burger", "188", [line])));
    const expected = [...itemsForLocation("188"), latte].map((_item, index) => `i${index}`);
    expect(scoped.length).toBeGreaterThan(1);
    scoped.forEach((ids) => expect(ids).toEqual(expected));
    itemEnums(buildProviderSchema()).forEach((ids) => expect(ids).toEqual([...DEMO_ITEM_IDS]));
    expect(JSON.stringify(buildProviderSchema(request("a burger")))).not.toContain('"burger"');
  });

  it("sends the selected location and cart-only edit context, without supplying menu prices", async () => {
    const req = request("a smashd burger", "188", [line]);
    const fetchImpl = provider({ kind: "proposal", ops: [add(smash.id)] }, req);
    await parseGemini(req, { apiKey: "mock-key", model: "gemini-2.5-flash", timeoutMs: 1000, fetchImpl });
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(JSON.parse(body.contents[0].parts[0].text).locationId).toBe("188");
    const instruction = body.systemInstruction.parts[0].text;
    expect(instruction).toContain(locationName("188"));
    expect(instruction).toContain(`i${itemsForLocation("188").length} | ${latte.label} | from ${locationName("115")}`);
    expect(JSON.parse(body.contents[0].parts[0].text).context.lines[0].itemId).toBe(`i${itemsForLocation("188").length}`);
    expect(JSON.stringify(body)).not.toContain(latte.id);
    expect(instruction).not.toContain("priceCents");
    expect(instruction).not.toContain("burger | Burger | aliases:");
    expect(instruction).toContain("NEVER pick the cheapest");
    expect(itemEnums(body.generationConfig.responseJsonSchema)[0]).toContain(`i${itemsForLocation("188").length}`);
  });

  it.each(["proposal", "clarify", "resolve"] as const)("rejects a wrong-location ADD in %s", async (kind) => {
    const req = request("add a latte", "188", [line]);
    const choice = { id: "coffee", label: "Latte", ops: [add(latte.id)] };
    req.context!.pending = { id: "pending-coffee", question: "Which drink?", choices: [choice] };
    const result: ParseResult = kind === "proposal" ? { kind, ops: choice.ops }
      : kind === "clarify" ? { kind, question: "Which drink?", choices: [choice] }
        : { kind, pendingId: "pending-coffee", choiceId: choice.id };
    await expect(callModel(req, result)).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it("allows edits to another location's existing cart row", async () => {
    const result: ParseResult = { kind: "proposal", ops: [{ type: "SET_QTY", ref: { by: "line", lineId: line.lineId }, qty: 2 }] };
    await expect(callModel(request("make the latte two", "188", [line]), result)).resolves.toMatchObject({ result });
  });

  it("does not label another venue's dish available at this venue", async () => {
    const result: ParseResult = { kind: "reject", code: "OFF_MENU", message: "Choose an item from this location.", notices: [{ kind: "unavailable", item: latte.label }] };
    await expect(callModel(request("a latte"), result)).resolves.toMatchObject({ result });
    await expect(callModel(request("a smashd burger"), { ...result, notices: [{ kind: "unavailable", item: smash.label }] }))
      .rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it("changes a mocked first-variant guess into an explicit size clarification", async () => {
    const outcome = await callModel(request("a latte", "115"), { kind: "proposal", ops: [add(latte.id)] });
    expect(outcome.result.kind).toBe("clarify");
    expect(outcome.rawText).toContain("itemId");
    expect(outcome.rawText).not.toContain(latte.id);
    expect(outcome.result).not.toHaveProperty("ops");
  });

  it("rejects an unknown provider symbol before canonical validation", async () => {
    const req = request("a smashd burger");
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ kind: "proposal", ops: [{ type: "ADD", itemId: "i999", qty: 1, modifiers: [] }] }) }] } }] }));
    await expect(parseGemini(req, { apiKey: "mock-key", model: "gemini-3.6-flash", timeoutMs: 1000, fetchImpl })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it("has no ADD branch or invented enum at a location with no verified items", async () => {
    const req = request("a burger", missing.id);
    const schema = buildProviderSchema(req);
    expect(itemEnums(schema)).toEqual([]);
    const roundTrip = z.fromJSONSchema(schema as Parameters<typeof z.fromJSONSchema>[0]);
    expect(roundTrip.safeParse({ kind: "proposal", ops: [add(smash.id)] }).success).toBe(false);
    expect(roundTrip.safeParse({ kind: "reject", code: "OFF_MENU", message: "No verified menu." }).success).toBe(true);
    expect(buildSystemInstruction(req)).toContain("NO ORDERABLE MENU DATA");
    await expect(callModel(req, { kind: "proposal", ops: [add(smash.id)] })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });
});

describe("campus local rules", () => {
  it.each(["a Smash'd Burger", "a smashd burger", "add two smashd burger"])("orders the canonical apostrophe alias: %s", (text) => {
    expect(parseRules(request(text)).result).toEqual({ kind: "proposal", ops: [add(smash.id, text.includes("two") ? 2 : 1)] });
  });

  it("orders every complete canonical campus label as one unit", () => {
    for (const item of CAMPUS_ITEMS) {
      const response = parseRules(request(item.label, item.locationId));
      expect(response.result, item.label).toEqual({ kind: "proposal", ops: [add(item.id)] });
      expect(ParseResponseSchema.safeParse(response).success).toBe(true);
    }
  });

  it("asks about ambiguous size or sauce instead of choosing a first variant", () => {
    for (const req of [request("a latte", "115"), request("chicken wings"), request("3 piece chicken tenders")]) {
      const result = parseRules(req).result;
      expect(result.kind).toBe("clarify");
      if (result.kind === "clarify") expect(result.choices.length).toBeLessThanOrEqual(3);
    }
    const exact = parseRules(request("Latte (12 oz)", "115")).result;
    expect(exact).toEqual({ kind: "proposal", ops: [add(latte.id)] });
  });

  it.each([
    "3 Piece Chicken Tenders - BBQ", "two 3 Piece Chicken Tenders - BBQ",
    "Chicken Wings (8 pieces) - BBQ", "Mozzarella Sticks (6 pieces)",
  ])("does not mistake the intrinsic name for order quantity: %s", (text) => {
    const req = request(text);
    expect(guardCampusQuantities(req)).toBeNull();
    expect(parseRules(req).result).toMatchObject({ kind: "proposal", ops: [{ type: "ADD", qty: text.startsWith("two") ? 2 : 1 }] });
  });

  it.each(["18,000 smashd burger", "18,000 3 Piece Chicken Tenders - BBQ", "6 Chicken Wings (8 pieces) - BBQ", "-3 Piece Chicken Tenders - BBQ", "zero smashd burger"])("rejects explicit excessive/negative quantity: %s", (text) => {
    expect(parseRules(request(text)).result).toMatchObject({ kind: "reject", code: "QUANTITY_LIMIT" });
  });

  it("keeps explicit quantity rejection after a mocked model attempts to clamp", async () => {
    await expect(callModel(request("18,000 smashd burger"), { kind: "proposal", ops: [add(smash.id, 5)] }))
      .resolves.toMatchObject({ result: { kind: "reject", code: "QUANTITY_LIMIT" } });
    expect(guardCampusQuantities(request("a 12 oz latte", "115"))).toBeNull();
    expect(guardCampusQuantities(request("18,000 12 oz latte", "115"))).toMatchObject({ code: "QUANTITY_LIMIT" });
  });

  it("uses current cart context for remove and quantity edits across locations, and supports undo", () => {
    expect(parseRules(request("remove latte 12 oz", "188", [line])).result).toEqual({ kind: "proposal", ops: [{ type: "REMOVE", ref: { by: "item", itemId: latte.id } }] });
    expect(parseRules(request("make latte 12 oz two", "188", [line])).result).toEqual({ kind: "proposal", ops: [{ type: "SET_QTY", ref: { by: "item", itemId: latte.id }, qty: 2 }] });
    expect(parseRules(request("make that two")).result).toEqual({ kind: "proposal", ops: [{ type: "SET_QTY", ref: { by: "last" }, qty: 2 }] });
    expect(parseRules(request("make that 18,000")).result).toMatchObject({ kind: "reject", code: "QUANTITY_LIMIT" });
    expect(parseRules(request("undo", missing.id)).result).toEqual({ kind: "proposal", ops: [{ type: "UNDO" }] });
    expect(parseRules(request("remove latte 12 oz")).result).toMatchObject({ kind: "reject", code: "UNKNOWN_REFERENCE" });
  });

  it("honestly rejects unpriced locations, cross-location additions and unsupported compound wording", () => {
    expect(parseRules(request("a burger", missing.id)).result).toMatchObject({ kind: "reject", code: "OFF_MENU" });
    expect(parseRules(request("latte 12 oz")).result.kind).toBe("reject");
    expect(parseRules(request("a smashd burger and fresh cut fries")).result.kind).toBe("reject");
    expect(parseRules(request("a smashd burger", "demo")).result.kind).not.toBe("proposal");
  });

  it("localOnly uses the campus rules without making an HTTP request", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => { throw new Error("No network permitted in this test"); });
    const result = await interpretWith(request("a smashd burger"), { localOnly: true }, { fetchImpl, timeoutMs: 1000, isOnline: () => true });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toMatchObject({ parser: "rules", fallbackReason: null, result: { kind: "proposal", ops: [add(smash.id)] } });
  });
});
