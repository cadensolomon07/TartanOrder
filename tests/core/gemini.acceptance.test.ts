// Opt-in REAL HTTP/Gemini acceptance. No network or output files without LIVE_APP_URL.
// Example: LIVE_APP_URL=http://localhost:3000 npm test -- tests/core/gemini.acceptance.test.ts
// The server owns its Gemini key. This test never reads or supplies provider secrets.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  API_VERSION, LIMITS, ApiErrorSchema, ParseResponseSchema,
  type ItemId, type ModifierId, type OrderView, type ParseRequest, type ParseResponse, type UiAction,
} from "../../src/contracts";
import { ACTIVE_LOCATION_IDS } from "../../src/contracts/campus";
import { createOrderController } from "../../src/controller/controller";
import { interpretWith } from "../../src/parser/client";
import { replayLog } from "../../src/core/engine";
import { CATALOG, MENU, MENU_VERSION } from "../helpers/catalog";

const liveAppUrl = (process.env.LIVE_APP_URL ?? "").trim();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const requestBudgetMs = LIMITS.clientTimeoutMs + 5_000;
let appOrigin = "";
const reportPath = join(process.cwd(), "evals", "runs", `live-app-gemini-${stamp}.json`);

type HttpEvidence = { status: number; elapsedMs: number; response: ParseResponse | null; errorCode: string | null };
type StepEvidence = {
  text: string;
  request: ParseRequest | null;
  http: HttpEvidence[];
  response: ParseResponse | null;
  elapsedMs: number;
  state: OrderView | null;
  assistant: string | null;
};
type CaseEvidence = {
  name: string;
  actions: { afterStep: number; action: UiAction }[];
  steps: StepEvidence[];
  finalState: OrderView | null;
  outcome: "running" | "passed" | "failed";
  failure: string | null;
};
const cases: CaseEvidence[] = [];
const BURGER = "cmu_188_smash_d_burger";
const FRIES = "cmu_188_fresh_cut_fries";
const CAJUN = "cmu_188_cajun_fries";
const GRILLED_CHEESE = "cmu_188_grilled_cheese";
const CHICKEN = "cmu_188_korean_bbq_chicken_sandwich";

async function saveEvidence() {
  if (!liveAppUrl) return;
  await mkdir(join(process.cwd(), "evals", "runs"), { recursive: true });
  await writeFile(reportPath, JSON.stringify({
    kind: "live-http-gemini-controller-acceptance",
    recordedAt: new Date().toISOString(), appOrigin, apiVersion: API_VERSION, menuVersion: MENU_VERSION,
    locationId: "188", allowedLocationIds: ACTIVE_LOCATION_IDS,
    evidence: {
      transport: "Real HTTP requests through the application interpret client; no injected model responses.",
      requiredMode: "Every request must return HTTP 200, parser=gemini and fallbackReason=null.",
      engine: "Real local controller and deterministic engine apply each server interpretation.",
      voice: "Typed synthetic utterances only. No human microphone or browser speech trial.",
      retries: "None; scenarios execute sequentially.",
      timings: "Observed request/controller timings for these cases only; not a latency benchmark.",
      providerBoundary: "The server-reported mode is asserted; provider credentials and direct provider traffic remain server-side.",
    },
    passed: cases.filter((entry) => entry.outcome === "passed").length,
    failed: cases.filter((entry) => entry.outcome === "failed").length,
    cases,
  }, null, 2), "utf8");
}

function createHarness(record: CaseEvidence) {
  let currentStep: StepEvidence | null = null;
  const store = createOrderController({
    catalog: CATALOG,
    sessionId: () => `live-${record.name.replace(/[^a-z0-9]+/gi, "-").slice(0, 70)}`,
    locationId: "188", allowedLocationIds: ACTIVE_LOCATION_IDS,
    interpret: async (request, options) => {
      if (!currentStep) throw new Error("Unexpected interpreter call outside an acceptance step.");
      const step = currentStep;
      step.request = structuredClone(request);
      const response = await interpretWith(request, options, {
        timeoutMs: LIMITS.clientTimeoutMs,
        isOnline: () => true,
        fetchImpl: async (input, init) => {
          const started = performance.now();
          const endpoint = input instanceof Request ? input.url : String(input);
          const http = await fetch(new URL(endpoint, appOrigin), init);
          const body: unknown = await http.clone().json().catch(() => null);
          const parsed = ParseResponseSchema.safeParse(body);
          const apiError = ApiErrorSchema.safeParse(body);
          step.http.push({
            status: http.status,
            elapsedMs: Math.round(performance.now() - started),
            response: parsed.success ? parsed.data : null,
            errorCode: apiError.success ? apiError.data.error.code : null,
          });
          return http;
        },
      });
      step.response = response;
      return response;
    },
  });

  return {
    snapshot: store.getSnapshot,
    dispose: store.dispose,
    manual(action: UiAction) {
      record.actions.push({ afterStep: record.steps.length, action: structuredClone(action) });
      store.getSnapshot().act(action);
    },
    async send(text: string) {
      const step: StepEvidence = { text, request: null, http: [], response: null, elapsedMs: 0, state: null, assistant: null };
      record.steps.push(step);
      currentStep = step;
      const started = performance.now();
      await store.getSnapshot().submit(text, "text", null);
      step.elapsedMs = Math.round(performance.now() - started);
      step.state = structuredClone(store.getSnapshot().state);
      step.assistant = store.getSnapshot().assistant?.text ?? null;
      currentStep = null;
      expect(step.request?.context, "Controller must supply bounded current-order context").toBeDefined();
      expect(step.request?.locationId).toBe("188");
      expect(step.http, "Exactly one real HTTP attempt is required; local parsing is not acceptance evidence").toHaveLength(1);
      expect(step.http[0].status, `HTTP failed: ${step.http[0].errorCode ?? "unknown"}`).toBe(200);
      expect(step.http[0].response?.parser, "Server must actually select Gemini").toBe("gemini");
      expect(step.http[0].response?.fallbackReason).toBeNull();
      expect(step.response?.parser, "A rules fallback must fail this live acceptance case").toBe("gemini");
      expect(step.response?.fallbackReason).toBeNull();
      expect(store.getSnapshot().parser).toBe("gemini");
      expect(store.getSnapshot().busy).toBe(false);
      expect(step.assistant?.length, "The controller must publish a customer response").toBeGreaterThan(0);
      return step;
    },
  };
}

type Harness = ReturnType<typeof createHarness>;
async function scenario(name: string, exercise: (harness: Harness) => Promise<void>) {
  const record: CaseEvidence = { name, actions: [], steps: [], finalState: null, outcome: "running", failure: null };
  cases.push(record);
  const harness = createHarness(record);
  try {
    await exercise(harness);
    record.outcome = "passed";
  } catch (error) {
    record.outcome = "failed";
    record.failure = error instanceof Error ? error.message : "Unknown acceptance failure.";
    throw error;
  } finally {
    record.finalState = structuredClone(harness.snapshot().state);
    harness.dispose();
    await saveEvidence();
  }
}

type ExpectedLine = { itemId: ItemId; qty: number; modifiers: ModifierId[] };
function expectCart(harness: Harness, expected: ExpectedLine[], totalCents: number) {
  const normalize = (lines: ExpectedLine[]) => lines.map((line) => ({ ...line, modifiers: [...line.modifiers].sort() }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const state = harness.snapshot().state;
  expect(normalize(state.lines.map(({ itemId, qty, modifiers }) => ({ itemId, qty, modifiers })))).toEqual(normalize(expected));
  expect(state.totalCents).toBe(totalCents);
  expect(state.pending).toBeNull();
  expect(state.audit.at(-1)?.outcome).toBe("applied");
}

describe.skipIf(!liveAppUrl)("live app Gemini conversational acceptance", { concurrent: false, shuffle: false }, () => {
  beforeAll(() => {
    const url = new URL(liveAppUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error("LIVE_APP_URL must be an HTTP(S) application URL without credentials, query parameters or fragment.");
    }
    appOrigin = url.origin;
  });

  it("understands a natural campus order, corrections within and across turns, and explicit review/receipt", () => scenario("campus-order-and-cross-turn-correction", async (harness) => {
    await harness.send("Hi, I would like a Smash'd Burger and um some Fresh Cut Fries and a Grilled Cheese too. Actually, make those fries Cajun Fries instead.");
    expectCart(harness, [
      { itemId: BURGER, qty: 1, modifiers: [] },
      { itemId: CAJUN, qty: 1, modifiers: [] },
      { itemId: GRILLED_CHEESE, qty: 1, modifiers: [] },
    ], 2045);
    const originalBurger = harness.snapshot().state.lines.find(line => line.itemId === BURGER)!;
    const originalFries = harness.snapshot().state.lines.find(line => line.itemId === CAJUN)!;
    await harness.send("Actually make that two orders of Cajun Fries, and replace the Grilled Cheese with a Korean BBQ Chicken Sandwich.");
    expectCart(harness, [
      { itemId: BURGER, qty: 1, modifiers: [] },
      { itemId: CAJUN, qty: 2, modifiers: [] },
      { itemId: CHICKEN, qty: 1, modifiers: [] },
    ], 2530);
    expect(harness.snapshot().state.lines.find(line => line.itemId === BURGER)?.lineId).toBe(originalBurger.lineId);
    expect(harness.snapshot().state.lines.find(line => line.itemId === CAJUN)?.lineId).toBe(originalFries.lineId);
    expect(harness.snapshot().assistant?.text).toMatch(/2 cajun fries/i);
    harness.manual({ type: "REVIEW" });
    const review = harness.snapshot().state.review!;
    expect(review?.totalCents).toBe(2530);
    harness.manual({ type: "CONFIRM", reviewId: review.id, revision: review.revision });
    const receipt = harness.snapshot().state.receipt;
    expect(receipt).toMatchObject({ lines: review.lines, totalCents: 2530, simulated: true });
    harness.manual({ type: "CONFIRM", reviewId: review.id, revision: review.revision });
    expect(harness.snapshot().state.receipt).toEqual(receipt);
    expect(replayLog(harness.snapshot().exportLog(), CATALOG)).toEqual(harness.snapshot().state);
  }), requestBudgetMs * 2);

  it("adds a clear available subset and explains the unavailable pizza", () => scenario("mixed-available-and-unavailable", async (harness) => {
    await harness.send("Can I get a pizza, a Smash'd Burger, and Fresh Cut Fries?");
    expectCart(harness, [{ itemId: BURGER, qty: 1, modifiers: [] }, { itemId: FRIES, qty: 1, modifiers: [] }], 1265);
    expect(harness.snapshot().assistant?.text).toMatch(/(?:don't sell|do not sell|not available).*pizza/i);
    expect(harness.snapshot().assistant?.text).not.toMatch(/added[^.]*pizza/i);
  }), requestBudgetMs);

  it("asks which separate burger to remove and resolves a natural-language answer", () => scenario("ambiguous-reference-and-natural-resolution", async (harness) => {
    await harness.send("I'd like one Smash'd Burger on one cart line and two more Smash'd Burgers on a separate cart line.");
    expectCart(harness, [{ itemId: BURGER, qty: 1, modifiers: [] }, { itemId: BURGER, qty: 2, modifiers: [] }], 2760);
    const original = structuredClone(harness.snapshot().state.lines);
    expect(original).toHaveLength(2);
    await harness.send("Remove the Smash'd Burger.");
    expect(harness.snapshot().state.lines).toEqual(original);
    expect(harness.snapshot().state.phase).toBe("clarifying");
    expect(harness.snapshot().state.pending?.choices).toHaveLength(2);
    expect(harness.snapshot().assistant?.text).toBe(harness.snapshot().state.pending?.question);
    await harness.send("The second one.");
    expectCart(harness, [{ itemId: BURGER, qty: 1, modifiers: [] }], 920);
    expect(harness.snapshot().state.lines[0].lineId).toBe(original[0].lineId);
    expect(harness.snapshot().assistant?.text).toMatch(/removed.*2 smash'd burger/i);
  }), requestBudgetMs * 3);

  it("understands published chicken variants and their included sauce without inventing modifiers", () => scenario("published-configurations", async (harness) => {
    await harness.send("One Nashville Sandwich with medium-heat fried chicken, one three-piece Chicken Tenders with Ranch, and a Side House Salad, please.");
    expectCart(harness, [
      { itemId: "cmu_188_nashville_sandwich_medium_heat_fried_chicken", qty: 1, modifiers: [] },
      { itemId: "cmu_188_3_piece_chicken_tenders_ranch", qty: 1, modifiers: [] },
      { itemId: "cmu_188_side_house_salad", qty: 1, modifiers: [] },
    ], 2185);
    for (const phrase of ["nashville", "medium-heat", "chicken tenders", "ranch", "side house salad"]) {
      expect(harness.snapshot().assistant?.text.toLowerCase()).toContain(phrase);
    }
  }), requestBudgetMs);

  it("adds clear items and specifically names unsupported extras", () => scenario("unsupported-extra-mixed-order", async (harness) => {
    await harness.send("Hi, I'd like a Smash'd Burger, a Smash'd Veggie Burger, and Fresh Cut Fries with extra salt.");
    expectCart(harness, [
      { itemId: BURGER, qty: 1, modifiers: [] },
      { itemId: "cmu_188_smash_d_veggie_burger", qty: 1, modifiers: [] },
      { itemId: FRIES, qty: 1, modifiers: [] },
    ], 2185);
    expect(harness.snapshot().assistant?.text).toMatch(/can't add extra salt to fresh cut fries/i);
    const original = structuredClone(harness.snapshot().state.lines);
    await harness.send("Put extra salt on my Fresh Cut Fries, please.");
    expect(harness.snapshot().state.lines).toEqual(original);
    expect(harness.snapshot().state.audit.at(-1)?.outcome).toBe("rejected");
    expect(harness.snapshot().assistant?.text).toMatch(/can't add extra salt to fresh cut fries.*not changed/i);
    harness.manual({ type: "UNDO" });
    expect(harness.snapshot().state.lines).toEqual([]);
  }), requestBudgetMs * 2);

  it("clarifies an order conditional on an unsupported extra before adding anything", () => scenario("unsupported-extra-conditional", async (harness) => {
    await harness.send("Please order a Smash'd Burger and Fresh Cut Fries, but only if you can put extra salt on the fries; otherwise don't order anything.");
    expect(harness.snapshot().state.lines).toEqual([]);
    expect(harness.snapshot().state.phase).toBe("clarifying");
    expect(harness.snapshot().assistant?.text).toMatch(/salt/i);
  }), requestBudgetMs);

  it("preserves the cart for negative/excessive quantities and an unsupported pairing", () => scenario("invalid-quantities-and-options", async (harness) => {
    harness.manual({ type: "MANUAL", ops: [{ type: "ADD", itemId: BURGER, qty: 1, modifiers: [] }, { type: "ADD", itemId: FRIES, qty: 1, modifiers: [] }] });
    const original = structuredClone(harness.snapshot().state.lines);
    for (const text of ["Set the Smash'd Burger quantity to negative two.", "Make it eighteen thousand Smash'd Burgers.", "Put the double modifier on my Fresh Cut Fries, without changing their quantity."]) {
      await harness.send(text);
      expect(harness.snapshot().state.lines).toEqual(original);
      expect(harness.snapshot().state.totalCents).toBe(1265);
      expect(harness.snapshot().state.audit.at(-1)?.outcome).toBe("rejected");
      expect(harness.snapshot().assistant?.text).not.toMatch(/I added|I removed|Updated to/i);
    }
  }), requestBudgetMs * 3);

  it("asks before an ambiguous replacement involving unavailable pizza", () => scenario("conditional-unavailable-replacement", async (harness) => {
    harness.manual({ type: "MANUAL", ops: [{ type: "ADD", itemId: BURGER, qty: 1, modifiers: [] }] });
    const original = structuredClone(harness.snapshot().state.lines);
    await harness.send("Could you replace my Smash'd Burger with pizza, or maybe something similar if you don't have it?");
    expect(harness.snapshot().state.lines).toEqual(original);
    expect(harness.snapshot().state.totalCents).toBe(920);
    expect(harness.snapshot().state.phase).toBe("clarifying");
    expect(harness.snapshot().state.pending?.question.length).toBeGreaterThan(0);
    expect(harness.snapshot().assistant?.text).toBe(harness.snapshot().state.pending?.question);
    expect(harness.snapshot().assistant?.text).toMatch(/pizza|instead|alternative|replace|menu|available|something else/i);
  }), requestBudgetMs);

  const paraphrases: { name: string; text: string; expected: ExpectedLine[]; totalCents: number }[] = [
    {
      name: "fries-variant-replacement",
      text: "Could I have a Grilled Cheese and Fresh Cut Fries? Actually, make those fries Cajun Fries instead.",
      expected: [{ itemId: GRILLED_CHEESE, qty: 1, modifiers: [] }, { itemId: CAJUN, qty: 1, modifiers: [] }],
      totalCents: 1125,
    },
    {
      name: "sweet-potato-side-correction",
      text: "I'll take a Smash'd Veggie Burger and Curly Fries. On second thought, switch the Curly Fries to Sweet Potato Fries; keep the burger.",
      expected: [{ itemId: "cmu_188_smash_d_veggie_burger", qty: 1, modifiers: [] }, { itemId: "cmu_188_sweet_potato_fries", qty: 1, modifiers: [] }],
      totalCents: 1355,
    },
    {
      name: "quantity-correction-within-turn",
      text: "One Korean BBQ Chicken Sandwich and two orders of Fresh Cut Fries, please. Sorry, make that just one order of fries.",
      expected: [{ itemId: CHICKEN, qty: 1, modifiers: [] }, { itemId: FRIES, qty: 1, modifiers: [] }],
      totalCents: 1265,
    },
  ];

  it.each(paraphrases)("applies a campus correction within one utterance: $name", ({ name, text, expected, totalCents }) => scenario(name, async (harness) => {
    await harness.send(text);
    expectCart(harness, expected, totalCents);
    for (const line of expected) expect(harness.snapshot().assistant?.text.toLowerCase()).toContain(MENU.item(line.itemId)!.label.toLowerCase());
  }), requestBudgetMs);
});
