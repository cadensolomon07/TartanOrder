import { describe, expect, it, vi } from "vitest";
import { LIMITS, MENU_VERSION, type Line, type ParseRequest, type ParseResult } from "@/contracts";
import { itemsForLocation } from "@/contracts/menu";
import { parseRules } from "@/parser/rules";
import { buildSystemInstruction, parseGemini } from "@/parser/gemini.server";

const request = (text: string, lines: Line[] = [], locationId: ParseRequest["locationId"] = "demo"): ParseRequest => ({
  v: 2, menuVersion: MENU_VERSION, requestId: "note-request", baseRevision: 1,
  text, source: "text", asrConfidence: null, locationId,
  context: { lines, lastLineId: lines.at(-1)?.lineId ?? null, pending: null, recent: [] },
});
const line = (itemId: Line["itemId"], note?: string, lineId = "cart:1"): Line => ({ lineId, itemId, qty: 1, modifiers: [], ...(note ? { note } : {}) });
const add = (itemId: Line["itemId"], note?: string) => ({ type: "ADD", itemId, qty: 1, modifiers: [], ...(note ? { note } : {}) });
const rules = (text: string, lines: Line[] = []) => parseRules(request(text, lines)).result;
const model = async (req: ParseRequest, result: unknown) => {
  const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(result) }] } }] }), { status: 200 }));
  const outcome = await parseGemini(req, { apiKey: "synthetic-test-key", model: "gemini-3.6-flash", timeoutMs: 1000, fetchImpl });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  return outcome.result;
};

describe("offline special requests", () => {
  it.each([
    ["water with extra ice", "water", "extra ice"],
    ["fries with extra salt", "fries", "extra salt"],
    ["burger, note: cut in half", "burger", "cut in half"],
    ["fries with a note: sauce on side", "fries", "sauce on side"],
    ["fries, note: extra sauce if available", "fries", "extra sauce if available"],
  ] as const)("keeps a reasonable request as plain text: %s", (text, itemId, note) => {
    expect(rules(text)).toEqual({ kind: "proposal", ops: [add(itemId, note)] });
  });

  it("retains independent items and attaches a final with-clause to its item", () => {
    expect(rules("a burger and fries with extra salt")).toEqual({ kind: "proposal", ops: [add("burger"), add("fries", "extra salt")] });
  });

  it("uses the real priced option and retains the separate preparation request", () => {
    expect(rules("burger, note: extra cheese; cut in half")).toEqual({ kind: "proposal", ops: [{ ...add("burger", "cut in half"), modifiers: ["extra_cheese"] }] });
    expect(rules("add note to my burger: double", [line("burger", "cut in half")])).toEqual({ kind: "proposal", ops: [{ type: "MOD", ref: { by: "line", lineId: "cart:1" }, modifier: "double", enabled: true }] });
    expect(rules("water, note: double")).toMatchObject({ kind: "reject", code: "INVALID_MODIFIER" });
  });

  it("appends, explicitly removes one clause, and clears without losing unrelated clauses", () => {
    const existing = line("water", "use a cup; extra ice");
    expect(rules("add note to my water: lid on side", [existing])).toEqual({ kind: "proposal", ops: [{ type: "SET_NOTE", ref: { by: "line", lineId: "cart:1" }, note: "use a cup; extra ice; lid on side" }] });
    expect(rules("remove extra ice from my water", [existing])).toEqual({ kind: "proposal", ops: [{ type: "SET_NOTE", ref: { by: "line", lineId: "cart:1" }, note: "use a cup" }] });
    expect(rules("clear the note on my water", [existing])).toEqual({ kind: "proposal", ops: [{ type: "SET_NOTE", ref: { by: "line", lineId: "cart:1" }, note: "" }] });
  });

  it("does not replace an existing note merely because quantity or a menu modifier changes", () => {
    const existing = line("burger", "cut in half");
    expect(rules("make the burger a double", [existing])).toEqual({ kind: "proposal", ops: [{ type: "MOD", ref: { by: "item", itemId: "burger" }, modifier: "double", enabled: true }] });
    expect(rules("make it two", [existing])).toEqual({ kind: "proposal", ops: [{ type: "SET_QTY", ref: { by: "last" }, qty: 2 }] });
  });

  it("asks for an exact repeated row and preserves each candidate's own note", () => {
    const result = rules("put extra salt on my fries", [line("fries", "sauce on side", "cart:1"), line("fries", "serve in a cup", "cart:2")]);
    expect(result).toMatchObject({ kind: "clarify" });
    if (result.kind !== "clarify") throw new Error("Expected a targeted clarification");
    expect(result.choices.map(choice => choice.ops)).toEqual([
      [{ type: "SET_NOTE", ref: { by: "line", lineId: "cart:1" }, note: "sauce on side; extra salt" }],
      [{ type: "SET_NOTE", ref: { by: "line", lineId: "cart:2" }, note: "serve in a cup; extra salt" }],
    ]);
    expect(rules("put extra salt on my fries")).toMatchObject({ kind: "reject", code: "UNKNOWN_REFERENCE" });
    expect(rules("put extra salt on my fries", [1, 2, 3, 4].map(id => line("fries", undefined, `cart:${id}`)))).toMatchObject({ kind: "reject", code: "AMBIGUOUS_REFERENCE" });
  });

  it("preserves quantity, unavailable-item and note-length guards without partial success", () => {
    expect(rules("18,000 waters with extra ice")).toMatchObject({ kind: "reject", code: "QUANTITY_LIMIT" });
    expect(rules("pizza with extra salt")).toMatchObject({ kind: "reject" });
    expect(rules(`burger, note: ${"x".repeat(LIMITS.noteChars)}`)).toEqual({ kind: "proposal", ops: [add("burger", "x".repeat(LIMITS.noteChars))] });
    expect(rules(`burger, note: ${"x".repeat(LIMITS.noteChars + 1)}`)).toMatchObject({ kind: "reject" });
    expect(rules("add note to my fries: extra salt", [line("fries", "x".repeat(155))])).toMatchObject({ kind: "reject" });
  });

  it("does not hide a dietary declaration or turn a conditional request into an order", () => {
    expect(rules("burger, note: I have a sesame allergy")).toMatchObject({ kind: "reject" });
    expect(rules("burger with a note: cut in half only if guaranteed")).toMatchObject({ kind: "clarify", choices: [] });
  });

  it("uses the selected campus catalog and keeps its quantity guard", () => {
    const item = itemsForLocation("188").find(item => item.label === "Fresh Cut Fries")!;
    expect(parseRules(request(`${item.label} with extra salt`, [], "188")).result).toEqual({ kind: "proposal", ops: [add(item.id, "extra salt")] });
    expect(parseRules(request(`18,000 ${item.label} with extra salt`, [], "188")).result).toMatchObject({ kind: "reject", code: "QUANTITY_LIMIT" });
  });
});

describe("Gemini special requests with injected provider responses", () => {
  it.each(["extra ice", "extra salt", "cut in half", "sauce on side", "extra sauce", "extra ice if available"])("accepts unverified natural staff text: %s", async note => {
    const result = { kind: "proposal", ops: [add("water", note)] };
    expect(await model(request(`I would like water, special request: ${note}`), result)).toEqual(result);
  });

  it.each([
    ["Actually, ice on the side instead", "ice on the side; use a cup"],
    ["Remove my extra ice request", "use a cup"],
    ["Forget the water's special requests", ""],
  ])("lets Gemini interpret a natural note edit without imposing offline grammar: %s", async (text, note) => {
    const result = { kind: "proposal", ops: [{ type: "SET_NOTE", ref: { by: "line", lineId: "cart:1" }, note }] };
    expect(await model(request(text, [line("water", "extra ice; use a cup")]), result)).toEqual(result);
  });

  it("keeps unavailable food notices alongside legitimate new notes", async () => {
    const result = { kind: "proposal", ops: [add("fries", "extra salt")], notices: [{ kind: "unavailable", item: "pizza" }] };
    expect(await model(request("fries with extra salt and a pizza"), result)).toEqual(result);
  });

  it("preserves quantity guards even if the model turns an excessive order into a note", async () => {
    expect(await model(request("18,000 waters with extra ice"), { kind: "proposal", ops: [add("water", "extra ice")] })).toMatchObject({ kind: "reject", code: "QUANTITY_LIMIT" });
  });

  it("does not accept a listed priced modifier as a free-text substitute", async () => {
    await expect(model(request("burger with extra cheese"), { kind: "proposal", ops: [add("burger", "extra cheese")] })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
    const result = { kind: "proposal", ops: [{ ...add("burger", "cut in half"), modifiers: ["extra_cheese"] }] };
    expect(await model(request("burger with extra cheese and cut it in half"), result)).toEqual(result);
  });

  it("keeps strict bounds, reference validation and existing dietary-declaration guard", async () => {
    await expect(model(request("water with a request"), { kind: "proposal", ops: [add("water", "x".repeat(161))] })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
    await expect(model(request("extra ice please"), { kind: "proposal", ops: [{ type: "SET_NOTE", ref: { by: "line", lineId: "unknown" }, note: "extra ice" }] })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
    await expect(model(request("I have a sesame allergy; a burger please"), { kind: "proposal", ops: [add("burger", "sesame allergy")] })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
    await expect(model(request("water please"), { kind: "proposal", ops: [{ ...add("water", "extra ice"), priceCents: 0 }] })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it("carries a note into ambiguous existing-line choices instead of selecting the model's guessed row", async () => {
    const req = request("put extra salt on my fries", [line("fries", "sauce on side", "cart:1"), line("fries", "serve in a cup", "cart:2")]);
    const result = await model(req, { kind: "proposal", ops: [{ type: "SET_NOTE", ref: { by: "line", lineId: "cart:1" }, note: "sauce on side; extra salt" }] });
    expect(result).toMatchObject({ kind: "clarify" });
    if (result.kind !== "clarify") throw new Error("Expected a targeted clarification");
    expect(result.choices.map(choice => choice.ops)).toEqual((parseRules(req).result as Extract<ParseResult, { kind: "clarify" }>).choices.map(choice => choice.ops));
  });

  it("documents unverified fulfillment and note preservation without a request whitelist", () => {
    const prompt = buildSystemInstruction();
    expect(prompt).toContain("reasonable staff requests are free-text notes");
    expect(prompt).toContain("preserve every unrelated existing clause");
    expect(prompt).toContain("possible counter charges");
    expect(prompt).toContain("notes cannot waive restrictions");
  });
});
