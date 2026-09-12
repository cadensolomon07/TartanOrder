import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { API_VERSION, ExportLogSchema, PersistAckSchema, PersistenceErrorSchema, type AuditEntry, type ExportLog, type Receipt } from "@/contracts";
import { createEngine, exportLog, getView, reduceEngine, replayLog } from "@/core/engine";
import type { OrdersStore, SessionInput } from "@/db/orders.server";
import { appendEvents, createSession, exportSession, planAppend, saveReceipt, sessionIdFromParams, type PersistenceDeps } from "@/persistence/routes.server";
import { CATALOG } from "../helpers/catalog";

/** In-memory store with the same idempotency semantics as the Supabase one. */
function memoryStore() {
  const sessions = new Map<string, SessionInput>();
  const audit = new Map<string, Map<number, AuditEntry>>();
  const receipts = new Map<string, Receipt>();
  const store: OrdersStore = {
    async createSession(input) { if (sessions.has(input.sessionId)) return { created: false }; sessions.set(input.sessionId, input); audit.set(input.sessionId, new Map()); return { created: true }; },
    async sessionExists(id) { return sessions.has(id); },
    async maxSeq(id) { if (!sessions.has(id)) return null; return Math.max(0, ...[...(audit.get(id)?.keys() ?? [])]); },
    async appendEvents(id, entries) { const rows = audit.get(id)!; for (const entry of entries) if (!rows.has(entry.seq)) rows.set(entry.seq, structuredClone(entry)); },
    async saveReceipt(id, receipt) { if (!receipts.has(receipt.id)) receipts.set(receipt.id, { ...structuredClone(receipt), sessionId: id } as never); },
    async exportSession(id) {
      const session = sessions.get(id); if (!session) return null;
      const entries = [...audit.get(id)!.values()].sort((a, b) => a.seq - b.seq);
      return ExportLogSchema.parse({ v: API_VERSION, menuVersion: session.menuVersion, sessionId: id, audit: entries, ...(session.waitConfig ? { waitConfig: session.waitConfig } : {}), ...(session.allowedLocationIds ? { allowedLocationIds: session.allowedLocationIds } : {}) });
    },
    async deleteSession(id) { sessions.delete(id); audit.delete(id); },
  };
  return { store, sessions, audit, receipts };
}

function deps(store: OrdersStore, overrides: Partial<PersistenceDeps> = {}): PersistenceDeps {
  return { store: () => store, activeVersionId: async () => CATALOG.versionId, persistenceMode: () => "supabase", ...overrides };
}

const post = (body: unknown, headers: Record<string, string> = {}) => new Request("http://kiosk.test/x", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const create = (sessionId: string, extra: Record<string, unknown> = {}) => post({ v: API_VERSION, sessionId, menuVersion: CATALOG.versionId, ...extra });
const events = (entries: AuditEntry[]) => post({ v: API_VERSION, entries });

function orderedEngine(sessionId: string) {
  let state = createEngine(sessionId, { catalog: CATALOG, allowedLocationIds: ["188", "109"] });
  state = reduceEngine(state, { type: "UI", action: { type: "MANUAL", ops: [{ type: "ADD", itemId: "cmu_188_fresh_cut_fries", qty: 2, modifiers: [] }, { type: "ADD", itemId: "cmu_188_fresh_cut_fries", qty: 1, modifiers: [] }] } });
  state = reduceEngine(state, { type: "UI", action: { type: "MANUAL", ops: [{ type: "REMOVE", ref: { by: "item", itemId: "cmu_188_fresh_cut_fries" } }] } }); // ambiguous -> clarify
  const pending = getView(state).pending!;
  state = reduceEngine(state, { type: "UI", action: { type: "CHOOSE", pendingId: pending.id, choiceId: pending.choices[0].id } });
  state = reduceEngine(state, { type: "UI", action: { type: "UNDO" } });
  state = reduceEngine(state, { type: "UI", action: { type: "REVIEW" } });
  const review = getView(state).review!;
  state = reduceEngine(state, { type: "UI", action: { type: "CONFIRM", reviewId: review.id, revision: review.revision } });
  return state;
}

describe("persistence routes", () => {
  it("creates a session idempotently, bound to the active catalog version", async () => {
    const { store, sessions } = memoryStore();
    const first = await createSession(create("s1", { allowedLocationIds: ["188"] }), deps(store));
    expect(first.status).toBe(200);
    expect(PersistAckSchema.parse(await first.json())).toEqual({ v: 3, sessionId: "s1", savedSeq: 0 });
    const again = await createSession(create("s1"), deps(store));
    expect(again.status).toBe(200);
    expect(sessions.size).toBe(1);
    expect(sessions.get("s1")?.allowedLocationIds).toEqual(["188"]);
  });

  it("rejects malformed, foreign-version, oversized and disabled requests without touching the store", async () => {
    const { store, sessions } = memoryStore();
    expect((await createSession(post("{not json"), deps(store))).status).toBe(400);
    expect((await createSession(post({ v: 2, sessionId: "s1", menuVersion: CATALOG.versionId }), deps(store))).status).toBe(400);
    const foreign = await createSession(post({ v: API_VERSION, sessionId: "s1", menuVersion: "some-other-version" }), deps(store));
    expect(foreign.status).toBe(409);
    expect(PersistenceErrorSchema.parse(await foreign.json()).error.code).toBe("MENU_VERSION_MISMATCH");
    expect((await createSession(create("s1", {}, ), deps(store, { activeVersionId: async () => null }))).status).toBe(503);
    expect((await createSession(post("x".repeat(40000)), deps(store))).status).toBe(413);
    expect((await createSession(create("s1"), deps(store, { persistenceMode: () => "off" }))).status).toBe(503);
    const declared = post({ v: API_VERSION, sessionId: "s1", menuVersion: CATALOG.versionId }, { "content-length": "99999" });
    expect((await createSession(declared, deps(store))).status).toBe(413);
    expect(sessions.size).toBe(0);
  });

  it("appends contiguous entries, ignores duplicates, refuses gaps, and 404s unknown sessions", async () => {
    const { store, audit } = memoryStore();
    const state = orderedEngine("s2");
    const entries = getView(state).audit;
    expect(entries.length).toBeGreaterThanOrEqual(6);
    expect((await appendEvents(events(entries.slice(0, 2)), "missing", deps(store))).status).toBe(404);
    await createSession(create("s2"), deps(store));
    const first = await appendEvents(events(entries.slice(0, 3)), "s2", deps(store));
    expect(PersistAckSchema.parse(await first.json()).savedSeq).toBe(3);
    const dup = await appendEvents(events(entries.slice(1, 4)), "s2", deps(store));
    expect(dup.status).toBe(200);
    expect(PersistAckSchema.parse(await dup.json()).savedSeq).toBe(4);
    const gap = await appendEvents(events(entries.slice(5)), "s2", deps(store));
    expect(gap.status).toBe(409);
    expect(PersistenceErrorSchema.parse(await gap.json()).error.code).toBe("AUDIT_SEQUENCE_GAP");
    expect(audit.get("s2")?.size).toBe(4);
    const onlyOld = await appendEvents(events(entries.slice(0, 2)), "s2", deps(store));
    expect(PersistAckSchema.parse(await onlyOld.json()).savedSeq).toBe(4);
    expect((await appendEvents(events([]), "s2", deps(store))).status).toBe(400);
  });

  it("stores a receipt only for a known session and exports a log that replays to the same view", async () => {
    const { store, receipts } = memoryStore();
    const state = orderedEngine("s3");
    const view = getView(state);
    expect(view.receipt).not.toBeNull();
    expect((await saveReceipt(post({ v: API_VERSION, receipt: view.receipt }), "s3", deps(store))).status).toBe(404);
    await createSession(create("s3", { allowedLocationIds: ["188", "109"] }), deps(store));
    await appendEvents(events(view.audit), "s3", deps(store));
    const saved = await saveReceipt(post({ v: API_VERSION, receipt: view.receipt }), "s3", deps(store));
    expect(saved.status).toBe(200);
    expect(receipts.size).toBe(1);
    const exported = await exportSession("s3", deps(store));
    expect(exported.status).toBe(200);
    const log = ExportLogSchema.parse(await exported.json()) as ExportLog;
    expect(log.audit.length).toBe(view.audit.length);
    expect(replayLog(JSON.stringify(log), CATALOG)).toEqual(view);
    expect(JSON.parse(exportLog(state))).toEqual(log);
    expect((await exportSession("nope", deps(store))).status).toBe(404);
  });

  it("maps store failures to a retryable 503 without leaking details", async () => {
    const { store } = memoryStore();
    const broken: OrdersStore = { ...store, maxSeq: async () => { throw new Error("connection refused at db.secret.host"); } };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await appendEvents(events([{ seq: 1, event: { type: "INPUT_STARTED" }, outcome: "applied", code: null }]), "s4", deps(broken));
    expect(response.status).toBe(503);
    const body = PersistenceErrorSchema.parse(await response.json());
    expect(body.error.retryable).toBe(true);
    expect(JSON.stringify(body)).not.toContain("secret.host");
    expect(spy.mock.calls.flat().join(" ")).not.toContain("secret.host");
    spy.mockRestore();
  });

  it("plans appends and validates path ids", () => {
    const entry = (seq: number): AuditEntry => ({ seq, event: { type: "INPUT_STARTED" }, outcome: "applied", code: null });
    expect(planAppend(0, [entry(2), entry(1)])).toEqual({ kind: "ok", fresh: [entry(1), entry(2)] });
    expect(planAppend(3, [entry(1), entry(4)])).toEqual({ kind: "ok", fresh: [entry(4)] });
    expect(planAppend(3, [entry(5)])).toEqual({ kind: "gap" });
    expect(planAppend(3, [entry(4), entry(6)])).toEqual({ kind: "gap" });
    expect(sessionIdFromParams("e2e-abc")).toBe("e2e-abc");
    expect(sessionIdFromParams("")).toBeNull();
    expect(sessionIdFromParams("x".repeat(101))).toBeNull();
    expect(sessionIdFromParams("%")).toBeNull();
    expect(sessionIdFromParams("%E0%A4%A")).toBeNull();
    expect(sessionIdFromParams("a%20b")).toBeNull();
    expect(sessionIdFromParams("2f1c9a0e-1d4b-4c6e-9b1a-7d2e3f4a5b6c")).toBe("2f1c9a0e-1d4b-4c6e-9b1a-7d2e3f4a5b6c");
  });

  it("caps the audit stored per session", async () => {
    const { store } = memoryStore();
    await createSession(create("s5"), deps(store));
    const entry = (seq: number): AuditEntry => ({ seq, event: { type: "INPUT_STARTED" }, outcome: "applied", code: null });
    const capped: OrdersStore = { ...store, maxSeq: async () => 999 };
    const ok = await appendEvents(events([entry(1000)]), "s5", deps(capped));
    expect(ok.status).toBe(200);
    const over = await appendEvents(events([entry(1000), entry(1001)]), "s5", deps(capped));
    expect(over.status).toBe(413);
    expect(PersistenceErrorSchema.parse(await over.json()).error.code).toBe("SESSION_LIMIT");
  });
});
