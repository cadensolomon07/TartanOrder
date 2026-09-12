// Route-handler logic for order persistence, kept free of Next.js specifics so
// tests drive it with an in-memory store. Every body is bounded and validated
// with the shared V3 schemas before the store is touched; transcripts inside
// audit entries are stored, never logged.
import {
  API_VERSION,
  LIMITS,
  MAX_SESSION_AUDIT_ENTRIES,
  PersistAckSchema,
  PersistenceErrorSchema,
  SessionCreateRequestSchema,
  SessionEventsRequestSchema,
  SessionReceiptRequestSchema,
  type AuditEntry,
  type PersistenceCode,
} from "@/contracts";
import { loadCatalogConfig } from "@/catalog/config.server";
import { resolveOrderPersistence } from "@/db/mode.server";
import { ordersStore, type OrdersStore, type SessionInput } from "@/db/orders.server";

export type PersistenceDeps = {
  store(): OrdersStore;
  activeVersionId(): Promise<string | null>;
  persistenceMode(): "supabase" | "off";
};

export function defaultDeps(): PersistenceDeps {
  return {
    store: ordersStore,
    activeVersionId: async () => (await loadCatalogConfig()).versionId,
    persistenceMode: () => resolveOrderPersistence(),
  };
}

const MESSAGES: Readonly<Record<PersistenceCode, string>> = {
  INVALID_REQUEST: "The request did not match the V3 persistence format. Nothing was saved.",
  MENU_VERSION_MISMATCH: "This kiosk serves a different catalog version. Reload to sync the menu.",
  INPUT_TOO_LARGE: `The request exceeds ${LIMITS.requestBytes} bytes.`,
  SESSION_NOT_FOUND: "That session is not stored on the server.",
  AUDIT_SEQUENCE_GAP: "The audit entries are not contiguous with what the server holds.",
  SESSION_LIMIT: `This session has reached the server's limit of ${MAX_SESSION_AUDIT_ENTRIES} audit entries. Start a new order to keep saving.`,
  PERSISTENCE_UNAVAILABLE: "Order saving is unavailable. Your order is still in this kiosk.",
};

export function errorResponse(status: number, code: PersistenceCode, sessionId: string | null, retryable = false): Response {
  const body = PersistenceErrorSchema.parse({ v: API_VERSION, sessionId, error: { code, message: MESSAGES[code], retryable } });
  return Response.json(body, { status });
}

function ack(sessionId: string, savedSeq: number): Response {
  return Response.json(PersistAckSchema.parse({ v: API_VERSION, sessionId, savedSeq }));
}

type Body = { ok: true; value: unknown } | { ok: false; response: Response };

async function readBody(request: Request, sessionId: string | null): Promise<Body> {
  if (Number(request.headers.get("content-length")) > LIMITS.requestBytes) return { ok: false, response: errorResponse(413, "INPUT_TOO_LARGE", sessionId) };
  let text: string;
  try { text = await request.text(); } catch { return { ok: false, response: errorResponse(400, "INVALID_REQUEST", sessionId) }; }
  if (new TextEncoder().encode(text).byteLength > LIMITS.requestBytes) return { ok: false, response: errorResponse(413, "INPUT_TOO_LARGE", sessionId) };
  try { return { ok: true, value: JSON.parse(text) as unknown }; } catch { return { ok: false, response: errorResponse(400, "INVALID_REQUEST", sessionId) }; }
}

async function guarded(sessionId: string | null, deps: PersistenceDeps, work: () => Promise<Response>): Promise<Response> {
  if (deps.persistenceMode() === "off") return errorResponse(503, "PERSISTENCE_UNAVAILABLE", sessionId);
  try {
    return await work();
  } catch (error) {
    // Store failures never leak connection details; the message is a fixed string.
    console.error(JSON.stringify({ event: "persistence", outcome: "error", name: error instanceof Error ? error.name : "Error" }));
    return errorResponse(503, "PERSISTENCE_UNAVAILABLE", sessionId, true);
  }
}

export async function createSession(request: Request, deps: PersistenceDeps): Promise<Response> {
  return guarded(null, deps, async () => {
    const body = await readBody(request, null);
    if (!body.ok) return body.response;
    const parsed = SessionCreateRequestSchema.safeParse(body.value);
    if (!parsed.success) return errorResponse(400, "INVALID_REQUEST", null);
    const versionId = await deps.activeVersionId();
    if (versionId === null) return errorResponse(503, "PERSISTENCE_UNAVAILABLE", parsed.data.sessionId, true);
    if (parsed.data.menuVersion !== versionId) return errorResponse(409, "MENU_VERSION_MISMATCH", parsed.data.sessionId);
    const input: SessionInput = {
      sessionId: parsed.data.sessionId,
      menuVersion: parsed.data.menuVersion,
      ...(parsed.data.waitConfig === undefined ? {} : { waitConfig: parsed.data.waitConfig }),
      ...(parsed.data.allowedLocationIds === undefined ? {} : { allowedLocationIds: parsed.data.allowedLocationIds }),
    };
    await deps.store().createSession(input);
    const savedSeq = (await deps.store().maxSeq(input.sessionId)) ?? 0;
    return ack(input.sessionId, savedSeq);
  });
}

/** Entries at or below the stored max are duplicates (idempotent); the rest must continue the sequence exactly. */
export function planAppend(storedMax: number, entries: readonly AuditEntry[]): { kind: "ok"; fresh: AuditEntry[] } | { kind: "gap" } {
  const sorted = [...entries].sort((a, b) => a.seq - b.seq);
  const fresh = sorted.filter((entry) => entry.seq > storedMax);
  for (let index = 0; index < fresh.length; index += 1) {
    if (fresh[index].seq !== storedMax + index + 1) return { kind: "gap" };
  }
  return { kind: "ok", fresh };
}

export async function appendEvents(request: Request, sessionId: string, deps: PersistenceDeps): Promise<Response> {
  return guarded(sessionId, deps, async () => {
    const body = await readBody(request, sessionId);
    if (!body.ok) return body.response;
    const parsed = SessionEventsRequestSchema.safeParse(body.value);
    if (!parsed.success) return errorResponse(400, "INVALID_REQUEST", sessionId);
    const store = deps.store();
    const storedMax = await store.maxSeq(sessionId);
    if (storedMax === null) return errorResponse(404, "SESSION_NOT_FOUND", sessionId);
    const plan = planAppend(storedMax, parsed.data.entries);
    if (plan.kind === "gap") return errorResponse(409, "AUDIT_SEQUENCE_GAP", sessionId);
    const last = plan.fresh.at(-1);
    if (last !== undefined && last.seq > MAX_SESSION_AUDIT_ENTRIES) return errorResponse(413, "SESSION_LIMIT", sessionId);
    await store.appendEvents(sessionId, plan.fresh);
    return ack(sessionId, plan.fresh.length ? plan.fresh[plan.fresh.length - 1].seq : storedMax);
  });
}

export async function saveReceipt(request: Request, sessionId: string, deps: PersistenceDeps): Promise<Response> {
  return guarded(sessionId, deps, async () => {
    const body = await readBody(request, sessionId);
    if (!body.ok) return body.response;
    const parsed = SessionReceiptRequestSchema.safeParse(body.value);
    if (!parsed.success) return errorResponse(400, "INVALID_REQUEST", sessionId);
    const store = deps.store();
    const storedMax = await store.maxSeq(sessionId);
    if (storedMax === null) return errorResponse(404, "SESSION_NOT_FOUND", sessionId);
    await store.saveReceipt(sessionId, parsed.data.receipt);
    return ack(sessionId, storedMax);
  });
}

export async function exportSession(sessionId: string, deps: PersistenceDeps): Promise<Response> {
  return guarded(sessionId, deps, async () => {
    const log = await deps.store().exportSession(sessionId);
    if (log === null) return errorResponse(404, "SESSION_NOT_FOUND", sessionId);
    return Response.json(log);
  });
}

/** Session ids in a path: URL-safe characters only; a malformed escape is a 400, never a thrown URIError. */
const SESSION_ID_PATTERN = /^[A-Za-z0-9._~:-]+$/;
export function sessionIdFromParams(id: string): string | null {
  let decoded: string;
  try { decoded = decodeURIComponent(id); } catch { return null; }
  return decoded.length >= 1 && decoded.length <= LIMITS.idChars && SESSION_ID_PATTERN.test(decoded) ? decoded : null;
}
