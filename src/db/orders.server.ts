// Server-only order store over the secret-key writer. Sessions, append-only
// audit entries and receipts; nothing here interprets the audit, the engine
// does that on replay. Never logs bodies.
import "server-only";
import { API_VERSION, ExportLogSchema, type AuditEntry, type ExportLog, type Receipt, type SessionCreateRequest } from "@/contracts";
import { writerClient, type DbClient } from "./client.server";
import type { Json } from "./types";

export type SessionInput = Omit<SessionCreateRequest, "v">;

export type OrdersStore = {
  createSession(input: SessionInput): Promise<{ created: boolean }>;
  sessionExists(sessionId: string): Promise<boolean>;
  /** Highest stored seq, 0 when none; null when the session is unknown. */
  maxSeq(sessionId: string): Promise<number | null>;
  /** Inserts entries, ignoring any (session_id, seq) that already exists. */
  appendEvents(sessionId: string, entries: readonly AuditEntry[]): Promise<void>;
  saveReceipt(sessionId: string, receipt: Receipt): Promise<void>;
  exportSession(sessionId: string): Promise<ExportLog | null>;
  /** Cascades to audit entries and receipts; used by test cleanup only. */
  deleteSession(sessionId: string): Promise<void>;
};

export class OrdersStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrdersStoreError";
  }
}

const MAX_AUDIT_ROWS = 10000;

function check<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new OrdersStoreError(`${what}: ${result.error.message}`);
  return result.data;
}

const json = (value: unknown): Json => value as Json;

export function createOrdersStore(db: DbClient): OrdersStore {
  const store: OrdersStore = {
    async createSession(input) {
      const exists = await store.sessionExists(input.sessionId);
      if (exists) return { created: false };
      const result = await db.from("sessions").upsert({
        id: input.sessionId,
        catalog_version_id: input.menuVersion,
        wait_config: input.waitConfig === undefined ? null : json(input.waitConfig),
        allowed_location_ids: input.allowedLocationIds === undefined ? null : [...input.allowedLocationIds],
      }, { onConflict: "id", ignoreDuplicates: true });
      check(result, "Could not create the session");
      return { created: true };
    },
    async sessionExists(sessionId) {
      const rows = check(await db.from("sessions").select("id").eq("id", sessionId).limit(1), "Could not read the session");
      return (rows ?? []).length === 1;
    },
    async maxSeq(sessionId) {
      if (!(await store.sessionExists(sessionId))) return null;
      const rows = check(await db.from("audit_events").select("seq").eq("session_id", sessionId).order("seq", { ascending: false }).limit(1), "Could not read the audit");
      return rows?.[0]?.seq ?? 0;
    },
    async appendEvents(sessionId, entries) {
      if (entries.length === 0) return;
      const rows = entries.map((entry) => ({ session_id: sessionId, seq: entry.seq, event: json(entry.event), outcome: entry.outcome, code: entry.code }));
      check(await db.from("audit_events").upsert(rows, { onConflict: "session_id,seq", ignoreDuplicates: true }), "Could not append audit entries");
    },
    async saveReceipt(sessionId, receipt) {
      check(await db.from("receipts").upsert({
        id: receipt.id, session_id: sessionId, review_id: receipt.reviewId, lines: json(receipt.lines), total_cents: receipt.totalCents,
      }, { onConflict: "id", ignoreDuplicates: true }), "Could not save the receipt");
    },
    async exportSession(sessionId) {
      const sessions = check(await db.from("sessions").select("id, catalog_version_id, wait_config, allowed_location_ids").eq("id", sessionId).limit(1), "Could not read the session");
      const session = sessions?.[0];
      if (!session) return null;
      const audit = check(await db.from("audit_events").select("seq, event, outcome, code").eq("session_id", sessionId).order("seq").limit(MAX_AUDIT_ROWS), "Could not read the audit") ?? [];
      return ExportLogSchema.parse({
        v: API_VERSION,
        menuVersion: session.catalog_version_id,
        sessionId: session.id,
        audit: audit.map((row) => ({ seq: row.seq, event: row.event, outcome: row.outcome, code: row.code })),
        ...(session.wait_config === null ? {} : { waitConfig: session.wait_config }),
        ...(session.allowed_location_ids === null ? {} : { allowedLocationIds: session.allowed_location_ids }),
      });
    },
    async deleteSession(sessionId) {
      check(await db.from("sessions").delete().eq("id", sessionId), "Could not delete the session");
    },
  };
  return store;
}

let shared: OrdersStore | null = null;

export function ordersStore(): OrdersStore {
  shared ??= createOrdersStore(writerClient());
  return shared;
}
