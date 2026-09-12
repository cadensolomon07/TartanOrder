// Same-origin fetch implementation of the persist port. One attempt per call,
// no automatic retry: the controller surfaces a failed state and offers a
// manual retry. Bodies are validated with the shared schemas before sending.
import {
  API_VERSION,
  LIMITS,
  PersistAckSchema,
  PersistenceErrorSchema,
  SessionCreateRequestSchema,
  SessionEventsRequestSchema,
  SessionReceiptRequestSchema,
  type AuditEntry,
  type Receipt,
  type SessionCreateRequest,
} from "@/contracts";
import type { PersistOutcome, PersistPort } from "./port";

export type PersistClientDeps = { fetchImpl: typeof fetch; timeoutMs: number };

const failure = (code: string, message: string, retryable: boolean): PersistOutcome => ({ ok: false, code, message, retryable });

async function post(path: string, body: unknown, deps: PersistClientDeps): Promise<PersistOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    const response = await deps.fetchImpl(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = undefined; }
    if (response.status === 200) {
      const ack = PersistAckSchema.safeParse(json);
      return ack.success ? { ok: true, savedSeq: ack.data.savedSeq } : failure("INVALID_RESPONSE", "The server acknowledgement was malformed.", true);
    }
    const error = PersistenceErrorSchema.safeParse(json);
    if (error.success) return failure(error.data.error.code, error.data.error.message, error.data.error.retryable);
    return failure(`HTTP_${response.status}`, "Saving to the server failed.", response.status >= 500 || response.status === 429);
  } catch {
    return failure(controller.signal.aborted ? "TIMEOUT" : "NETWORK", "The server could not be reached. Your order is still in this kiosk.", true);
  } finally {
    clearTimeout(timer);
  }
}

export function createPersistClient(deps: PersistClientDeps = { fetchImpl: (input, init) => fetch(input, init), timeoutMs: LIMITS.clientTimeoutMs }): PersistPort {
  return {
    createSession(input: Omit<SessionCreateRequest, "v">) {
      const body = SessionCreateRequestSchema.safeParse({ v: API_VERSION, ...input });
      if (!body.success) return Promise.resolve(failure("INVALID_REQUEST", "The session could not be described.", false));
      return post("/api/sessions", body.data, deps);
    },
    appendEvents(sessionId: string, entries: readonly AuditEntry[]) {
      const body = SessionEventsRequestSchema.safeParse({ v: API_VERSION, entries: [...entries] });
      if (!body.success) return Promise.resolve(failure("INVALID_REQUEST", "The audit entries could not be described.", false));
      return post(`/api/sessions/${encodeURIComponent(sessionId)}/events`, body.data, deps);
    },
    saveReceipt(sessionId: string, receipt: Receipt) {
      const body = SessionReceiptRequestSchema.safeParse({ v: API_VERSION, receipt });
      if (!body.success) return Promise.resolve(failure("INVALID_REQUEST", "The receipt could not be described.", false));
      return post(`/api/sessions/${encodeURIComponent(sessionId)}/receipt`, body.data, deps);
    },
  };
}
