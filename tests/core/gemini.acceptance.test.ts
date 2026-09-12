// Opt-in REAL HTTP/Gemini acceptance. No network or output files without LIVE_APP_URL.
// Example: LIVE_APP_URL=http://localhost:3000 npm test -- tests/core/gemini.acceptance.test.ts
// The server owns its Gemini key. This test never reads or supplies provider secrets.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  API_VERSION, MENU_VERSION, LIMITS, ApiErrorSchema, ParseResponseSchema,
  type ItemId, type ModifierId, type OrderView, type ParseRequest, type ParseResponse, type UiAction,
} from "../../src/contracts";
import { MENU } from "../../src/contracts/menu";
import { createOrderController } from "../../src/controller/controller";
import { interpretWith } from "../../src/parser/client";
import { replayLog } from "../../src/core/engine";

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

async function saveEvidence() {
  if (!liveAppUrl) return;
  await mkdir(join(process.cwd(), "evals", "runs"), { recursive: true });
  await writeFile(reportPath, JSON.stringify({
    kind: "live-http-gemini-controller-acceptance",
    recordedAt: new Date().toISOString(), appOrigin, apiVersion: API_VERSION, menuVersion: MENU_VERSION,
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
    sessionId: () => `live-${record.name.replace(/[^a-z0-9]+/gi, "-").slice(0, 70)}`,
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

  it("understands the exact long request, a correction across turns, and explicit review/receipt", () => scenario("long-order-and-cross-turn-correction", async (harness) => {
    await harness.send("Hi I would like to order a burger and um also some fries and a lemonade too, actually wait can you make it a double burger with no lettuce.");
    expectCart(harness, [
      { itemId: "burger", qty: 1, modifiers: ["double", "no_lettuce"] },
      { itemId: "fries", qty: 1, modifiers: [] },
      { itemId: "lemonade", qty: 1, modifiers: [] },
    ], 1600);
    expect(harness.snapshot().assistant?.text).toMatch(/double/);
    expect(harness.snapshot().assistant?.text).toMatch(/no lettuce/);
    await harness.send("Actually make that two lemonades and put the lettuce back on the burger");
    expectCart(harness, [
      { itemId: "burger", qty: 1, modifiers: ["double"] },
      { itemId: "fries", qty: 1, modifiers: [] },
      { itemId: "lemonade", qty: 2, modifiers: [] },
    ], 1850);
    expect(harness.snapshot().assistant?.text).toMatch(/2 lemonade/);
    expect(harness.snapshot().assistant?.text).not.toMatch(/no lettuce/);
    harness.manual({ type: "REVIEW" });
    const review = harness.snapshot().state.review!;
    expect(review?.totalCents).toBe(1850);
    harness.manual({ type: "CONFIRM", reviewId: review.id, revision: review.revision });
    expect(harness.snapshot().state.receipt).toMatchObject({ lines: review.lines, totalCents: 1850, simulated: true });
    expect(replayLog(harness.snapshot().exportLog())).toEqual(harness.snapshot().state);
  }), requestBudgetMs * 2);

  it("adds a clear available subset and explains the unavailable pizza", () => scenario("mixed-available-and-unavailable", async (harness) => {
    await harness.send("Can I get a pizza, a burger, and a lemonade?");
    expectCart(harness, [{ itemId: "burger", qty: 1, modifiers: [] }, { itemId: "lemonade", qty: 1, modifiers: [] }], 1050);
    expect(harness.snapshot().assistant?.text).toMatch(/(?:don't sell|do not sell|not available).*pizza/i);
    expect(harness.snapshot().assistant?.text).not.toMatch(/added[^.]*pizza/i);
  }), requestBudgetMs);

  it("asks which separate burger to remove and resolves a natural-language answer", () => scenario("ambiguous-reference-and-natural-resolution", async (harness) => {
    await harness.send("I'd like one burger with no onions and a separate burger with extra cheese.");
    expectCart(harness, [{ itemId: "burger", qty: 1, modifiers: ["no_onions"] }, { itemId: "burger", qty: 1, modifiers: ["extra_cheese"] }], 1700);
    const original = structuredClone(harness.snapshot().state.lines);
    expect(original).toHaveLength(2);
    await harness.send("Remove the burger.");
    expect(harness.snapshot().state.lines).toEqual(original);
    expect(harness.snapshot().state.phase).toBe("clarifying");
    expect(harness.snapshot().state.pending?.choices).toHaveLength(2);
    expect(harness.snapshot().assistant?.text).toBe(harness.snapshot().state.pending?.question);
    await harness.send("The second one.");
    expectCart(harness, [{ itemId: "burger", qty: 1, modifiers: ["no_onions"] }], 800);
    expect(harness.snapshot().state.lines[0].lineId).toBe(original[0].lineId);
    expect(harness.snapshot().assistant?.text).toMatch(/removed.*extra cheese/i);
  }), requestBudgetMs * 3);

  it("understands several new menu items and their valid options", () => scenario("expanded-menu-options", async (harness) => {
    await harness.send("A chicken sandwich without mayo, a grilled cheese with extra cheese, and a side salad with dressing on the side, please.");
    expectCart(harness, [
      { itemId: "chicken_sandwich", qty: 1, modifiers: ["no_mayo"] },
      { itemId: "grilled_cheese", qty: 1, modifiers: ["extra_cheese"] },
      { itemId: "side_salad", qty: 1, modifiers: ["dressing_on_side"] },
    ], 2000);
    for (const phrase of ["chicken sandwich", "no mayo", "grilled cheese", "extra cheese", "side salad", "dressing on the side"]) {
      expect(harness.snapshot().assistant?.text.toLowerCase()).toContain(phrase);
    }
  }), requestBudgetMs);

  it("adds clear items and specifically names unsupported extras", () => scenario("unsupported-extra-mixed-order", async (harness) => {
    await harness.send("Hi I'd like a burger and a veggie wrap and some fries with extra salt");
    expectCart(harness, [
      { itemId: "burger", qty: 1, modifiers: [] },
      { itemId: "veggie_wrap", qty: 1, modifiers: [] },
      { itemId: "fries", qty: 1, modifiers: [] },
    ], 1850);
    expect(harness.snapshot().assistant?.text).toMatch(/can't add extra salt to fries/i);
    const original = structuredClone(harness.snapshot().state.lines);
    await harness.send("Put extra salt on my fries, please.");
    expect(harness.snapshot().state.lines).toEqual(original);
    expect(harness.snapshot().state.audit.at(-1)?.outcome).toBe("rejected");
    expect(harness.snapshot().assistant?.text).toMatch(/can't add extra salt to fries.*not changed/i);
    harness.manual({ type: "UNDO" });
    expect(harness.snapshot().state.lines).toEqual([]);
  }), requestBudgetMs * 2);

  it("clarifies an order conditional on an unsupported extra before adding anything", () => scenario("unsupported-extra-conditional", async (harness) => {
    await harness.send("Please order a burger and fries, but only if you can put extra salt on the fries; otherwise don't order anything.");
    expect(harness.snapshot().state.lines).toEqual([]);
    expect(harness.snapshot().state.phase).toBe("clarifying");
    expect(harness.snapshot().assistant?.text).toMatch(/salt/i);
  }), requestBudgetMs);

  it("preserves the cart for negative/excessive quantities and an unsupported pairing", () => scenario("invalid-quantities-and-options", async (harness) => {
    harness.manual({ type: "MANUAL", ops: [{ type: "ADD", itemId: "burger", qty: 1, modifiers: [] }, { type: "ADD", itemId: "fries", qty: 1, modifiers: [] }] });
    const original = structuredClone(harness.snapshot().state.lines);
    for (const text of ["Set the burger quantity to negative two.", "Make it eighteen thousand burgers.", "Make the fries a double."]) {
      await harness.send(text);
      expect(harness.snapshot().state.lines).toEqual(original);
      expect(harness.snapshot().state.totalCents).toBe(1100);
      expect(harness.snapshot().state.audit.at(-1)?.outcome).toBe("rejected");
      expect(harness.snapshot().assistant?.text).not.toMatch(/I added|I removed|Updated to/i);
    }
  }), requestBudgetMs * 3);

  it("asks before an ambiguous replacement involving unavailable pizza", () => scenario("conditional-unavailable-replacement", async (harness) => {
    harness.manual({ type: "MANUAL", ops: [{ type: "ADD", itemId: "burger", qty: 1, modifiers: [] }] });
    const original = structuredClone(harness.snapshot().state.lines);
    await harness.send("Could you replace my burger with pizza, or maybe something similar if you don't have it?");
    expect(harness.snapshot().state.lines).toEqual(original);
    expect(harness.snapshot().state.totalCents).toBe(800);
    expect(harness.snapshot().state.phase).toBe("clarifying");
    expect(harness.snapshot().state.pending?.question.length).toBeGreaterThan(0);
    expect(harness.snapshot().assistant?.text).toBe(harness.snapshot().state.pending?.question);
    expect(harness.snapshot().assistant?.text).toMatch(/pizza|instead|alternative|replace|menu|available|something else/i);
  }), requestBudgetMs);

  const paraphrases: { name: string; text: string; expected: ExpectedLine[]; totalCents: number }[] = [
    {
      name: "drink-replacement-keeps-no-ice",
      text: "Could you do a chicken sandwich—hold the mayo—plus a tea with no ice? Actually, make the tea a lemonade, still without ice.",
      expected: [{ itemId: "chicken_sandwich", qty: 1, modifiers: ["no_mayo"] }, { itemId: "lemonade", qty: 1, modifiers: ["no_ice"] }],
      totalCents: 1100,
    },
    {
      name: "restore-wrap-lettuce-within-turn",
      text: "I'll take a veggie wrap without lettuce and onion rings. On second thought, leave the lettuce in the wrap; keep the rings.",
      expected: [{ itemId: "veggie_wrap", qty: 1, modifiers: [] }, { itemId: "onion_rings", qty: 1, modifiers: [] }],
      totalCents: 1100,
    },
    {
      name: "cheese-option-and-bottled-water-correction",
      text: "A grilled cheese and a cola, please. Sorry, make the grilled cheese extra cheesy and change the cola to bottled water.",
      expected: [{ itemId: "grilled_cheese", qty: 1, modifiers: ["extra_cheese"] }, { itemId: "water", qty: 1, modifiers: [] }],
      totalCents: 900,
    },
  ];

  it.each(paraphrases)("generalizes to the unused correction: $name", ({ name, text, expected, totalCents }) => scenario(name, async (harness) => {
    await harness.send(text);
    expectCart(harness, expected, totalCents);
    for (const line of expected) expect(harness.snapshot().assistant?.text.toLowerCase()).toContain(MENU[line.itemId].label.toLowerCase());
  }), requestBudgetMs);
});
