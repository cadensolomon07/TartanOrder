import {
  ApiErrorSchema,
  LIMITS,
  ParseRequestSchema,
  ParseResponseSchema,
  type ApiError,
  type HttpCode,
  type InterpretOptions,
  type ParseRequest,
  type ParseResponse,
} from "@/contracts";
import { raceAbort } from "./abort";
import { parseRules } from "./rules";

/**
 * Non-fallback failure of `interpret`: malformed input, menu-version mismatch, oversize
 * request, or a 200 body that fails the shared contract. Never thrown for transient
 * provider trouble — those paths fall back to `parseRules` with a `fallbackReason`.
 */
export class InterpretError extends Error {
  readonly code: HttpCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly apiError: ApiError | null;

  constructor(details: { code: HttpCode; status: number; retryable: boolean; apiError: ApiError | null }) {
    super(details.apiError?.error.message ?? `Interpret failed: ${details.code}`);
    this.name = "InterpretError";
    this.code = details.code;
    this.status = details.status;
    this.retryable = details.retryable;
    this.apiError = details.apiError;
  }
}

export type InterpretDeps = {
  fetchImpl: typeof fetch;
  timeoutMs: number;
  isOnline: () => boolean;
  /** Optional clock hook reserved for eval-harness latency instrumentation; unused here. */
  now?: () => number;
};

type Transport =
  | { kind: "exchange"; status: number; body: unknown }
  | { kind: "timeout" }
  | { kind: "network" };

const ENDPOINT = "/api/interpret";
const FALLBACK_STATUSES: ReadonlySet<number> = new Set([429, 503, 504]);
const STATUS_CODES: Readonly<Partial<Record<number, HttpCode>>> = {
  400: "INVALID_REQUEST",
  409: "MENU_VERSION_MISMATCH",
  413: "INPUT_TOO_LARGE",
  429: "RATE_LIMITED",
  502: "INVALID_MODEL_OUTPUT",
  503: "PROVIDER_UNAVAILABLE",
  504: "PARSE_TIMEOUT",
};

/** Same-origin `/api/interpret` client with the default browser dependencies. */
export function interpret(req: ParseRequest, options: InterpretOptions): Promise<ParseResponse> {
  return interpretWith(req, options, {
    fetchImpl: (input, init) => fetch(input, init),
    timeoutMs: LIMITS.clientTimeoutMs,
    isOnline: () => !(typeof navigator !== "undefined" && navigator.onLine === false),
  });
}

/**
 * One HTTP attempt, never retried. Transient failures (429/503/504, client deadline,
 * offline, network error) fall back to the local rules parser for the SAME request and
 * are labelled with `fallbackReason`. User cancellation rejects with `AbortError`.
 */
export async function interpretWith(
  req: ParseRequest,
  options: InterpretOptions,
  deps: InterpretDeps,
): Promise<ParseResponse> {
  const checked = ParseRequestSchema.safeParse(req);
  if (!checked.success) {
    throw new InterpretError({ code: "INVALID_REQUEST", status: 400, retryable: false, apiError: null });
  }
  if (options.signal?.aborted) throw cancelled();
  const request = checked.data;
  if (options.localOnly) return parseRules(request);
  if (!deps.isOnline()) return fallback(request, "PROVIDER_UNAVAILABLE");

  const transport = await exchange(request, options.signal, deps);
  if (transport.kind === "timeout") return fallback(request, "PARSE_TIMEOUT");
  if (transport.kind === "network") return fallback(request, "PROVIDER_UNAVAILABLE");
  return settle(request, transport.status, transport.body);
}

async function exchange(
  request: ParseRequest,
  userSignal: AbortSignal | undefined,
  deps: InterpretDeps,
): Promise<Transport> {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new DOMException("Client deadline", "TimeoutError")), deps.timeoutMs);
  const forwardAbort = () => deadline.abort(userSignal?.reason);
  userSignal?.addEventListener("abort", forwardAbort, { once: true });
  try {
    const response = await raceAbort(
      deps.fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: deadline.signal,
      }),
      deadline.signal,
    );
    const text = await raceAbort(response.text(), deadline.signal);
    return { kind: "exchange", status: response.status, body: parseJson(text) };
  } catch {
    if (userSignal?.aborted) throw cancelled();
    return deadline.signal.aborted ? { kind: "timeout" } : { kind: "network" };
  } finally {
    clearTimeout(timer);
    userSignal?.removeEventListener("abort", forwardAbort);
  }
}

function settle(request: ParseRequest, status: number, body: unknown): ParseResponse {
  if (status === 200) return accept(request, body);
  const apiError = ApiErrorSchema.safeParse(body);
  const code = apiError.success ? apiError.data.error.code : codeForStatus(status);
  if (FALLBACK_STATUSES.has(status)) return fallback(request, code);
  throw new InterpretError({
    code,
    status,
    retryable: apiError.success ? apiError.data.error.retryable : false,
    apiError: apiError.success ? apiError.data : null,
  });
}

function accept(request: ParseRequest, body: unknown): ParseResponse {
  const parsed = ParseResponseSchema.safeParse(body);
  if (!parsed.success || !echoesRequest(parsed.data, request)) {
    throw new InterpretError({ code: "INVALID_MODEL_OUTPUT", status: 502, retryable: false, apiError: null });
  }
  return parsed.data;
}

function echoesRequest(response: ParseResponse, request: ParseRequest): boolean {
  return (
    response.requestId === request.requestId &&
    response.baseRevision === request.baseRevision &&
    response.menuVersion === request.menuVersion
  );
}

function fallback(request: ParseRequest, reason: HttpCode): ParseResponse {
  return { ...parseRules(request), fallbackReason: reason };
}

function codeForStatus(status: number): HttpCode {
  return STATUS_CODES[status] ?? (status >= 500 ? "INVALID_MODEL_OUTPUT" : "INVALID_REQUEST");
}

function cancelled(): DOMException {
  return new DOMException("Cancelled", "AbortError");
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
