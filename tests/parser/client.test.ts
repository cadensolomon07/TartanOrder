import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_VERSION,
  ApiErrorSchema,
  ParseResponseSchema,
  type ApiError,
  type ParseRequest,
  type ParseResponse,
} from "../../src/contracts";
import { CATALOG, MENU_VERSION } from "../helpers/catalog";
import { InterpretError, interpret, interpretWith, type InterpretDeps } from "../../src/parser/client";
import { parseRules } from "../../src/parser/rules";

vi.mock("@/parser/rules", () => ({
  parseRules: vi.fn(
    (req: ParseRequest): ParseResponse => ({
      v: API_VERSION,
      requestId: req.requestId,
      baseRevision: req.baseRevision,
      menuVersion: MENU_VERSION,
      parser: "rules",
      fallbackReason: null,
      result: { kind: "proposal", ops: [{ type: "ADD", itemId: "fries", qty: 1, modifiers: [] }] },
    }),
  ),
}));

const request: ParseRequest = {
  v: API_VERSION,
  requestId: "r7",
  baseRevision: 3,
  menuVersion: MENU_VERSION,
  text: "a burger and fries",
  source: "text",
  asrConfidence: null,
};

const geminiResponse: ParseResponse = {
  v: API_VERSION,
  requestId: "r7",
  baseRevision: 3,
  menuVersion: MENU_VERSION,
  parser: "gemini",
  fallbackReason: null,
  result: {
    kind: "proposal",
    ops: [
      { type: "ADD", itemId: "burger", qty: 1, modifiers: [] },
      { type: "ADD", itemId: "fries", qty: 1, modifiers: [] },
    ],
  },
};

function apiError(code: ApiError["error"]["code"], retryable: boolean, requestId: string | null = "r7"): ApiError {
  return ApiErrorSchema.parse({ v: API_VERSION, requestId, error: { code, message: `Server said ${code}.`, retryable } });
}

function respondingWith(status: number, body: unknown, raw = false): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>(async () =>
    raw ? new Response(String(body), { status }) : Response.json(body, { status }),
  );
}

/**
 * A fetch whose body read schedules the caller's cancellation to land after the exchange
 * has settled but before the client resumes — A's "cancellation as the body settles".
 */
function abortingAsBodySettles(status: number, body: unknown, controller: AbortController): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>(async () => {
    const response = Response.json(body, { status });
    const readText = response.text.bind(response);
    return Object.assign(response, {
      text: async () => {
        const text = await readText();
        void Promise.resolve()
          .then(() => undefined)
          .then(() => controller.abort());
        return text;
      },
    });
  });
}

/** A fetch that only settles when its signal aborts, like a stalled network call. */
function hanging(): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      }),
  );
}

function deps(fetchImpl: typeof fetch, overrides: Partial<InterpretDeps> = {}): InterpretDeps {
  return { fetchImpl, timeoutMs: 1000, isOnline: () => true, ...overrides };
}

async function expectInterpretError(promise: Promise<unknown>): Promise<InterpretError> {
  const error = await promise.then(
    () => new Error("resolved"),
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(InterpretError);
  return error as InterpretError;
}

beforeEach(() => {
  vi.mocked(parseRules).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("interpretWith: successful exchange", () => {
  it("returns a gemini-labelled 200 body untouched", async () => {
    const fetchImpl = respondingWith(200, geminiResponse);
    const result = await interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl));
    expect(result).toEqual(geminiResponse);
    expect(ParseResponseSchema.safeParse(result).success).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(parseRules).not.toHaveBeenCalled();
  });

  it("posts the JSON request to /api/interpret with the content-type header", async () => {
    const fetchImpl = respondingWith(200, geminiResponse);
    await interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl));
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/interpret");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual(request);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects a 200 body that fails the shared schema with INVALID_MODEL_OUTPUT", async () => {
    // V3 item IDs are bounded strings: an unknown menu item is the engine's OFF_MENU decision,
    // so the forged body must break the shape itself (a zero quantity) to fail the shared schema.
    const forged = { ...geminiResponse, result: { kind: "proposal", ops: [{ type: "ADD", itemId: "pizza", qty: 0, modifiers: [] }] } };
    const fetchImpl = respondingWith(200, forged);
    const error = await expectInterpretError(interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl)));
    expect(error.code).toBe("INVALID_MODEL_OUTPUT");
    expect(error.status).toBe(502);
    expect(error.retryable).toBe(false);
    expect(parseRules).not.toHaveBeenCalled();
  });

  it("rejects a 200 body that is not JSON", async () => {
    const fetchImpl = respondingWith(200, "<html>", true);
    const error = await expectInterpretError(interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl)));
    expect(error.code).toBe("INVALID_MODEL_OUTPUT");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["requestId", { requestId: "r8" }],
    ["baseRevision", { baseRevision: 4 }],
  ])("rejects a 200 body whose %s does not echo the request", async (_field, patch) => {
    const fetchImpl = respondingWith(200, { ...geminiResponse, ...patch });
    const error = await expectInterpretError(interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl)));
    expect(error.code).toBe("INVALID_MODEL_OUTPUT");
    expect(error.status).toBe(502);
    expect(parseRules).not.toHaveBeenCalled();
  });
});

describe("interpretWith: labelled rules fallback", () => {
  it.each([
    [429, "RATE_LIMITED"],
    [503, "PROVIDER_UNAVAILABLE"],
    [504, "PARSE_TIMEOUT"],
  ] as const)("falls back on %i using the ApiError code %s", async (status, code) => {
    const fetchImpl = respondingWith(status, apiError(code, true));
    const result = await interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl));
    expect(result.parser).toBe("rules");
    expect(result.fallbackReason).toBe(code);
    expect(result.requestId).toBe(request.requestId);
    expect(ParseResponseSchema.safeParse(result).success).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(parseRules).toHaveBeenCalledTimes(1);
    expect(parseRules).toHaveBeenCalledWith(request, CATALOG);
  });

  it.each([
    [429, "RATE_LIMITED"],
    [503, "PROVIDER_UNAVAILABLE"],
    [504, "PARSE_TIMEOUT"],
  ] as const)("falls back on %i with a non-JSON body by mapping the status to %s", async (status, code) => {
    const fetchImpl = respondingWith(status, "upstream text", true);
    const result = await interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl));
    expect(result.parser).toBe("rules");
    expect(result.fallbackReason).toBe(code);
    expect(ParseResponseSchema.safeParse(result).success).toBe(true);
  });

  it("falls back with PARSE_TIMEOUT when the client deadline fires", async () => {
    const fetchImpl = hanging();
    const result = await interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl, { timeoutMs: 20 }));
    expect(result.parser).toBe("rules");
    expect(result.fallbackReason).toBe("PARSE_TIMEOUT");
    expect(ParseResponseSchema.safeParse(result).success).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back with PARSE_TIMEOUT even if the transport ignores its abort signal", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise<Response>(() => undefined));
    const result = await interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl, { timeoutMs: 20 }));
    expect(result.fallbackReason).toBe("PARSE_TIMEOUT");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back with PROVIDER_UNAVAILABLE on a network TypeError", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    const result = await interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl));
    expect(result.parser).toBe("rules");
    expect(result.fallbackReason).toBe("PROVIDER_UNAVAILABLE");
    expect(ParseResponseSchema.safeParse(result).success).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("short-circuits offline to PROVIDER_UNAVAILABLE without fetching", async () => {
    const fetchImpl = respondingWith(200, geminiResponse);
    const started = performance.now();
    const result = await interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl, { isOnline: () => false }));
    expect(performance.now() - started).toBeLessThan(10);
    expect(result.parser).toBe("rules");
    expect(result.fallbackReason).toBe("PROVIDER_UNAVAILABLE");
    expect(ParseResponseSchema.safeParse(result).success).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("interpretWith: cancellation never falls back", () => {
  it("rejects with AbortError before fetching when the signal is already aborted", async () => {
    const fetchImpl = respondingWith(200, geminiResponse);
    const controller = new AbortController();
    controller.abort();
    await expect(interpretWith(request, { localOnly: false, catalog: CATALOG, signal: controller.signal }, deps(fetchImpl))).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(parseRules).not.toHaveBeenCalled();
  });

  it("rejects with AbortError when aborted mid-flight and never runs the rules parser", async () => {
    const fetchImpl = hanging();
    const controller = new AbortController();
    const pending = interpretWith(request, { localOnly: false, catalog: CATALOG, signal: controller.signal }, deps(fetchImpl));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(parseRules).not.toHaveBeenCalled();
  });

  it("prefers AbortError over a fallback when the user cancels during the client deadline window", async () => {
    const fetchImpl = hanging();
    const controller = new AbortController();
    const pending = interpretWith(request, { localOnly: false, catalog: CATALOG, signal: controller.signal }, deps(fetchImpl, { timeoutMs: 20 }));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(parseRules).not.toHaveBeenCalled();
  });

  it("rejects with AbortError when cancellation lands as a 503 body settles, never running the fallback", async () => {
    const controller = new AbortController();
    const fetchImpl = abortingAsBodySettles(503, apiError("PROVIDER_UNAVAILABLE", true), controller);
    const pending = interpretWith(request, { localOnly: false, catalog: CATALOG, signal: controller.signal }, deps(fetchImpl));
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(controller.signal.aborted).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(parseRules).not.toHaveBeenCalled();
  });

  it("rejects with AbortError when cancellation lands as a 200 body settles, never accepting the result", async () => {
    const controller = new AbortController();
    const fetchImpl = abortingAsBodySettles(200, geminiResponse, controller);
    const pending = interpretWith(request, { localOnly: false, catalog: CATALOG, signal: controller.signal }, deps(fetchImpl));
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(parseRules).not.toHaveBeenCalled();
  });
});

describe("interpretWith: structured errors on fallback statuses fail closed unless they match", () => {
  it.each([
    [503, "INVALID_REQUEST"],
    [503, "MENU_VERSION_MISMATCH"],
    [503, "INVALID_MODEL_OUTPUT"],
    [429, "PROVIDER_UNAVAILABLE"],
    [504, "RATE_LIMITED"],
  ] as const)("throws InterpretError for %i carrying a mismatched %s envelope instead of falling back", async (status, code) => {
    const body = apiError(code, false);
    const fetchImpl = respondingWith(status, body);
    const error = await expectInterpretError(interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl)));
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.retryable).toBe(false);
    expect(error.apiError).toEqual(body);
    expect(error.message).toBe(body.error.message);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(parseRules).not.toHaveBeenCalled();
  });

  it("throws for a matching 503 PROVIDER_UNAVAILABLE envelope addressed to a foreign requestId", async () => {
    const body = apiError("PROVIDER_UNAVAILABLE", true, "r8");
    const fetchImpl = respondingWith(503, body);
    const error = await expectInterpretError(interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl)));
    expect(error.code).toBe("PROVIDER_UNAVAILABLE");
    expect(error.status).toBe(503);
    expect(error.retryable).toBe(true);
    expect(error.apiError).toEqual(body);
    expect(parseRules).not.toHaveBeenCalled();
  });

  it("falls back on 503 PROVIDER_UNAVAILABLE for this request even when the envelope says retryable:false", async () => {
    const fetchImpl = respondingWith(503, apiError("PROVIDER_UNAVAILABLE", false));
    const result = await interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl));
    expect(result.parser).toBe("rules");
    expect(result.fallbackReason).toBe("PROVIDER_UNAVAILABLE");
    expect(result.requestId).toBe(request.requestId);
    expect(ParseResponseSchema.safeParse(result).success).toBe(true);
    expect(parseRules).toHaveBeenCalledWith(request, CATALOG);
  });

  it("falls back on a matching envelope whose requestId is null (refused before the id was read)", async () => {
    const fetchImpl = respondingWith(504, apiError("PARSE_TIMEOUT", true, null));
    const result = await interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl));
    expect(result.parser).toBe("rules");
    expect(result.fallbackReason).toBe("PARSE_TIMEOUT");
    expect(parseRules).toHaveBeenCalledTimes(1);
  });

  it("falls back on a 503 proxy HTML page by mapping the status", async () => {
    const fetchImpl = respondingWith(503, "<html><body><h1>503 Service Unavailable</h1></body></html>", true);
    const result = await interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl));
    expect(result.parser).toBe("rules");
    expect(result.fallbackReason).toBe("PROVIDER_UNAVAILABLE");
    expect(ParseResponseSchema.safeParse(result).success).toBe(true);
    expect(parseRules).toHaveBeenCalledTimes(1);
  });

  it("falls back on a 503 with an empty body by mapping the status", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 503 }));
    const result = await interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl));
    expect(result.fallbackReason).toBe("PROVIDER_UNAVAILABLE");
    expect(parseRules).toHaveBeenCalledTimes(1);
  });
});

describe("interpretWith: non-fallback errors", () => {
  it.each([
    [400, "INVALID_REQUEST"],
    [409, "MENU_VERSION_MISMATCH"],
    [413, "INPUT_TOO_LARGE"],
    [502, "INVALID_MODEL_OUTPUT"],
  ] as const)("throws InterpretError for %i %s carrying the ApiError body", async (status, code) => {
    const body = apiError(code, false);
    const fetchImpl = respondingWith(status, body);
    const error = await expectInterpretError(interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl)));
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.retryable).toBe(false);
    expect(error.apiError).toEqual(body);
    expect(error.message).toBe(body.error.message);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(parseRules).not.toHaveBeenCalled();
  });

  it.each([
    [400, "INVALID_REQUEST"],
    [409, "MENU_VERSION_MISMATCH"],
    [413, "INPUT_TOO_LARGE"],
    [502, "INVALID_MODEL_OUTPUT"],
    [404, "INVALID_REQUEST"],
    [500, "INVALID_MODEL_OUTPUT"],
  ] as const)("maps %i with an unparseable body to %s and never falls back", async (status, code) => {
    const fetchImpl = respondingWith(status, "not json", true);
    const error = await expectInterpretError(interpretWith(request, { localOnly: false, catalog: CATALOG }, deps(fetchImpl)));
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.retryable).toBe(false);
    expect(error.apiError).toBeNull();
    expect(parseRules).not.toHaveBeenCalled();
  });

  it("throws INVALID_REQUEST for a malformed request without fetching or falling back", async () => {
    const fetchImpl = respondingWith(200, geminiResponse);
    const malformed = { ...request, text: "" };
    const error = await expectInterpretError(interpretWith(malformed, { localOnly: false, catalog: CATALOG }, deps(fetchImpl)));
    expect(error.code).toBe("INVALID_REQUEST");
    expect(error.status).toBe(400);
    expect(error.retryable).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(parseRules).not.toHaveBeenCalled();
  });
});

describe("interpretWith: local only", () => {
  it("runs the rules parser without touching the network", async () => {
    const fetchImpl = respondingWith(200, geminiResponse);
    const result = await interpretWith(request, { localOnly: true, catalog: CATALOG }, deps(fetchImpl));
    expect(result.parser).toBe("rules");
    expect(result.fallbackReason).toBeNull();
    expect(ParseResponseSchema.safeParse(result).success).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(parseRules).toHaveBeenCalledWith(request, CATALOG);
  });
});

describe("interpret: default dependencies", () => {
  it("uses the global fetch against the same-origin route", async () => {
    const fetchImpl = respondingWith(200, geminiResponse);
    vi.stubGlobal("fetch", fetchImpl);
    const result = await interpret(request, { localOnly: false, catalog: CATALOG });
    expect(result).toEqual(geminiResponse);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("/api/interpret");
  });

  it("treats a browser reporting offline as PROVIDER_UNAVAILABLE without fetching", async () => {
    const fetchImpl = respondingWith(200, geminiResponse);
    vi.stubGlobal("fetch", fetchImpl);
    vi.stubGlobal("navigator", { onLine: false });
    const result = await interpret(request, { localOnly: false, catalog: CATALOG });
    expect(result.fallbackReason).toBe("PROVIDER_UNAVAILABLE");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
