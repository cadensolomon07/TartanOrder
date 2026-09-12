// Write-behind persistence in the controller: ordering never waits on the port,
// entries are sent contiguously and only once, failures stop the chain until a
// manual retry, and a reset session ignores late results. No network here.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry, OrderView, Receipt, SessionCreateRequest, UiAction } from "@/contracts";
import { createOrderController } from "@/controller/controller";
import type { PersistOutcome, PersistPort } from "@/persistence/port";
import { CATALOG, MENU_VERSION } from "../helpers/catalog";

type CallInput =
  | { kind: "createSession"; input: Omit<SessionCreateRequest, "v"> }
  | { kind: "appendEvents"; sessionId: string; entries: AuditEntry[] }
  | { kind: "saveReceipt"; sessionId: string; receipt: Receipt };
type Call = CallInput & { resolve(outcome: PersistOutcome): void; reject(error: unknown): void };

/** Records every call; in auto mode acknowledges immediately, in hold mode waits for the test. */
function fakePort(options: { hold?: boolean; fail?: (call: Call) => PersistOutcome | null } = {}) {
  const calls: Call[] = [];
  let savedSeq = 0;
  const make = (partial: CallInput): Promise<PersistOutcome> => new Promise((resolve, reject) => {
    const call: Call = { ...partial, resolve, reject };
    calls.push(call);
    if (options.hold) return;
    const failure = options.fail?.(call) ?? null;
    if (failure) { resolve(failure); return; }
    if (call.kind === "appendEvents") savedSeq = Math.max(savedSeq, ...call.entries.map((entry) => entry.seq));
    resolve({ ok: true, savedSeq });
  });
  const port: PersistPort = {
    createSession: (input) => make({ kind: "createSession", input }),
    appendEvents: (sessionId, entries) => make({ kind: "appendEvents", sessionId, entries: [...entries] }),
    saveReceipt: (sessionId, receipt) => make({ kind: "saveReceipt", sessionId, receipt }),
  };
  return { port, calls, kinds: () => calls.map((call) => call.kind), appends: () => calls.filter((call): call is Extract<Call, { kind: "appendEvents" }> => call.kind === "appendEvents") };
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const add = (itemId: string): UiAction => ({ type: "MANUAL", ops: [{ type: "ADD", itemId, qty: 1, modifiers: [] }] });
const live: ReturnType<typeof createOrderController>[] = [];
afterEach(() => { for (const controller of live.splice(0)) controller.dispose(); });

function make(port: PersistPort | undefined, extra: Partial<Parameters<typeof createOrderController>[0]> = {}) {
  let sessions = 0;
  const controller = createOrderController({ catalog: CATALOG, interpret: vi.fn(), sessionId: () => `p${++sessions}`, persist: port, ...extra });
  live.push(controller);
  return controller;
}

/** Two burger rows, an ambiguous remove (clarify), a choice, Undo, review, confirm. */
async function runOrder(controller: ReturnType<typeof createOrderController>) {
  const snap = () => controller.getSnapshot();
  snap().act({ type: "MANUAL", ops: [{ type: "ADD", itemId: "burger", qty: 1, modifiers: [] }, { type: "ADD", itemId: "burger", qty: 2, modifiers: [] }] }); await settle();
  snap().act({ type: "MANUAL", ops: [{ type: "REMOVE", ref: { by: "item", itemId: "burger" } }] }); await settle();
  const pending = snap().state.pending!;
  expect(pending).not.toBeNull();
  snap().act({ type: "CHOOSE", pendingId: pending.id, choiceId: pending.choices[0].id }); await settle();
  snap().act({ type: "UNDO" }); await settle();
  snap().act({ type: "REVIEW" }); await settle();
  const review = snap().state.review!;
  snap().act({ type: "CONFIRM", reviewId: review.id, revision: review.revision }); await settle();
  return snap().state;
}

describe("write-behind persistence", () => {
  it("creates the session, then sends only fresh audit entries in order, then the receipt", async () => {
    const fake = fakePort();
    const controller = make(fake.port, { allowedLocationIds: ["demo"] });
    await settle();
    expect(fake.calls[0]).toMatchObject({ kind: "createSession", input: { sessionId: "p1", menuVersion: MENU_VERSION, allowedLocationIds: ["demo"] } });
    expect(controller.getSnapshot().persistence).toEqual({ state: "saved", savedSeq: 0, pendingCount: 0, message: null });
    const state = await runOrder(controller);
    expect(state.receipt).not.toBeNull();
    const sent = fake.appends().flatMap((call) => call.entries);
    expect(sent.map((entry) => entry.seq)).toEqual(state.audit.map((entry) => entry.seq));
    expect(sent).toEqual(state.audit);
    expect(fake.kinds()[0]).toBe("createSession");
    expect(fake.kinds().at(-1)).toBe("saveReceipt");
    expect(fake.calls.at(-1)).toMatchObject({ kind: "saveReceipt", sessionId: "p1", receipt: state.receipt });
    expect(fake.kinds().filter((kind) => kind === "saveReceipt")).toHaveLength(1);
    expect(controller.getSnapshot().persistence).toEqual({ state: "saved", savedSeq: state.audit.length, pendingCount: 0, message: null });
  });

  it("never awaits the port and coalesces edits made while a call is pending into one batch", async () => {
    const fake = fakePort({ hold: true });
    const controller = make(fake.port);
    expect(fake.kinds()).toEqual(["createSession"]);
    controller.getSnapshot().act(add("burger"));
    controller.getSnapshot().act(add("fries"));
    controller.getSnapshot().act(add("lemonade"));
    expect(controller.getSnapshot().state.lines).toHaveLength(3);
    expect(controller.getSnapshot().persistence).toEqual({ state: "saving", savedSeq: 0, pendingCount: 3, message: null });
    expect(fake.kinds()).toEqual(["createSession"]);
    fake.calls[0].resolve({ ok: true, savedSeq: 0 }); await settle();
    expect(fake.kinds()).toEqual(["createSession", "appendEvents"]);
    const batch = fake.appends()[0];
    expect(batch.entries.map((entry) => entry.seq)).toEqual([1, 2, 3]);
    batch.resolve({ ok: true, savedSeq: 3 }); await settle();
    expect(fake.appends()).toHaveLength(1);
    expect(controller.getSnapshot().persistence).toEqual({ state: "saved", savedSeq: 3, pendingCount: 0, message: null });
  });

  it("stops after a failed append, leaves the order untouched, and resends from savedSeq + 1 on retry", async () => {
    let failures = 1;
    const fake = fakePort({ fail: (call) => call.kind === "appendEvents" && failures-- > 0 ? { ok: false, code: "HTTP_503", message: "Saving to the server failed (503).", retryable: true } : null });
    const controller = make(fake.port);
    await settle();
    controller.getSnapshot().act(add("burger"));
    const view: OrderView = controller.getSnapshot().state;
    await settle();
    expect(controller.getSnapshot().state).toEqual(view);
    expect(controller.getSnapshot().persistence).toEqual({ state: "failed", savedSeq: 0, pendingCount: 1, message: "Saving to the server failed (503)." });
    controller.getSnapshot().act(add("fries")); await settle();
    expect(fake.appends()).toHaveLength(1);
    expect(controller.getSnapshot().persistence).toMatchObject({ state: "failed", pendingCount: 2 });
    controller.getSnapshot().retryPersistence();
    expect(controller.getSnapshot().persistence.state).toBe("saving");
    await settle();
    expect(fake.appends()).toHaveLength(2);
    expect(fake.appends()[1].entries.map((entry) => entry.seq)).toEqual([1, 2]);
    expect(controller.getSnapshot().persistence).toEqual({ state: "saved", savedSeq: 2, pendingCount: 0, message: null });
    controller.getSnapshot().retryPersistence();
    expect(fake.appends()).toHaveLength(2);
  });

  it("treats a rejecting port as a failure with a message and keeps the cart", async () => {
    const port: PersistPort = { createSession: async () => { throw new Error("offline"); }, appendEvents: async () => ({ ok: true, savedSeq: 0 }), saveReceipt: async () => ({ ok: true, savedSeq: 0 }) };
    const controller = make(port);
    controller.getSnapshot().act(add("burger"));
    await settle();
    expect(controller.getSnapshot().state.lines).toHaveLength(1);
    expect(controller.getSnapshot().persistence).toEqual({ state: "failed", savedSeq: 0, pendingCount: 1, message: "offline" });
  });

  it("reports saving off and never calls the port without one or with mode off", async () => {
    const fake = fakePort();
    const off = make(fake.port, { persistenceMode: "off" });
    off.getSnapshot().act(add("burger")); await settle();
    expect(fake.calls).toHaveLength(0);
    expect(off.getSnapshot().persistence).toEqual({ state: "off", savedSeq: 0, pendingCount: 0, message: "Server saving is off" });
    off.getSnapshot().retryPersistence();
    expect(fake.calls).toHaveLength(0);
    const none = make(undefined);
    none.getSnapshot().act(add("burger")); await settle();
    expect(none.getSnapshot().persistence.state).toBe("off");
  });

  it("starts a new server session on reset and ignores a late result for the old one", async () => {
    const fake = fakePort({ hold: true });
    const controller = make(fake.port);
    fake.calls[0].resolve({ ok: true, savedSeq: 0 }); await settle();
    controller.getSnapshot().act(add("burger")); await settle();
    expect(fake.kinds()).toEqual(["createSession", "appendEvents"]);
    const late = fake.appends()[0];
    controller.getSnapshot().reset();
    expect(controller.getSnapshot().state.sessionId).toBe("p2");
    expect(fake.kinds()).toEqual(["createSession", "appendEvents", "createSession"]);
    expect(fake.calls[2]).toMatchObject({ kind: "createSession", input: { sessionId: "p2" } });
    late.resolve({ ok: true, savedSeq: 1 }); await settle();
    expect(controller.getSnapshot().persistence).toEqual({ state: "saving", savedSeq: 0, pendingCount: 0, message: null });
    fake.calls[2].resolve({ ok: true, savedSeq: 0 }); await settle();
    expect(controller.getSnapshot().persistence).toEqual({ state: "saved", savedSeq: 0, pendingCount: 0, message: null });
    expect(fake.appends()).toHaveLength(1);
  });
});
