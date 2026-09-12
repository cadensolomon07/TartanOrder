// Client-safe persist port. The controller enqueues accepted audit entries
// write-behind through this interface; ordering never awaits it.
import type { AuditEntry, Receipt, SessionCreateRequest } from "@/contracts";

export type PersistOutcome = { ok: true; savedSeq: number } | { ok: false; code: string; message: string; retryable: boolean };

export type PersistPort = {
  createSession(input: Omit<SessionCreateRequest, "v">): Promise<PersistOutcome>;
  appendEvents(sessionId: string, entries: readonly AuditEntry[]): Promise<PersistOutcome>;
  saveReceipt(sessionId: string, receipt: Receipt): Promise<PersistOutcome>;
};
