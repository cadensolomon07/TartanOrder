import { POST } from "@/app/api/interpret/route";
import { ApiErrorSchema, LIMITS, type Catalog, type ParseRequest, type ParseResponse } from "@/contracts";
import { interpretWith } from "@/parser/client";
import { parseRules } from "@/parser/rules";
import type { EvalTransport } from "../types";

export type ParserCall = (req: ParseRequest) => Promise<ParseResponse>;
export type RouteReply = { status: number; body: unknown };

const ROUTE_PATH = "/api/interpret";
const IN_PROCESS_ORIGIN = "http://localhost";

function requestInit(req: ParseRequest): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Exercises the route exactly as the kiosk would: the handler in-process, or real HTTP to a deployment. */
export async function callRoute(transport: EvalTransport, req: ParseRequest): Promise<RouteReply> {
  const response =
    transport.kind === "in-process"
      ? await POST(new Request(`${IN_PROCESS_ORIGIN}${ROUTE_PATH}`, requestInit(req)))
      : await fetch(`${transport.baseUrl}${ROUTE_PATH}`, requestInit(req));
  return { status: response.status, body: await readBody(response) };
}

/** The HTTP error code when the body is a valid `ApiError`, otherwise null. */
export function errorCode(body: unknown): string | null {
  const parsed = ApiErrorSchema.safeParse(body);
  return parsed.success ? parsed.data.error.code : null;
}

/**
 * In-process calls the pure rules grammar directly. Over HTTP the harness goes through the
 * kiosk's own client adapter (`interpretWith`) against the deployment, so the server decides
 * (rules or Gemini), its envelope names the parser, and transient failures (429/503/504,
 * client deadline) become the same labelled rules fallback the kiosk would show — the row
 * is then labelled `rules` with a `fallbackReason`. Non-transient errors still throw and are
 * recorded as harness errors.
 */
export function parserCallFor(transport: EvalTransport, catalog: Catalog): ParserCall {
  if (transport.kind === "in-process") return async (req) => parseRules(req, catalog);
  const baseUrl = transport.baseUrl;
  return (req) =>
    interpretWith(req, { localOnly: false, catalog }, {
      fetchImpl: (input, init) => fetch(`${baseUrl}${String(input)}`, init),
      timeoutMs: LIMITS.clientTimeoutMs,
      isOnline: () => true,
    });
}
