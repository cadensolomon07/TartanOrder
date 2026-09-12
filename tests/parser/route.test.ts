import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/interpret/route";
import { ApiErrorSchema, LIMITS, ParseResponseSchema, type ApiError, type ParseResult } from "../../src/contracts";
import { FIXTURE_REQUEST, FIXTURE_RESPONSE } from "../../src/contracts/fixtures";
import { GeminiError, parseGemini, type GeminiConfig, type GeminiOutcome } from "../../src/parser/gemini.server";

vi.mock("@/parser/gemini.server", () => {
  class MockGeminiError extends Error {}
  return { GeminiError: MockGeminiError, parseGemini: vi.fn() };
});

// The rules module is used unmocked: the fixture and guard tests exercise the real grammar.

const URL = "http://localhost/api/interpret";
const TIMING = /^validate;dur=\d+(\.\d+)?, provider;dur=\d+(\.\d+)?, total;dur=\d+(\.\d+)?$/;
const FIXTURE_TEXT = FIXTURE_REQUEST.text;
const KEY = "test-key-never-logged";

const geminiProposal: ParseResult = {
  kind: "proposal",
  ops: [
    { type: "ADD", itemId: "burger", qty: 1, modifiers: [] },
    { type: "ADD", itemId: "fries", qty: 1, modifiers: [] },
    { type: "ADD", itemId: "lemonade", qty: 1, modifiers: [] },
  ],
};

function outcome(result: ParseResult): GeminiOutcome {
  return {
    result,
    usage: { promptTokens: 100, candidateTokens: 20, totalTokens: 120 },
    latencyMs: 42,
    rawText: JSON.stringify(result),
  };
}

/** Builds a GeminiError through the prototype so the test never depends on its constructor shape. */
function geminiError(code: GeminiError["code"], status: GeminiError["status"], retryable: boolean): GeminiError {
  return Object.assign(Object.create(GeminiError.prototype) as GeminiError, { name: "GeminiError", message: code, code, status, retryable });
}

function post(body: string, init: { headers?: Record<string, string>; signal?: AbortSignal } = {}): Promise<Response> {
  return POST(new Request(URL, { method: "POST", body, headers: { "content-type": "application/json", ...init.headers }, signal: init.signal }));
}

function postJson(value: unknown, init?: { headers?: Record<string, string>; signal?: AbortSignal }): Promise<Response> {
  return post(JSON.stringify(value), init);
}

/** ASCII-only request JSON padded so the body is exactly `bytes` long. */
function bodyOfBytes(bytes: number): string {
  const skeleton = JSON.stringify({ ...FIXTURE_REQUEST, text: "" });
  const body = JSON.stringify({ ...FIXTURE_REQUEST, text: "a".repeat(bytes - skeleton.length) });
  expect(new TextEncoder().encode(body).byteLength).toBe(bytes);
  return body;
}

async function expectApiError(res: Response, status: number, code: ApiError["error"]["code"], retryable: boolean): Promise<ApiError> {
  expect(res.status).toBe(status);
  expect(res.headers.get("server-timing")).toMatch(TIMING);
  const body: unknown = await res.json();
  const parsed = ApiErrorSchema.safeParse(body);
  expect(parsed.success).toBe(true);
  if (!parsed.success) throw new Error("unreachable");
  expect(parsed.data.error.code).toBe(code);
  expect(parsed.data.error.retryable).toBe(retryable);
  return parsed.data;
}

/** Resolves once the mocked provider has been invoked, handing back the config it received. */
function providerCalled(): { config: Promise<GeminiConfig>; hang: (settle: (config: GeminiConfig) => Promise<GeminiOutcome>) => void } {
  let resolveConfig!: (config: GeminiConfig) => void;
  const config = new Promise<GeminiConfig>((resolve) => {
    resolveConfig = resolve;
  });
  return {
    config,
    hang: (settle) =>
      vi.mocked(parseGemini).mockImplementation((_req, received) => {
        resolveConfig(received);
        return settle(received);
      }),
  };
}

let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("PARSER_MODE", "rules");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("GEMINI_MODEL", "");
  vi.mocked(parseGemini).mockReset();
  info = vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function loggedLine(): Record<string, unknown> {
  expect(info).toHaveBeenCalledTimes(1);
  const [raw] = info.mock.calls[0];
  return JSON.parse(String(raw)) as Record<string, unknown>;
}

describe("POST /api/interpret: admission", () => {
  it("rejects a blank transcript with 400 and echoes the requestId", async () => {
    const res = await postJson({ ...FIXTURE_REQUEST, text: "   " });
    const body = await expectApiError(res, 400, "INVALID_REQUEST", false);
    expect(body.requestId).toBe("u1");
  });

  it("rejects a 4097-byte body with 413 when no content-length is declared", async () => {
    const res = await post(bodyOfBytes(LIMITS.requestBytes + 1));
    await expectApiError(res, 413, "INPUT_TOO_LARGE", false);
  });

  it("rejects a 4097-byte body with 413 even when content-length lies", async () => {
    const res = await post(bodyOfBytes(LIMITS.requestBytes + 1), { headers: { "content-length": "10" } });
    await expectApiError(res, 413, "INPUT_TOO_LARGE", false);
  });

  it("rejects an oversize declared content-length with 413 before reading", async () => {
    const res = await postJson(FIXTURE_REQUEST, { headers: { "content-length": String(LIMITS.requestBytes + 1) } });
    await expectApiError(res, 413, "INPUT_TOO_LARGE", false);
  });

  it("lets exactly 4096 bytes through the byte gate (then fails the 500-char schema bound with 400)", async () => {
    const res = await post(bodyOfBytes(LIMITS.requestBytes));
    await expectApiError(res, 400, "INVALID_REQUEST", false);
  });

  it("rejects a 501-character transcript with 400 (schema bound, not 413)", async () => {
    const res = await postJson({ ...FIXTURE_REQUEST, text: "a".repeat(LIMITS.transcriptChars + 1) });
    await expectApiError(res, 400, "INVALID_REQUEST", false);
  });

  it("rejects v:2 with 400", async () => {
    const res = await postJson({ ...FIXTURE_REQUEST, v: 2 });
    await expectApiError(res, 400, "INVALID_REQUEST", false);
  });

  it("rejects a foreign menu version with 409 before the strict schema", async () => {
    const res = await postJson({ ...FIXTURE_REQUEST, menuVersion: "demo-v2", extra: true });
    const body = await expectApiError(res, 409, "MENU_VERSION_MISMATCH", false);
    expect(body.requestId).toBe("u1");
  });

  it("rejects an extra key with 400", async () => {
    const res = await postJson({ ...FIXTURE_REQUEST, price: 0 });
    await expectApiError(res, 400, "INVALID_REQUEST", false);
  });

  it("rejects malformed JSON with 400 and a null requestId", async () => {
    const res = await post("{not json");
    const body = await expectApiError(res, 400, "INVALID_REQUEST", false);
    expect(body.requestId).toBeNull();
  });

  it("rejects an empty body with 400", async () => {
    const res = await POST(new Request(URL, { method: "POST" }));
    await expectApiError(res, 400, "INVALID_REQUEST", false);
  });

  it("does not echo a requestId that itself violates the ID bound", async () => {
    const res = await postJson({ ...FIXTURE_REQUEST, requestId: "x".repeat(LIMITS.idChars + 1) });
    const body = await expectApiError(res, 400, "INVALID_REQUEST", false);
    expect(body.requestId).toBeNull();
  });

  it("logs one structured line for an error without the transcript", async () => {
    await postJson({ ...FIXTURE_REQUEST, text: "   " });
    const line = loggedLine();
    expect(line).toMatchObject({ event: "interpret", mode: "rules", outcome: "error", code: "INVALID_REQUEST", requestId: "u1" });
    expect(JSON.stringify(line)).not.toContain("   \"");
  });
});

describe("POST /api/interpret: rules mode", () => {
  it("answers the u1 fixture with the fixture operations labelled parser rules", async () => {
    const res = await postJson(FIXTURE_REQUEST);
    expect(res.status).toBe(200);
    expect(res.headers.get("server-timing")).toMatch(TIMING);
    const body: unknown = await res.json();
    const parsed = ParseResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("unreachable");
    expect(parsed.data.parser).toBe("rules");
    expect(parsed.data.fallbackReason).toBeNull();
    expect(parsed.data.requestId).toBe(FIXTURE_REQUEST.requestId);
    expect(parsed.data.baseRevision).toBe(FIXTURE_REQUEST.baseRevision);
    expect(parsed.data.menuVersion).toBe(FIXTURE_REQUEST.menuVersion);
    expect(parsed.data.result.kind).toBe("proposal");
    if (parsed.data.result.kind !== "proposal" || FIXTURE_RESPONSE.result.kind !== "proposal") throw new Error("unreachable");
    expect(parsed.data.result.ops).toEqual(FIXTURE_RESPONSE.result.ops);
  });

  it("stays in rules mode for any PARSER_MODE other than gemini and never calls the provider", async () => {
    vi.stubEnv("PARSER_MODE", "fixture");
    vi.stubEnv("GEMINI_API_KEY", KEY);
    const res = await postJson(FIXTURE_REQUEST);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { parser: string }).parser).toBe("rules");
    expect(parseGemini).not.toHaveBeenCalled();
  });

  it("logs one structured line without shadow fields, transcript, or headers", async () => {
    await postJson(FIXTURE_REQUEST);
    const line = loggedLine();
    expect(line).toMatchObject({ event: "interpret", requestId: "u1", mode: "rules", outcome: "proposal", code: null, providerMs: 0, tokens: null });
    expect(typeof line.latencyMs).toBe("number");
    expect(line).not.toHaveProperty("shadowAgree");
    expect(JSON.stringify(line)).not.toContain(FIXTURE_TEXT);
    expect(JSON.stringify(line)).not.toContain("content-type");
  });
});

describe("POST /api/interpret: gemini mode", () => {
  beforeEach(() => {
    vi.stubEnv("PARSER_MODE", "gemini");
    vi.stubEnv("GEMINI_API_KEY", KEY);
  });

  it("answers 503 PROVIDER_UNAVAILABLE retryable without a key and never calls the provider", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await postJson(FIXTURE_REQUEST);
    const body = await expectApiError(res, 503, "PROVIDER_UNAVAILABLE", true);
    expect(body.requestId).toBe("u1");
    expect(parseGemini).not.toHaveBeenCalled();
  });

  it("wraps a provider result in an application-built gemini envelope", async () => {
    vi.mocked(parseGemini).mockResolvedValue(outcome(geminiProposal));
    const res = await postJson(FIXTURE_REQUEST);
    expect(res.status).toBe(200);
    expect(res.headers.get("server-timing")).toMatch(TIMING);
    const body: unknown = await res.json();
    const parsed = ParseResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(body).toEqual({ ...FIXTURE_RESPONSE, parser: "gemini", result: geminiProposal });
  });

  it("passes the key, default model, a bounded timeout, and an abort signal to the adapter", async () => {
    vi.mocked(parseGemini).mockResolvedValue(outcome(geminiProposal));
    await postJson(FIXTURE_REQUEST);
    expect(parseGemini).toHaveBeenCalledTimes(1);
    const [req, config] = vi.mocked(parseGemini).mock.calls[0];
    expect(req).toEqual(FIXTURE_REQUEST);
    expect(config.apiKey).toBe(KEY);
    expect(config.model).toBe("gemini-2.5-flash");
    expect(config.timeoutMs).toBeGreaterThan(0);
    expect(config.timeoutMs).toBeLessThanOrEqual(4500);
    expect(config.signal).toBeInstanceOf(AbortSignal);
  });

  it("honours GEMINI_MODEL when set", async () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash-lite");
    vi.mocked(parseGemini).mockResolvedValue(outcome(geminiProposal));
    await postJson(FIXTURE_REQUEST);
    expect(vi.mocked(parseGemini).mock.calls[0][1].model).toBe("gemini-2.5-flash-lite");
  });

  it("logs shadow agreement and token usage but never the transcript or key", async () => {
    vi.mocked(parseGemini).mockResolvedValue(outcome(geminiProposal));
    await postJson(FIXTURE_REQUEST);
    const line = loggedLine();
    expect(line).toMatchObject({ mode: "gemini", outcome: "proposal", code: null, shadowAgree: true, shadowKind: "proposal", tokens: { promptTokens: 100, candidateTokens: 20, totalTokens: 120 } });
    expect(typeof line.providerMs).toBe("number");
    const raw = JSON.stringify(line);
    expect(raw).not.toContain(FIXTURE_TEXT);
    expect(raw).not.toContain(KEY);
  });

  it("reports shadow disagreement when the model and rules differ", async () => {
    vi.mocked(parseGemini).mockResolvedValue(outcome({ kind: "proposal", ops: [{ type: "ADD", itemId: "burger", qty: 1, modifiers: [] }] }));
    await postJson(FIXTURE_REQUEST);
    expect(loggedLine()).toMatchObject({ shadowAgree: false, shadowKind: "proposal" });
  });

  it("answers 502 INVALID_MODEL_OUTPUT when the adapter result fails the shared contract", async () => {
    const forged = { kind: "proposal", ops: [{ type: "ADD", itemId: "burger", qty: 99, modifiers: [] }] } as ParseResult;
    vi.mocked(parseGemini).mockResolvedValue(outcome(forged));
    const res = await postJson(FIXTURE_REQUEST);
    await expectApiError(res, 502, "INVALID_MODEL_OUTPUT", false);
  });

  it.each([
    ["RATE_LIMITED", 429, true],
    ["PROVIDER_UNAVAILABLE", 503, true],
    ["PARSE_TIMEOUT", 504, true],
    ["INVALID_MODEL_OUTPUT", 502, false],
  ] as const)("maps GeminiError %s to HTTP %i (retryable %s)", async (code, status, retryable) => {
    vi.mocked(parseGemini).mockRejectedValue(geminiError(code, status, retryable));
    const res = await postJson(FIXTURE_REQUEST);
    const body = await expectApiError(res, status, code, retryable);
    expect(body.requestId).toBe("u1");
    expect(loggedLine()).toMatchObject({ mode: "gemini", outcome: "error", code });
  });

  it("never marks a 502 retryable even if the adapter says so", async () => {
    vi.mocked(parseGemini).mockRejectedValue(geminiError("INVALID_MODEL_OUTPUT", 502, true));
    const res = await postJson(FIXTURE_REQUEST);
    await expectApiError(res, 502, "INVALID_MODEL_OUTPUT", false);
  });

  it("answers 502 INVALID_MODEL_OUTPUT for an unexpected adapter exception", async () => {
    vi.mocked(parseGemini).mockRejectedValue(new Error("boom"));
    const res = await postJson(FIXTURE_REQUEST);
    await expectApiError(res, 502, "INVALID_MODEL_OUTPUT", false);
  });

  it("answers 504 PARSE_TIMEOUT at the 5 s server deadline even if the adapter ignores its signal", async () => {
    vi.useFakeTimers();
    const provider = providerCalled();
    provider.hang(() => new Promise<GeminiOutcome>(() => undefined));
    const pending = postJson(FIXTURE_REQUEST);
    await provider.config;
    await vi.advanceTimersByTimeAsync(LIMITS.serverTimeoutMs);
    const res = await pending;
    const body = await expectApiError(res, 504, "PARSE_TIMEOUT", true);
    expect(body.requestId).toBe("u1");
    expect((await provider.config).signal?.aborted).toBe(true);
  });

  it("returns a bare 499 and aborts the provider when the client disconnects mid-call", async () => {
    const controller = new AbortController();
    const provider = providerCalled();
    provider.hang(
      (config) =>
        new Promise<GeminiOutcome>((_resolve, reject) => {
          config.signal?.addEventListener("abort", () => reject(config.signal?.reason), { once: true });
        }),
    );
    const pending = postJson(FIXTURE_REQUEST, { signal: controller.signal });
    const config = await provider.config;
    controller.abort();
    const res = await pending;
    expect(res.status).toBe(499);
    expect(await res.text()).toBe("");
    expect(config.signal?.aborted).toBe(true);
    expect(info).not.toHaveBeenCalled();
  });

  it("lets the rules quantity guard reject 18,000 lemonades before any model call", async () => {
    vi.mocked(parseGemini).mockResolvedValue(outcome(geminiProposal));
    const res = await postJson({ ...FIXTURE_REQUEST, text: "18,000 lemonades" });
    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    const parsed = ParseResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("unreachable");
    expect(parsed.data.parser).toBe("rules");
    expect(parsed.data.fallbackReason).toBeNull();
    expect(parsed.data.result).toMatchObject({ kind: "reject", code: "QUANTITY_LIMIT" });
    expect(parseGemini).not.toHaveBeenCalled();
    expect(loggedLine()).toMatchObject({ mode: "gemini", outcome: "reject", code: "QUANTITY_LIMIT" });
    expect(JSON.stringify(loggedLine())).not.toContain("18,000");
  });
});
