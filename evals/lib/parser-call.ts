import { POST } from "@/app/api/interpret/route";
import { ApiErrorSchema, ParseResponseSchema, type ParseRequest, type ParseResponse } from "@/contracts";
import { parseRules } from "@/parser/rules";
import type { EvalTransport } from "../types";

export type ParserCall = (req: ParseRequest) => Promise<ParseResponse>;
export type RouteReply = { status: number; body: unknown };

const ROUTE_PATH = "/api/interpret";
const IN_PROCESS_ORIGIN = "http://localhost";

/** Raised when the deployed route answered but the body is not a contract-valid envelope. */
export class HttpEnvelopeError extends Error {
  constructor(readonly status: number, readonly code: string | null) {
    super(`HTTP ${status}${code ? ` ${code}` : ""}: body is not a valid ParseResponse`);
    this.name = "HttpEnvelopeError";
  }
}

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
 * In-process calls the pure rules grammar directly. Over HTTP the server decides
 * (rules or Gemini) and its envelope names the parser; the harness only validates it.
 */
export function parserCallFor(transport: EvalTransport): ParserCall {
  if (transport.kind === "in-process") return async (req) => parseRules(req);
  return async (req) => {
    const reply = await callRoute(transport, req);
    const parsed = ParseResponseSchema.safeParse(reply.body);
    if (!parsed.success) throw new HttpEnvelopeError(reply.status, errorCode(reply.body));
    return parsed.data;
  };
}
