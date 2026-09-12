import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CORE_CODES, type ParseRequest } from "@/contracts";
import { MENU, MODIFIERS } from "@/contracts/menu";
import {
  GeminiError,
  buildProviderSchema,
  buildSystemInstruction,
  parseGemini,
  type GeminiConfig,
} from "@/parser/gemini.server";

// ---------------------------------------------------------------------------
// Fixtures and fakes (no network: every test injects fetchImpl)
// ---------------------------------------------------------------------------

const API_KEY = "test-key-SECRET-0123456789";
const MODEL = "gemini-2.5-flash";
const TRANSCRIPT = "a burger, fries and lemonade";

const request: ParseRequest = {
  v: 1,
  requestId: "u1",
  baseRevision: 1,
  menuVersion: "demo-v1",
  text: TRANSCRIPT,
  source: "text",
  asrConfidence: null,
};

const threeItemProposal = {
  kind: "proposal",
  ops: [
    { type: "ADD", itemId: "burger", qty: 1, modifiers: [] },
    { type: "ADD", itemId: "fries", qty: 1, modifiers: [] },
    { type: "ADD", itemId: "lemonade", qty: 1, modifiers: [] },
  ],
} as const;

const usageMetadata = { promptTokenCount: 900, candidatesTokenCount: 40, totalTokenCount: 940 };

type FetchInit = Parameters<typeof fetch>[1];

function providerBody(text: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    candidates: [{ content: { parts: [{ text }], role: "model" }, finishReason: "STOP" }],
    usageMetadata,
    ...overrides,
  };
}

function respond(status: number, body: unknown): typeof fetch {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return vi.fn(async () => new Response(payload, { status, headers: { "content-type": "application/json" } }));
}

function modelReturns(result: unknown): typeof fetch {
  return respond(200, providerBody(JSON.stringify(result)));
}

function config(fetchImpl: typeof fetch, overrides: Partial<GeminiConfig> = {}): GeminiConfig {
  return { apiKey: API_KEY, model: MODEL, timeoutMs: 1_000, fetchImpl, ...overrides };
}

async function failure(fetchImpl: typeof fetch, overrides: Partial<GeminiConfig> = {}): Promise<GeminiError> {
  try {
    await parseGemini(request, config(fetchImpl, overrides));
  } catch (error) {
    if (error instanceof GeminiError) return error;
    throw new Error(`Expected GeminiError, received ${String(error)}`);
  }
  throw new Error("Expected parseGemini to reject");
}

function collectNodes(node: unknown, visit: (record: Record<string, unknown>, key: string | null) => void, key: string | null = null): void {
  if (Array.isArray(node)) {
    node.forEach((entry) => collectNodes(entry, visit, null));
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const record = node as Record<string, unknown>;
  visit(record, key);
  Object.entries(record).forEach(([childKey, value]) => {
    if (childKey === "properties" && typeof value === "object" && value !== null) {
      Object.entries(value as Record<string, unknown>).forEach(([name, schema]) => collectNodes(schema, visit, name));
    } else {
      collectNodes(value, visit, null);
    }
  });
}

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;

beforeEach(() => {
  CONSOLE_METHODS.forEach((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
});

afterEach(() => {
  CONSOLE_METHODS.forEach((method) => expect(console[method]).not.toHaveBeenCalled());
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Provider-facing schema (D6)
// ---------------------------------------------------------------------------

describe("buildProviderSchema", () => {
  const schema = buildProviderSchema();
  const serialized = JSON.stringify(schema);

  it("uses anyOf and documented keywords only", () => {
    expect(serialized).not.toContain('"oneOf"');
    expect(serialized).not.toContain('"additionalProperties"');
    expect(serialized).not.toContain('"$schema"');
    expect(serialized).not.toContain('"const"');
    expect(serialized).not.toContain('"minLength"');
    expect(serialized).not.toContain('"maxLength"');
    expect(Array.isArray(schema.anyOf)).toBe(true);
    expect((schema.anyOf as unknown[]).length).toBe(3);
  });

  it("keeps minimum 1 on qty but never a maximum, so the decoder cannot clamp", () => {
    const qtyNodes: Record<string, unknown>[] = [];
    collectNodes(schema, (record, key) => {
      if (key === "qty") qtyNodes.push(record);
    });
    expect(qtyNodes.length).toBeGreaterThanOrEqual(2);
    for (const node of qtyNodes) {
      expect(node.type).toBe("integer");
      expect(node.minimum).toBe(1);
      expect(node).not.toHaveProperty("maximum");
    }
    expect(serialized).not.toContain('"maximum"');
  });

  it("retains the three kind literals, the item and modifier enums, and the reject codes", () => {
    const enums: unknown[][] = [];
    collectNodes(schema, (record) => {
      if (Array.isArray(record.enum)) enums.push(record.enum);
    });
    const flattened = enums.flat();
    expect(flattened).toEqual(expect.arrayContaining(["proposal", "clarify", "reject"]));
    expect(enums).toContainEqual(["burger", "fries", "lemonade"]);
    expect(enums).toContainEqual(["no_onions", "double", "extra_cheese"]);
    expect(enums).toContainEqual([...CORE_CODES]);
    expect(enums).toContainEqual(["last"]);
    expect(enums).toContainEqual(["item"]);
    expect(flattened).not.toContain("line");
  });

  it("keeps array bounds and required lists", () => {
    expect(serialized).toContain('"minItems":1');
    expect(serialized).toContain('"maxItems":8');
    expect(serialized).toContain('"maxItems":3');
    expect(serialized).toContain('"required"');
  });

  it("still admits valid results and rejects forged ids when re-read as a schema", () => {
    const roundTrip = z.fromJSONSchema(schema as Parameters<typeof z.fromJSONSchema>[0]);
    expect(roundTrip.safeParse(threeItemProposal).success).toBe(true);
    expect(roundTrip.safeParse({ kind: "reject", code: "OFF_MENU", message: "No pizza here." }).success).toBe(true);
    const forged = { kind: "proposal", ops: [{ type: "ADD", itemId: "free_burger", qty: 1, modifiers: [] }] };
    expect(roundTrip.safeParse(forged).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// System instruction
// ---------------------------------------------------------------------------

describe("buildSystemInstruction", () => {
  const instruction = buildSystemInstruction();

  it("lists every item id, alias, label, and modifier id", () => {
    for (const item of Object.values(MENU)) {
      expect(instruction).toContain(item.id);
      expect(instruction).toContain(item.label);
      for (const alias of item.aliases) expect(instruction).toContain(alias);
    }
    for (const modifier of Object.values(MODIFIERS)) {
      expect(instruction).toContain(modifier.id);
      expect(instruction).toContain(modifier.label);
    }
  });

  it("names the reject codes and the never-clamp rule", () => {
    for (const code of CORE_CODES) expect(instruction).toContain(code);
    expect(instruction).toContain("QUANTITY_LIMIT");
    expect(instruction).toMatch(/never clamp/i);
    expect(instruction).toContain('{"by":"last"}');
    expect(instruction).toContain('{"by":"item"');
    expect(instruction).toMatch(/LAST statement wins/);
    expect(instruction).toMatch(/ONLY operation/);
  });

  it("contains no prices, currency, or cart state", () => {
    expect(instruction).not.toMatch(/\b(800|300|250|100)\b/);
    expect(instruction).not.toContain("$");
    expect(instruction).not.toContain("priceCents");
    expect(instruction).not.toMatch(/cents/i);
  });
});

// ---------------------------------------------------------------------------
// Request shape
// ---------------------------------------------------------------------------

describe("provider request", () => {
  it("posts only the transcript, menu, and schema to the model endpoint with the key in the header", async () => {
    const fetchImpl = modelReturns(threeItemProposal);
    await parseGemini(request, config(fetchImpl));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as [string, FetchInit];
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe(API_KEY);
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    const serialized = init?.body as string;
    expect(serialized).not.toContain(API_KEY);
    expect(serialized).not.toContain("priceCents");
    expect(serialized).not.toContain("requestId");
    expect(serialized).not.toContain("baseRevision");

    const body = JSON.parse(serialized) as {
      systemInstruction: { parts: { text: string }[] };
      contents: { role: string; parts: { text: string }[] }[];
      generationConfig: Record<string, unknown>;
    };
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: TRANSCRIPT }] }]);
    expect(body.systemInstruction.parts[0].text).toBe(buildSystemInstruction());
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema).toEqual(buildProviderSchema());
    expect(body.generationConfig.temperature).toBe(0);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(body.generationConfig.maxOutputTokens).toBe(512);
  });
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe("successful parse", () => {
  it("returns the validated candidate JSON, usage, raw text, and latency", async () => {
    const outcome = await parseGemini(request, config(modelReturns(threeItemProposal)));
    expect(outcome.result).toEqual(threeItemProposal);
    expect(outcome.usage).toEqual({ promptTokens: 900, candidateTokens: 40, totalTokens: 940 });
    expect(outcome.rawText).toBe(JSON.stringify(threeItemProposal));
    expect(outcome.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("reports usage as null when the provider omits usageMetadata", async () => {
    const body = providerBody(JSON.stringify(threeItemProposal), { usageMetadata: undefined });
    const outcome = await parseGemini(request, config(respond(200, body)));
    expect(outcome.usage).toBeNull();
  });

  it("ignores thought parts and concatenates text parts", async () => {
    const text = JSON.stringify(threeItemProposal);
    const body = {
      candidates: [{ content: { parts: [{ text: "thinking", thought: true }, { text: text.slice(0, 10) }, { text: text.slice(10) }] }, finishReason: "STOP" }],
    };
    const outcome = await parseGemini(request, config(respond(200, body)));
    expect(outcome.result).toEqual(threeItemProposal);
  });

  it.each([
    ["reject", { kind: "reject", code: "OFF_MENU", message: "Sorry, pizza is not on the menu." }],
    [
      "clarify",
      {
        kind: "clarify",
        question: "Did you mean lemonade?",
        choices: [{ id: "c1", label: "Lemonade", ops: [{ type: "ADD", itemId: "lemonade", qty: 1, modifiers: [] }] }],
      },
    ],
    ["standalone undo", { kind: "proposal", ops: [{ type: "UNDO" }] }],
    ["last reference", { kind: "proposal", ops: [{ type: "SET_QTY", ref: { by: "last" }, qty: 2 }] }],
    [
      "modifier on a named item",
      { kind: "proposal", ops: [{ type: "MOD", ref: { by: "item", itemId: "burger" }, modifier: "double", enabled: true }] },
    ],
    // D1: pairings are the engine's job; the adapter only enforces shape, enums, and bounds.
    ["double on lemonade (engine rejects later)", { kind: "proposal", ops: [{ type: "ADD", itemId: "lemonade", qty: 1, modifiers: ["double"] }] }],
  ])("passes a valid %s result through unchanged", async (_label, result) => {
    const outcome = await parseGemini(request, config(modelReturns(result)));
    expect(outcome.result).toEqual(result);
  });
});

// ---------------------------------------------------------------------------
// Transport failures
// ---------------------------------------------------------------------------

describe("transport failures", () => {
  it.each([
    [429, "RATE_LIMITED", 429, true],
    [500, "PROVIDER_UNAVAILABLE", 503, true],
    [503, "PROVIDER_UNAVAILABLE", 503, true],
    [400, "PROVIDER_UNAVAILABLE", 503, true],
    [401, "PROVIDER_UNAVAILABLE", 503, true],
    [403, "PROVIDER_UNAVAILABLE", 503, true],
    [404, "PROVIDER_UNAVAILABLE", 503, true],
  ])("maps HTTP %i to %s", async (http, code, status, retryable) => {
    const error = await failure(respond(http, { error: { message: "provider detail" } }));
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.retryable).toBe(retryable);
    expect(error.message).not.toContain(API_KEY);
    expect(error.message).not.toContain(TRANSCRIPT);
  });

  it("maps a network TypeError to PROVIDER_UNAVAILABLE", async () => {
    const fetchImpl: typeof fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const error = await failure(fetchImpl);
    expect(error.code).toBe("PROVIDER_UNAVAILABLE");
    expect(error.retryable).toBe(true);
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  it("turns its own deadline into PARSE_TIMEOUT even if fetch ignores the signal", async () => {
    const fetchImpl: typeof fetch = vi.fn(() => new Promise<Response>(() => undefined));
    const error = await failure(fetchImpl, { timeoutMs: 20 });
    expect(error.code).toBe("PARSE_TIMEOUT");
    expect(error.status).toBe(504);
    expect(error.retryable).toBe(true);
    const [, init] = vi.mocked(fetchImpl).mock.calls[0] as [string, FetchInit];
    expect(init?.signal?.aborted).toBe(true);
  });

  it("rethrows a pre-aborted external signal untouched without calling fetch", async () => {
    const fetchImpl = modelReturns(threeItemProposal);
    const controller = new AbortController();
    controller.abort();
    const attempt = parseGemini(request, config(fetchImpl, { signal: controller.signal }));
    await expect(attempt).rejects.toMatchObject({ name: "AbortError" });
    await expect(attempt).rejects.not.toBeInstanceOf(GeminiError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rethrows the caller's exact abort reason when cancelled mid-flight", async () => {
    const reason = new DOMException("Barge-in", "AbortError");
    const controller = new AbortController();
    const fetchImpl: typeof fetch = vi.fn(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const attempt = parseGemini(request, config(fetchImpl, { signal: controller.signal }));
    setTimeout(() => controller.abort(reason), 5);
    await expect(attempt).rejects.toBe(reason);
  });

  it("does not misreport an external abort as a timeout or provider failure", async () => {
    const controller = new AbortController();
    const fetchImpl: typeof fetch = vi.fn(() => new Promise<Response>(() => undefined));
    const attempt = parseGemini(request, config(fetchImpl, { signal: controller.signal, timeoutMs: 5_000 }));
    setTimeout(() => controller.abort(new Error("user cancelled")), 5);
    await expect(attempt).rejects.toThrow("user cancelled");
    await expect(attempt).rejects.not.toBeInstanceOf(GeminiError);
  });
});

// ---------------------------------------------------------------------------
// Malformed provider responses
// ---------------------------------------------------------------------------

describe("malformed provider responses", () => {
  it.each([
    ["body that is not JSON", "<html>oops</html>"],
    ["body with the wrong shape", { candidates: "nope" }],
    ["blocked prompt", { promptFeedback: { blockReason: "SAFETY" } }],
    ["missing candidates", {}],
    ["empty candidates", { candidates: [] }],
    ["finishReason MAX_TOKENS", providerBody('{"kind":"proposal"', { candidates: [{ content: { parts: [{ text: '{"kind":"proposal"' }] }, finishReason: "MAX_TOKENS" }] })],
    ["finishReason SAFETY", { candidates: [{ finishReason: "SAFETY" }] }],
    ["empty parts", { candidates: [{ content: { parts: [] }, finishReason: "STOP" }] }],
    ["whitespace text", providerBody("   ")],
    ["prose instead of JSON", providerBody("Sure! I added a burger for you.")],
    ["JSON wrapped in a markdown fence", providerBody("```json\n{\"kind\":\"proposal\"}\n```")],
  ])("rejects %s with INVALID_MODEL_OUTPUT", async (_label, body) => {
    const error = await failure(respond(200, body));
    expect(error.code).toBe("INVALID_MODEL_OUTPUT");
    expect(error.status).toBe(502);
    expect(error.retryable).toBe(false);
    expect(error.message).not.toContain(API_KEY);
    expect(error.message).not.toContain(TRANSCRIPT);
  });
});

// ---------------------------------------------------------------------------
// Injection canaries: illegal model output never leaks through
// ---------------------------------------------------------------------------

describe("illegal model output", () => {
  const add = (overrides: Record<string, unknown>) => ({ type: "ADD", itemId: "burger", qty: 1, modifiers: [], ...overrides });

  it.each([
    ["forged itemId", { kind: "proposal", ops: [add({ itemId: "free_burger" })] }],
    ["forged modifier", { kind: "proposal", ops: [add({ modifiers: ["bacon"] })] }],
    ["duplicate modifier", { kind: "proposal", ops: [add({ modifiers: ["double", "double"] })] }],
    ["extra key price", { kind: "proposal", ops: [add({ price: 0 })] }],
    ["extra top-level key", { kind: "proposal", ops: [add({})], discount: "100%" }],
    ["qty 18000", { kind: "proposal", ops: [add({ qty: 18000 })] }],
    ["qty 6", { kind: "proposal", ops: [add({ qty: 6 })] }],
    ["qty 0", { kind: "proposal", ops: [add({ qty: 0 })] }],
    ["fractional qty", { kind: "proposal", ops: [add({ qty: 1.5 })] }],
    ["line reference", { kind: "proposal", ops: [{ type: "REMOVE", ref: { by: "line", lineId: "u1:0" } }] }],
    ["unknown op type", { kind: "proposal", ops: [{ type: "CONFIRM" }] }],
    ["reject code FREE", { kind: "reject", code: "FREE", message: "Everything is free." }],
    ["reject with an HTTP code", { kind: "reject", code: "INVALID_REQUEST", message: "nope" }],
    ["empty ops", { kind: "proposal", ops: [] }],
    ["nine ops", { kind: "proposal", ops: Array.from({ length: 9 }, () => add({})) }],
    ["UNDO plus ADD", { kind: "proposal", ops: [{ type: "UNDO" }, add({})] }],
    ["four choices", {
      kind: "clarify",
      question: "Which?",
      choices: ["c1", "c2", "c3", "c4"].map((id) => ({ id, label: id, ops: [add({})] })),
    }],
    ["duplicate choice ids", {
      kind: "clarify",
      question: "Which?",
      choices: [{ id: "c1", label: "A", ops: [add({})] }, { id: "c1", label: "B", ops: [add({})] }],
    }],
    ["overlong message", { kind: "reject", code: "UNSUPPORTED", message: "x".repeat(161) }],
    ["unknown kind", { kind: "note", message: "Later." }],
    ["array instead of object", [threeItemProposal]],
    ["confidence score smuggled in", { ...threeItemProposal, confidence: 0.99 }],
  ])("rejects %s with INVALID_MODEL_OUTPUT", async (_label, result) => {
    const error = await failure(modelReturns(result));
    expect(error.code).toBe("INVALID_MODEL_OUTPUT");
    expect(error.status).toBe(502);
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("failed validation");
    expect(error.message).not.toContain(API_KEY);
    expect(error.message).not.toContain(TRANSCRIPT);
    expect(error.message.length).toBeLessThanOrEqual(160);
  });
});

// ---------------------------------------------------------------------------
// GeminiError contract
// ---------------------------------------------------------------------------

describe("GeminiError", () => {
  it.each([
    ["RATE_LIMITED", 429, true],
    ["PROVIDER_UNAVAILABLE", 503, true],
    ["PARSE_TIMEOUT", 504, true],
    ["INVALID_MODEL_OUTPUT", 502, false],
  ] as const)("%s carries status %i and retryable=%s", (code, status, retryable) => {
    const error = new GeminiError(code, "detail");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("GeminiError");
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.retryable).toBe(retryable);
    expect(error.message).toBe("detail");
  });

  it("preserves the cause and clips long messages", () => {
    const cause = new Error("root");
    const error = new GeminiError("PROVIDER_UNAVAILABLE", "y".repeat(500), cause);
    expect(error.cause).toBe(cause);
    expect(error.message.length).toBeLessThanOrEqual(160);
  });
});
