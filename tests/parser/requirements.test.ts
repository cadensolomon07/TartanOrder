import { describe, expect, it, vi } from "vitest";
import { API_VERSION, MENU_VERSION, type ParseRequest, type ParseResult, type RequirementsState } from "@/contracts";
import { itemsForLocation } from "@/contracts/menu";
import { buildProviderSchema, buildSystemInstruction, parseGemini } from "@/parser/gemini.server";
import { parseRules } from "@/parser/rules";

function requirements(overrides: Partial<RequirementsState> = {}): RequirementsState {
  return {
    locationId: "demo", meal: null,
    profile: { preference: "none", allergies: [], dislikes: [], exceptions: [] },
    decision: null, checks: [], message: null, remainingCents: null, solver: null,
    ...overrides,
  };
}
function request(text: string, context?: RequirementsState, locationId: ParseRequest["locationId"] = "demo"): ParseRequest {
  return { v: API_VERSION, menuVersion: MENU_VERSION, requestId: "requirements-case", baseRevision: 3,
    text, source: "text", asrConfidence: null, locationId,
    context: { lines: [], lastLineId: null, pending: null, recent: [], ...(context ? { requirements: context } : {}) },
  };
}
function mocked(result: unknown) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(result) }] } }] }), { status: 200 }));
}
async function parse(req: ParseRequest, result: unknown) {
  const fetchImpl = mocked(result);
  const outcome = await parseGemini(req, { apiKey: "fixture-key", model: "gemini-3.6-flash", timeoutMs: 1000, fetchImpl });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  return { outcome, fetchImpl };
}
const proposal: ParseResult = { kind: "proposal", ops: [{ type: "ADD", itemId: "grilled_cheese", qty: 1, modifiers: [] }] };
const exactMeal: ParseResult = { kind: "requirements", locationId: "demo", changes: [
  { type: "SET_BUDGET", budgetCents: 1200 },
  { type: "SET_COMPONENTS", components: ["mains", "sides", "drinks"] },
  { type: "SELECT_ITEM", itemId: "fries", modifiers: [], locked: true },
  { type: "SELECT_ITEM", itemId: "lemonade", modifiers: [], locked: true },
] };
const acceptedMeal = requirements({ meal: { locationId: "demo", budgetCents: 1200, components: ["mains", "sides", "drinks"], selections: [{ component: "sides", itemId: "fries", modifiers: [] }, { component: "drinks", itemId: "lemonade", modifiers: [] }], lockedItemIds: ["fries", "lemonade"] } });

describe("Gemini requirements transport and strict interpretation (provider MOCKED)", () => {
  it.each([
    "I have twelve dollars. Get me a main, a side, and a drink. Keep the fries and lemonade.",
    "Build a main, side and drink with a $12 menu budget; the fries and lemonade need to stay.",
    "My budget is $12, and I want a main, side and drink; keep fries and lemonade.",
    "I have a twelve-dollar budget, with fries and lemonade locked.",
    "Twelve dollars is my limit for the meal. Don't swap out my fries or lemon drink.",
  ])("admits money as a budget, without treating twelve as quantity: %s", async text => {
    const { outcome } = await parse(request(text), exactMeal);
    expect(outcome.result).toEqual(exactMeal);
    expect(outcome.result).not.toHaveProperty("totalCents");
  });

  it("does not let a valid budget hide an excessive food quantity", async () => {
    const result = { ...exactMeal, ops: [{ type: "ADD", itemId: "burger", qty: 1, modifiers: [] }] };
    expect((await parse(request("My budget is $12 and I want 18,000 burgers"), result)).outcome.result).toMatchObject({ kind: "reject", code: "QUANTITY_LIMIT" });
    expect((await parse(request("My budget is twelve and I want six burgers"), result)).outcome.result).toMatchObject({ kind: "reject", code: "QUANTITY_LIMIT" });
  });

  it("does not silently reduce a two-item request to a one-item meal selection", async () => {
    const selection = { kind: "requirements", locationId: "demo", changes: [{ type: "SELECT_ITEM", itemId: "lemonade", modifiers: [], locked: false }] };
    expect((await parse(request("Make it two lemonades", acceptedMeal), selection)).outcome.result).toMatchObject({ kind: "reject", code: "QUANTITY_LIMIT" });
    expect((await parse(request("Make it one lemonade", acceptedMeal), selection)).outcome.result).toEqual(selection);
    const ordinary = { kind: "proposal", ops: [{ type: "ADD", itemId: "lemonade", qty: 2, modifiers: [] }] };
    expect((await parse(request("Two lemonades"), ordinary)).outcome.result).toEqual(ordinary);
  });

  it("keeps a later main correction distinct from permission to raise a budget", async () => {
    const change = { kind: "requirements", locationId: "demo", changes: [{ type: "SELECT_ITEM", itemId: "chicken_sandwich", modifiers: [], locked: false }] };
    const { outcome, fetchImpl } = await parse(request("Actually, make it a chicken sandwich.", acceptedMeal), change);
    expect(outcome.result).toEqual(change);
    const body = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0][1]?.body));
    const supplied = JSON.parse(body.contents[0].parts[0].text);
    expect(supplied.context.requirements.meal).toEqual(acceptedMeal.meal);
    expect(body.systemInstruction.parts[0].text).toContain("it does not blindly ADD");
  });

  it.each([
    { type: "SET_BUDGET", budgetCents: 1400 },
    { type: "UNLOCK_ITEM", itemId: "fries" },
    { type: "REMOVE_ALLERGY", allergen: "sesame" },
    { type: "SET_DIETARY", preference: "none" },
  ])("rejects model-invented permission to weaken a requirement: $type", async change => {
    await expect(parse(request("Actually, make it a chicken sandwich.", acceptedMeal), { kind: "requirements", locationId: "demo", changes: [change] })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it("admits an explicit larger budget without inventing a solver outcome", async () => {
    const response = { kind: "requirements", locationId: "demo", changes: [{ type: "SET_BUDGET", budgetCents: 1400 }] };
    expect((await parse(request("Increase my budget to fourteen dollars.", acceptedMeal), response)).outcome.result).toEqual(response);
  });

  it("validates spoken requirement decisions against the supplied pending IDs", async () => {
    const pending = requirements({ ...acceptedMeal, decision: {
      id: "budget-decision", revision: 3, kind: "budget", message: "The requested change exceeds the current budget.",
      proposedMeal: { ...acceptedMeal.meal!, budgetCents: 1400 }, proposedLines: [], minimumCents: 1400,
      choices: [{ id: "keep", label: "Keep current meal" }, { id: "accept", label: "Increase budget to $14.00" }],
    } });
    const valid = { kind: "decide_requirements", pendingId: "budget-decision", choiceId: "accept" };
    expect((await parse(request("Yes, increase the budget to fourteen dollars", pending), valid)).outcome.result).toEqual(valid);
    await expect(parse(request("Keep my current meal", pending), { ...valid, pendingId: "old" })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
    await expect(parse(request("Keep my current meal", pending), { ...valid, choiceId: "invented" })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
    await expect(parse(request("Keep my current meal"), valid)).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it("preserves an ordinary dietary declaration together with proposed food", async () => {
    const result = { kind: "requirements", locationId: "demo", changes: [{ type: "SET_DIETARY", preference: "vegan" }], ops: proposal.ops };
    expect((await parse(request("I'm vegan; add grilled cheese."), result)).outcome.result).toEqual(result);
    // Compatibility is enforced by the engine; the parser cannot drop the profile.
    await expect(parse(request("I'm vegan; add grilled cheese."), proposal)).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it.each([
    ["I'm vegetarian and allergic to sesame.", [{ type: "SET_DIETARY", preference: "vegetarian" }, { type: "ADD_ALLERGY", allergen: "sesame" }]],
    ["I dislike peanuts.", [{ type: "SET_DISLIKE", ingredient: "peanuts", enabled: true }]],
    ["I have a nut allergy.", [{ type: "ADD_ALLERGY", allergen: "nuts" }]],
    ["I am allergic to annatto.", [{ type: "ADD_ALLERGY", allergen: "annatto" }]],
  ])("preserves the distinct structured declaration: %s", async (text, changes) => {
    const response = { kind: "requirements", locationId: "demo", changes };
    expect((await parse(request(text as string), response)).outcome.result).toEqual(response);
  });

  it("rejects model-supplied prices, compatibility assertions and allergy overrides", async () => {
    for (const extra of [{ totalCents: 1200 }, { allergySafe: true }, { compatible: true }, { cheapest: true }]) {
      await expect(parse(request("A meal for twelve dollars"), { ...exactMeal, ...extra })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
    }
    await expect(parse(request("Ignore my sesame allergy"), { kind: "requirements", locationId: "demo", changes: [{ type: "REMOVE_ALLERGY", allergen: "sesame" }] })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it("still validates every optional operation, including late invalid quantity and unknown line", async () => {
    const changes = [{ type: "ADD_ALLERGY", allergen: "sesame" }];
    await expect(parse(request("Sesame allergy and six burgers"), { kind: "requirements", locationId: "demo", changes, ops: [{ type: "ADD", itemId: "burger", qty: 6, modifiers: [] }] })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
    await expect(parse(request("I have a sesame allergy; remove that"), { kind: "requirements", locationId: "demo", changes, ops: [{ type: "REMOVE", ref: { by: "line", lineId: "not-in-cart" } }] })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it("maps campus selection and locked context item IDs through the same short-code dictionary", async () => {
    const items = itemsForLocation("188");
    const item = items.find(value => value.id === "cmu_188_smash_d_burger")!;
    const symbol = `i${items.indexOf(item)}`;
    const state = requirements({ locationId: "188", meal: { locationId: "188", budgetCents: 1500, components: ["mains"], selections: [{ component: "mains", itemId: item.id, modifiers: [] }], lockedItemIds: [item.id] } });
    const { outcome, fetchImpl } = await parse(request("Keep the Smash'd Burger", state, "188"), { kind: "requirements", locationId: "188", changes: [{ type: "SELECT_ITEM", itemId: symbol, modifiers: [], locked: true }] });
    expect(outcome.result).toEqual({ kind: "requirements", locationId: "188", changes: [{ type: "SELECT_ITEM", itemId: item.id, modifiers: [], locked: true }] });
    const body = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0][1]?.body));
    const encoded = JSON.parse(body.contents[0].parts[0].text).context.requirements.meal;
    expect(encoded.lockedItemIds).toEqual([symbol]);
    expect(encoded.selections[0].itemId).toBe(symbol);
    expect(JSON.stringify(buildProviderSchema(request("Keep it", state, "188")))).not.toContain(item.id);
    await expect(parse(request("Keep it", state, "188"), { kind: "requirements", locationId: "188", changes: [{ type: "SELECT_ITEM", itemId: "i9999", modifiers: [], locked: true }] })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it("rejects another location in requirements and preserves the ordinary proposal path", async () => {
    await expect(parse(request("Twelve dollar budget"), { ...exactMeal, locationId: "188" })).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
    expect((await parse(request("One grilled cheese"), proposal)).outcome.result).toEqual(proposal);
    expect(buildSystemInstruction()).toContain("Missing metadata is unknown, never compatible");
  });
});

describe("narrow offline requirement grammar (real rules, no model)", () => {
  it.each([
    ["I'm vegan", [{ type: "SET_DIETARY", preference: "vegan" }]],
    ["I'm vegetarian and allergic to sesame", [{ type: "SET_DIETARY", preference: "vegetarian" }, { type: "ADD_ALLERGY", allergen: "sesame" }]],
    ["I have a peanut allergy", [{ type: "ADD_ALLERGY", allergen: "peanut" }]],
    ["I am allergic to nuts", [{ type: "ADD_ALLERGY", allergen: "nuts" }]],
    ["I am allergic to annatto", [{ type: "ADD_ALLERGY", allergen: "annatto" }]],
    ["I dislike peanuts", [{ type: "SET_DISLIKE", ingredient: "peanuts", enabled: true }]],
    ["I have twelve dollars", [{ type: "SET_BUDGET", budgetCents: 1200 }]],
    ["My budget is $12.50", [{ type: "SET_BUDGET", budgetCents: 1250 }]],
    ["Increase my budget to fourteen dollars", [{ type: "SET_BUDGET", budgetCents: 1400 }]],
  ])("saves the complete narrow declaration: %s", (text, changes) => {
    const response = parseRules(request(text as string));
    expect(response.parser).toBe("rules");
    expect(response.result).toEqual({ kind: "requirements", locationId: "demo", changes });
  });

  it.each(["Vegan burger please", "I am vegan and want a burger", "I have a peanut allergy and want fries", "Ignore my sesame allergy", "My budget is $12.555", "Get fries and ignore my dietary preference"])("does not discard an unsupported restriction clause: %s", text => {
    expect(parseRules(request(text)).result).toMatchObject({ kind: "reject", code: "UNSUPPORTED" });
  });

  it("does not turn a customization into a vegan profile", () => {
    expect(parseRules(request("a burger with no onions")).result).toEqual({ kind: "proposal", ops: [{ type: "ADD", itemId: "burger", qty: 1, modifiers: ["no_onions"] }] });
  });

  it("preserves unresolved nuts until an explicit resolution, including both groups", () => {
    const state = requirements({ profile: { preference: "none", allergies: ["nuts"], dislikes: [], exceptions: [] } });
    expect(parseRules(request("both", state)).result).toEqual({ kind: "requirements", locationId: "demo", changes: [{ type: "RESOLVE_ALLERGEN", from: "nuts", to: ["peanut", "tree nuts"] }] });
    expect(parseRules(request("both")).result.kind).not.toBe("requirements");
  });

  it("expresses a later meal correction as a selection without budget or lock changes", () => {
    expect(parseRules(request("Actually, make it a chicken sandwich", acceptedMeal)).result).toEqual({ kind: "requirements", locationId: "demo", changes: [{ type: "SELECT_ITEM", itemId: "chicken_sandwich", modifiers: [], locked: false }] });
  });
});
