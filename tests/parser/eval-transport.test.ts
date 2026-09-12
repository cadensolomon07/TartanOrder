import { afterEach, describe, expect, it, vi } from "vitest";
import { API_VERSION, LIMITS } from "@/contracts";
import { FIXTURE_REQUEST, FIXTURE_RESPONSE } from "@/contracts/fixtures";
import { InterpretError } from "@/parser/client";
import { CATALOG } from "../helpers/catalog";
import { parserCallFor } from "../../evals/lib/parser-call";

const transport = { kind: "http", baseUrl: "https://test.invalid" } as const;
const parserCall = () => parserCallFor(transport, CATALOG)(FIXTURE_REQUEST);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("evaluation HTTP transport (mock HTTP, not real parser evidence)", () => {
  it("returns the actual successful envelope through the kiosk client and targets the supplied deployment", async () => {
    const response = { ...FIXTURE_RESPONSE, parser: "gemini" };
    const fetchMock = vi.fn(async () => Response.json(response));
    vi.stubGlobal("fetch", fetchMock);
    expect(await parserCall()).toEqual(response);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toMatchObject(["https://test.invalid/api/interpret", { method: "POST", body: JSON.stringify(FIXTURE_REQUEST) }]);
  });

  it("labels a provider outage as same-request rules fallback, never Gemini success", async () => {
    const error = { v: API_VERSION, requestId: FIXTURE_REQUEST.requestId, error: { code: "PROVIDER_UNAVAILABLE", message: "Provider unavailable", retryable: true } };
    const fetchMock = vi.fn(async () => Response.json(error, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await parserCall()).toEqual({ ...FIXTURE_RESPONSE, parser: "rules", fallbackReason: "PROVIDER_UNAVAILABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the bounded client deadline and records a timeout fallback when HTTP never answers", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);
    const pending = parserCall();
    await vi.advanceTimersByTimeAsync(LIMITS.clientTimeoutMs);
    expect(await pending).toEqual({ ...FIXTURE_RESPONSE, parser: "rules", fallbackReason: "PARSE_TIMEOUT" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("keeps malformed model output as an error instead of reporting a successful fallback", async () => {
    const error = { v: API_VERSION, requestId: FIXTURE_REQUEST.requestId, error: { code: "INVALID_MODEL_OUTPUT", message: "Invalid model output", retryable: false } };
    const fetchMock = vi.fn(async () => Response.json(error, { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(parserCall()).rejects.toBeInstanceOf(InterpretError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
