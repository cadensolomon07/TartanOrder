import {
  API_VERSION,
  ApiErrorSchema,
  LIMITS,
  MENU_VERSION,
  ParseRequestSchema,
  ParseResponseSchema,
  RequestIdSchema,
  type ApiError,
  type HttpCode,
  type ParseRequest,
  type ParseResponse,
  type ParseResult,
} from "@/contracts";
import { raceAbort } from "@/parser/abort";
import { GeminiError, parseGemini, type GeminiUsage } from "@/parser/gemini.server";
import { resolveParserMode, type ParserMode } from "@/parser/mode.server";
import { guardTranscript, parseRules } from "@/parser/rules";

/**
 * POST /api/interpret — validates a ParseRequest with the shared schemas, runs the
 * configured parser, and always builds the envelope itself (the model never does).
 *
 * Status semantics worth knowing:
 * - Text over `LIMITS.transcriptChars` fails `ParseRequestSchema`, so it is 400
 *   INVALID_REQUEST; 413 INPUT_TOO_LARGE is reserved for the 4096-byte body bound.
 * - In gemini mode the rules `guardTranscript` runs before any model call. When it
 *   rejects, the 200 envelope is labelled `parser: "rules"` because the rules guard
 *   decided and no model was consulted; `fallbackReason` stays null (nothing failed).
 * - One `LIMITS.serverTimeoutMs` deadline, armed before the first body byte is read, bounds
 *   the whole lifecycle: body read, validation, rules guard, and the provider call. A body
 *   held open past it is 504 PARSE_TIMEOUT with `requestId: null` (nothing was parsed); a
 *   body whose stream fails is 400 INVALID_REQUEST. The reader is cancelled either way.
 * - `retryable: true` only ever accompanies 429/503/504 — but not every 503 is retryable.
 *   A missing key or a permanent provider refusal (bad key, model, or request) is 503 with
 *   `retryable: false`: repeating the same call cannot succeed.
 * - A provider failure that is not a `GeminiError` is reported as 502
 *   INVALID_MODEL_OUTPUT (not retryable) so an adapter bug never triggers retry storms.
 * - A client that disconnected — while still sending the body or mid-call — gets a bare
 *   499; nobody is listening.
 */
export async function POST(request: Request): Promise<Response> {
  const start = performance.now();
  const mode = resolveMode();
  const lifecycle = startLifecycle(request, start);
  try {
    const admission = await admit(request, lifecycle);
    const timing: Timing = { start, validateMs: performance.now() - start, providerMs: 0 };
    if (admission.kind === "disconnected") return disconnectedResponse();
    if (admission.kind === "failure") return failureResponse(admission.failure, mode, timing);
    if (mode === "rules") return rulesModeResponse(admission.request, timing);
    // `await` matters: a bare `return promise` would run `finally` (and disarm the deadline) at once.
    return await geminiModeResponse(lifecycle, admission.request, timing);
  } finally {
    lifecycle.dispose();
  }
}

type Mode = ParserMode;
type Timing = { readonly start: number; readonly validateMs: number; readonly providerMs: number };
type Failure = {
  readonly status: number;
  readonly code: HttpCode;
  readonly requestId: string | null;
  readonly retryable: boolean;
  readonly message?: string;
};
type Lifecycle = {
  readonly start: number;
  /** Aborts on the server deadline or on client disconnect, whichever comes first. */
  readonly signal: AbortSignal;
  timedOut(): boolean;
  disconnected(): boolean;
  dispose(): void;
};
type Admission =
  | { kind: "ok"; request: ParseRequest }
  | { kind: "failure"; failure: Failure }
  | { kind: "disconnected" };
type BodyRead =
  | { kind: "ok"; text: string }
  | { kind: "oversize" }
  | { kind: "unreadable" }
  | { kind: "aborted" };
type BodyReader = ReadableStreamDefaultReader<Uint8Array>;
type Json = { ok: true; value: unknown } | { ok: false };
type Shadow = { shadowAgree: boolean; shadowKind: ParseResult["kind"] };
type ProviderCall =
  | { kind: "ok"; result: ParseResult; usage: GeminiUsage | null; timing: Timing }
  | { kind: "failure"; failure: Failure; timing: Timing }
  | { kind: "disconnected" };
type LogInput = {
  mode: Mode;
  requestId: string | null;
  outcome: ParseResult["kind"] | "error";
  code: string | null;
  timing: Timing;
  usage: GeminiUsage | null;
  shadow: Shadow | null;
};

// gemini-2.5-flash answers 404 "no longer available to new users" (2026-09-12); 3.8 is the
// current Flash that accepts the adapter's structured-output settings.
const DEFAULT_MODEL = "gemini-3.8-flash";
const PROVIDER_TIMEOUT_MS = 4500;
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 503, 504]);
const MESSAGES: Readonly<Record<HttpCode, string>> = {
  INVALID_REQUEST: "The request did not match the V1 interpret format. Your cart was not changed.",
  MENU_VERSION_MISMATCH: `This kiosk serves menu ${MENU_VERSION}. Reload to sync the menu.`,
  INPUT_TOO_LARGE: `The request exceeds ${LIMITS.requestBytes} bytes.`,
  INVALID_MODEL_OUTPUT: "The model response was rejected. Your cart was not changed.",
  PROVIDER_UNAVAILABLE: "The language model is unavailable. Local rules still work.",
  PARSE_TIMEOUT: "Parsing took too long. Local rules still work.",
  RATE_LIMITED: "Too many requests right now. Local rules still work.",
};

/** The configured mode drives the route: gemini without a key is an honest 503, not a silent switch. */
function resolveMode(): Mode {
  return resolveParserMode().configured;
}

// ---------------------------------------------------------------------------
// Lifecycle: one deadline from the first body byte to the last provider byte,
// merged with client disconnect so every await in the route can race it.
// ---------------------------------------------------------------------------

function startLifecycle(request: Request, start: number): Lifecycle {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new DOMException("Server deadline", "TimeoutError")), LIMITS.serverTimeoutMs);
  const client: AbortSignal | undefined = request.signal;
  return {
    start,
    signal: client ? AbortSignal.any([client, deadline.signal]) : deadline.signal,
    timedOut: () => deadline.signal.aborted,
    disconnected: () => client?.aborted === true,
    dispose: () => clearTimeout(timer),
  };
}

function disconnectedResponse(): Response {
  return new Response(null, { status: 499 });
}

// ---------------------------------------------------------------------------
// Admission: byte bound, bounded body read, JSON, menu version, strict schema,
// blank transcript.
// ---------------------------------------------------------------------------

async function admit(request: Request, lifecycle: Lifecycle): Promise<Admission> {
  if (Number(request.headers.get("content-length")) > LIMITS.requestBytes) {
    return failed(refuse(413, "INPUT_TOO_LARGE", null));
  }
  const read = await readBounded(request, LIMITS.requestBytes, lifecycle.signal);
  if (read.kind === "aborted") {
    return lifecycle.disconnected() ? { kind: "disconnected" } : failed(transient(504, "PARSE_TIMEOUT", null));
  }
  if (read.kind === "oversize") return failed(refuse(413, "INPUT_TOO_LARGE", null));
  if (read.kind === "unreadable") return failed(refuse(400, "INVALID_REQUEST", null, "The request body could not be read."));
  return validate(read.text);
}

function validate(text: string): Admission {
  const json = parseJson(text);
  if (!json.ok) return failed(refuse(400, "INVALID_REQUEST", null, "The request body is not valid JSON."));
  const requestId = extractRequestId(json.value);
  if (hasForeignMenuVersion(json.value)) return failed(refuse(409, "MENU_VERSION_MISMATCH", requestId));
  const parsed = ParseRequestSchema.safeParse(json.value);
  if (!parsed.success) return failed(refuse(400, "INVALID_REQUEST", requestId));
  if (parsed.data.text.trim().length === 0) {
    return failed(refuse(400, "INVALID_REQUEST", requestId, "The transcript is blank."));
  }
  return { kind: "ok", request: parsed.data };
}

function failed(failure: Failure): Admission {
  return { kind: "failure", failure };
}

/**
 * Streams the body under `signal` and gives up as soon as it exceeds `limit` bytes. Every
 * early exit — oversize, deadline, disconnect, or a stream that errors — cancels the
 * reader so a stalled or abandoned socket is released, and never escapes as a rejection.
 */
async function readBounded(request: Request, limit: number, signal: AbortSignal): Promise<BodyRead> {
  const reader = request.body?.getReader();
  if (!reader) return { kind: "ok", text: "" };
  try {
    return await readChunks(reader, limit, signal);
  } catch {
    release(reader);
    return { kind: signal.aborted ? "aborted" : "unreadable" };
  }
}

async function readChunks(reader: BodyReader, limit: number, signal: AbortSignal): Promise<BodyRead> {
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  for (;;) {
    const { done, value } = await raceAbort(reader.read(), signal);
    if (done) return { kind: "ok", text: text + decoder.decode() };
    total += value.byteLength;
    if (total > limit) {
      release(reader);
      return { kind: "oversize" };
    }
    text += decoder.decode(value, { stream: true });
  }
}

/** Cancels the reader without waiting on the source: an errored stream rejects, a stalled one may never answer. */
function release(reader: BodyReader): void {
  void reader.cancel().catch(() => undefined);
}

function parseJson(text: string): Json {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

function extractRequestId(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("requestId" in body)) return null;
  const candidate = RequestIdSchema.safeParse(body.requestId);
  return candidate.success ? candidate.data : null;
}

function hasForeignMenuVersion(body: unknown): boolean {
  return typeof body === "object" && body !== null && "menuVersion" in body && body.menuVersion !== MENU_VERSION;
}

function refuse(status: number, code: HttpCode, requestId: string | null, message?: string): Failure {
  return { status, code, requestId, retryable: false, message };
}

function transient(status: number, code: HttpCode, requestId: string | null): Failure {
  return { status, code, requestId, retryable: RETRYABLE_STATUSES.has(status) };
}

// ---------------------------------------------------------------------------
// Parser modes.
// ---------------------------------------------------------------------------

function rulesModeResponse(req: ParseRequest, timing: Timing): Response {
  return successResponse(parseRules(req), { mode: "rules", timing, usage: null, shadow: null });
}

async function geminiModeResponse(lifecycle: Lifecycle, req: ParseRequest, timing: Timing): Promise<Response> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (apiKey.length === 0) {
    // A missing key is a deployment fault, not an outage: retrying the same call cannot succeed.
    return failureResponse(refuse(503, "PROVIDER_UNAVAILABLE", req.requestId), "gemini", timing);
  }
  const guarded = guardTranscript(req.text);
  if (guarded) return deliver(req, "rules", guarded, { timing, usage: null });
  const call = await callProvider(lifecycle, req, apiKey, timing);
  if (call.kind === "disconnected") return disconnectedResponse();
  if (call.kind === "failure") return failureResponse(call.failure, "gemini", call.timing);
  return deliver(req, "gemini", call.result, { timing: call.timing, usage: call.usage });
}

/** Builds and validates the gemini-mode envelope; an invalid result is a 502, never a partial cart. */
function deliver(
  req: ParseRequest,
  parser: ParseResponse["parser"],
  result: ParseResult,
  meta: { timing: Timing; usage: GeminiUsage | null },
): Response {
  const envelope = ParseResponseSchema.safeParse({
    v: API_VERSION,
    requestId: req.requestId,
    baseRevision: req.baseRevision,
    menuVersion: req.menuVersion,
    parser,
    fallbackReason: null,
    result,
  });
  if (!envelope.success) {
    return failureResponse(refuse(502, "INVALID_MODEL_OUTPUT", req.requestId), "gemini", meta.timing);
  }
  const shadow = shadowAgreement(req, envelope.data.result);
  return successResponse(envelope.data, { mode: "gemini", timing: meta.timing, usage: meta.usage, shadow });
}

/** The provider gets whatever is left of the single lifecycle deadline, capped at `PROVIDER_TIMEOUT_MS`. */
async function callProvider(lifecycle: Lifecycle, req: ParseRequest, apiKey: string, timing: Timing): Promise<ProviderCall> {
  const remaining = Math.max(0, LIMITS.serverTimeoutMs - (performance.now() - lifecycle.start));
  const started = performance.now();
  const timed = (): Timing => ({ ...timing, providerMs: performance.now() - started });
  try {
    const config = {
      apiKey,
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      timeoutMs: Math.min(PROVIDER_TIMEOUT_MS, remaining),
      signal: lifecycle.signal,
    };
    const outcome = await raceAbort(parseGemini(req, config), lifecycle.signal);
    return { kind: "ok", result: outcome.result, usage: outcome.usage, timing: timed() };
  } catch (error) {
    if (lifecycle.disconnected()) return { kind: "disconnected" };
    if (lifecycle.timedOut()) return { kind: "failure", failure: transient(504, "PARSE_TIMEOUT", req.requestId), timing: timed() };
    return { kind: "failure", failure: providerFailure(error, req.requestId), timing: timed() };
  }
}

/** Forwards the adapter's own `retryable` verdict (a permanent 4xx refusal is false); 502 is never retryable. */
function providerFailure(error: unknown, requestId: string): Failure {
  if (error instanceof GeminiError) {
    return { status: error.status, code: error.code, requestId, retryable: error.retryable && RETRYABLE_STATUSES.has(error.status) };
  }
  return refuse(502, "INVALID_MODEL_OUTPUT", requestId);
}

// ---------------------------------------------------------------------------
// Shadow agreement (gemini mode only): server-side log, response untouched.
// ---------------------------------------------------------------------------

function shadowAgreement(req: ParseRequest, result: ParseResult): Shadow {
  const rules = parseRules(req).result;
  return { shadowAgree: agrees(result, rules), shadowKind: rules.kind };
}

function agrees(left: ParseResult, right: ParseResult): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "proposal" && right.kind === "proposal") return canonical(left.ops) === canonical(right.ops);
  if (left.kind === "clarify" && right.kind === "clarify") return canonical(left.choices) === canonical(right.choices);
  return left.kind === "reject" && right.kind === "reject" && left.code === right.code;
}

/** JSON with object keys sorted so producers with different key orders still compare equal. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item !== null && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
}

// ---------------------------------------------------------------------------
// Responses, Server-Timing, and the single structured log line.
// ---------------------------------------------------------------------------

function successResponse(response: ParseResponse, meta: Omit<LogInput, "requestId" | "outcome" | "code">): Response {
  const code = response.result.kind === "reject" ? response.result.code : null;
  emitLog({ ...meta, requestId: response.requestId, outcome: response.result.kind, code });
  return Response.json(response, { headers: { "server-timing": serverTiming(meta.timing) } });
}

function failureResponse(failure: Failure, mode: Mode, timing: Timing): Response {
  const body: ApiError = ApiErrorSchema.parse({
    v: API_VERSION,
    requestId: failure.requestId,
    error: { code: failure.code, message: failure.message ?? MESSAGES[failure.code], retryable: failure.retryable },
  });
  emitLog({ mode, requestId: failure.requestId, outcome: "error", code: failure.code, timing, usage: null, shadow: null });
  return Response.json(body, { status: failure.status, headers: { "server-timing": serverTiming(timing) } });
}

function serverTiming(timing: Timing): string {
  const total = performance.now() - timing.start;
  return `validate;dur=${timing.validateMs.toFixed(1)}, provider;dur=${timing.providerMs.toFixed(1)}, total;dur=${total.toFixed(1)}`;
}

/** The only console output in the route. Never includes the transcript, headers, or key. */
function emitLog(input: LogInput): void {
  const line = {
    event: "interpret",
    requestId: input.requestId,
    mode: input.mode,
    outcome: input.outcome,
    code: input.code,
    latencyMs: Math.round(performance.now() - input.timing.start),
    providerMs: Math.round(input.timing.providerMs),
    tokens: input.usage,
    ...(input.shadow ?? {}),
  };
  console.info(JSON.stringify(line));
}
