// Env-gated: runs only when .env.local supplies the Supabase keys
// (node --env-file=.env.local ./node_modules/.bin/vitest run tests/persistence/live.test.ts).
// Writes one e2e- session to the TartanHacks project and deletes it afterwards.
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ExportLogSchema } from "@/contracts";
import { createEngine, getView, reduceEngine, replayLog } from "@/core/engine";
import { CATALOG } from "../helpers/catalog";

const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEYS && process.env.SUPABASE_PUBLISHABLE_KEYS);
const sessionId = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

describe.skipIf(!configured)("order persistence against the TartanHacks project", () => {
  const LIVE_TIMEOUT_MS = 60000;
  afterAll(async () => {
    if (!configured) return;
    const { createOrdersStore } = await import("@/db/orders.server");
    const { createWriter } = await import("@/db/client.server");
    await createOrdersStore(createWriter()).deleteSession(sessionId);
  }, LIVE_TIMEOUT_MS);

  it("stores a clarified, undone, confirmed order and exports a log that replays to the same view", async () => {
    const { createOrdersStore } = await import("@/db/orders.server");
    const { createWriter, createReader } = await import("@/db/client.server");
    const store = createOrdersStore(createWriter());

    let state = createEngine(sessionId, { catalog: CATALOG, allowedLocationIds: ["188", "109"] });
    state = reduceEngine(state, { type: "UI", action: { type: "MANUAL", ops: [{ type: "ADD", itemId: "cmu_188_fresh_cut_fries", qty: 2, modifiers: [] }, { type: "ADD", itemId: "cmu_188_fresh_cut_fries", qty: 1, modifiers: [] }] } });
    state = reduceEngine(state, { type: "UI", action: { type: "MANUAL", ops: [{ type: "REMOVE", ref: { by: "item", itemId: "cmu_188_fresh_cut_fries" } }] } });
    const pending = getView(state).pending!;
    state = reduceEngine(state, { type: "UI", action: { type: "CHOOSE", pendingId: pending.id, choiceId: pending.choices[0].id } });
    state = reduceEngine(state, { type: "UI", action: { type: "UNDO" } });
    state = reduceEngine(state, { type: "UI", action: { type: "REVIEW" } });
    const review = getView(state).review!;
    state = reduceEngine(state, { type: "UI", action: { type: "CONFIRM", reviewId: review.id, revision: review.revision } });
    const view = getView(state);
    expect(view.receipt).not.toBeNull();

    expect(await store.createSession({ sessionId, menuVersion: CATALOG.versionId, allowedLocationIds: ["188", "109"] })).toEqual({ created: true });
    expect(await store.createSession({ sessionId, menuVersion: CATALOG.versionId })).toEqual({ created: false });
    await store.appendEvents(sessionId, view.audit.slice(0, 3));
    await store.appendEvents(sessionId, view.audit.slice(1)); // overlap is idempotent
    expect(await store.maxSeq(sessionId)).toBe(view.audit.length);
    await store.saveReceipt(sessionId, view.receipt!);
    await store.saveReceipt(sessionId, view.receipt!);

    const exported = await store.exportSession(sessionId);
    expect(exported).not.toBeNull();
    const log = ExportLogSchema.parse(exported);
    expect(log.menuVersion).toBe(CATALOG.versionId);
    expect(log.allowedLocationIds).toEqual(["188", "109"]);
    expect(replayLog(JSON.stringify(log), CATALOG)).toEqual(view);

    // The publishable key cannot see order rows: RLS with no policies.
    const reader = createReader();
    const visible = await reader.from("sessions").select("id").eq("id", sessionId);
    expect(visible.error).toBeNull();
    expect(visible.data).toEqual([]);
  }, LIVE_TIMEOUT_MS);
});
