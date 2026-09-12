import { loadEnvFile } from "node:process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { API_VERSION, type ParseRequest, type ParseResult, type RequirementsState } from "@/contracts";
import { parseGemini as parseGeminiWith, type GeminiConfig } from "@/parser/gemini.server";
import { CATALOG, MENU_VERSION } from "../helpers/catalog";

const parseGemini = (req: ParseRequest, config: GeminiConfig) => parseGeminiWith(req, config, CATALOG);

// Synthetic scenarios only. No human speech, personal profile, HTTP route or solver
// is exercised here. Every enabled case uses the real provider once, with no fallback.
const enabled = process.env.RUN_REQUIREMENTS_LIVE === "1";
if (enabled) loadEnvFile(".env.local");
const records: { id: string; provider: string; status: number | null; passed: boolean; kind: string | null; latencyMs: number; code: string | null }[] = [];
const profile = { preference: "none" as const, allergies: [], dislikes: [], exceptions: [] };
const state: RequirementsState = {
  locationId: "demo", meal: { locationId: "demo", budgetCents: 1200, components: ["mains", "sides", "drinks"], selections: [{ component: "sides", itemId: "fries", modifiers: [] }, { component: "drinks", itemId: "lemonade", modifiers: [] }], lockedItemIds: ["fries", "lemonade"] },
  profile, decision: null, checks: [], message: null, remainingCents: 0, solver: null,
};
const decisionState: RequirementsState = { ...state, decision: {
  id: "synthetic-budget-decision", revision: 4, kind: "budget", message: "The chicken sandwich with the retained fries and lemonade has a $14.00 menu subtotal. Keep the current meal or raise the budget?",
  proposedMeal: { ...state.meal!, budgetCents: 1400 }, proposedLines: [{ lineId: "synthetic-main", itemId: "chicken_sandwich", qty: 1, modifiers: [] }, { lineId: "synthetic-side", itemId: "fries", qty: 1, modifiers: [] }, { lineId: "synthetic-drink", itemId: "lemonade", qty: 1, modifiers: [] }], minimumCents: 1400,
  choices: [{ id: "keep", label: "Keep current meal" }, { id: "accept", label: "Increase budget to $14.00" }],
} };
function changes(result: ParseResult) {
  expect(result.kind).toBe("requirements");
  if (result.kind !== "requirements") throw new Error("Expected requirement interpretation.");
  expect(result.locationId).toBe("demo");
  return result.changes;
}
const scenarios = [
  { id: "exact-budget-locks", text: "I have twelve dollars. Get me a main, a side, and a drink. Keep the fries and lemonade.", check(result: ParseResult) {
    expect(changes(result)).toEqual(expect.arrayContaining([{ type: "SET_BUDGET", budgetCents: 1200 }, { type: "SELECT_ITEM", itemId: "fries", modifiers: [], locked: true }, { type: "SELECT_ITEM", itemId: "lemonade", modifiers: [], locked: true }]));
    expect(changes(result).filter(change => change.type === "SELECT_ITEM")).toHaveLength(2);
  } },
  { id: "alternate-budget", text: "Could you build a main, side and drink for under $15? I want the lemonade to stay.", check(result: ParseResult) {
    const list = changes(result);
    expect(list).toContainEqual({ type: "SET_BUDGET", budgetCents: 1500 });
    expect(list).toContainEqual({ type: "SELECT_ITEM", itemId: "lemonade", modifiers: [], locked: true });
  } },
  { id: "later-main-correction", text: "Actually, make it a chicken sandwich.", requirements: state, check(result: ParseResult) {
    expect(changes(result)).toEqual([{ type: "SELECT_ITEM", itemId: "chicken_sandwich", modifiers: [], locked: false }]);
  } },
  { id: "spoken-budget-decision", text: "Yes, raise the budget to fourteen dollars.", requirements: decisionState, source: "voice" as const, check(result: ParseResult) {
    expect(result).toEqual({ kind: "decide_requirements", pendingId: "synthetic-budget-decision", choiceId: "accept" });
  } },
  { id: "vegan-declaration", text: "I'm vegan.", source: "voice" as const, check(result: ParseResult) {
    expect(changes(result)).toEqual([{ type: "SET_DIETARY", preference: "vegan" }]);
  } },
  { id: "preference-and-sesame", text: "I'm vegetarian and allergic to sesame.", check(result: ParseResult) {
    expect(changes(result)).toEqual(expect.arrayContaining([{ type: "SET_DIETARY", preference: "vegetarian" }, { type: "ADD_ALLERGY", allergen: "sesame" }]));
  } },
  { id: "allergy-plus-order", text: "I have a peanut allergy. Can I get onion rings?", check(result: ParseResult) {
    expect(changes(result)).toContainEqual({ type: "ADD_ALLERGY", allergen: "peanut" });
    expect(result).toMatchObject({ ops: [{ type: "ADD", itemId: "onion_rings", qty: 1, modifiers: [] }] });
  } },
  { id: "ambiguous-nuts-retained", text: "I have a nut allergy.", source: "voice" as const, check(result: ParseResult) {
    expect(changes(result)).toEqual([{ type: "ADD_ALLERGY", allergen: "nuts" }]);
  } },
  { id: "additional-allergen-retained", text: "I am allergic to kiwi fruit.", check(result: ParseResult) {
    expect(changes(result)).toHaveLength(1);
    expect(changes(result)[0]).toMatchObject({ type: "ADD_ALLERGY", allergen: expect.stringMatching(/^kiwi(?: fruit)?$/) });
  } },
];

describe.skipIf(!enabled)("real Gemini requirement interpretation, opt-in synthetic evidence", () => {
  for (const [index, scenario] of scenarios.entries()) it(scenario.id, async () => {
    const apiKey = process.env.GEMINI_API_KEY ?? "";
    expect(apiKey.length > 0).toBe(true);
    const req: ParseRequest = { v: API_VERSION, menuVersion: MENU_VERSION, requestId: `synthetic-meal-${index}`, baseRevision: 4, locationId: "demo", text: scenario.text, source: scenario.source ?? "text", asrConfidence: null,
      context: { lines: scenario.requirements ? [{ lineId: "synthetic-main", itemId: "grilled_cheese", qty: 1, modifiers: [] }, { lineId: "synthetic-side", itemId: "fries", qty: 1, modifiers: [] }, { lineId: "synthetic-drink", itemId: "lemonade", qty: 1, modifiers: [] }] : [], lastLineId: null, pending: null, recent: [], ...("requirements" in scenario ? { requirements: scenario.requirements } : {}) },
    };
    const record = { id: scenario.id, provider: "gemini-3.6-flash", status: null as number | null, passed: false, kind: null as string | null, latencyMs: 0, code: null as string | null };
    const start = performance.now();
    try {
      const outcome = await parseGemini(req, { apiKey, model: "gemini-3.6-flash", timeoutMs: 14000,
        fetchImpl: async (input, init) => { const response = await fetch(input, init); record.status = response.status; return response; },
      });
      record.kind = outcome.result.kind;
      expect(record.status).toBe(200);
      scenario.check(outcome.result);
      record.passed = true;
    } catch (error) {
      record.code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "ASSERTION_FAILED";
      throw error;
    } finally { record.latencyMs = Math.round(performance.now() - start); records.push(record); }
  }, 17000);
});

afterAll(() => {
  if (!enabled) return;
  const output = resolve("../work/meal-provider-evidence.json");
  mkdirSync(resolve("../work"), { recursive: true });
  writeFileSync(output, JSON.stringify({ checkedAt: new Date().toISOString(), evidence: "Real Gemini adapter calls; synthetic fixtures only; no HTTP controller, solver, fallback or human microphone", requestCount: records.length, passed: records.filter(record => record.passed).length, cases: records }, null, 2) + "\n");
});
