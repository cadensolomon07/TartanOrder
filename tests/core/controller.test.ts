import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrderController } from "../../src/controller/controller";
import { API_VERSION, ExportLogSchema, type InterpretOptions, type Op, type ParseRequest, type ParseResponse, type UiAction } from "../../src/contracts";
import { replayLog } from "../../src/core/engine";
import { CATALOG, MENU_VERSION } from "../helpers/catalog";

type Deferred<T> = { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const burger: Op = { type: "ADD", itemId: "burger", qty: 1, modifiers: [] };
const fries: Op = { type: "ADD", itemId: "fries", qty: 1, modifiers: [] };
const liveControllers: ReturnType<typeof createOrderController>[] = [];

function harness() {
  let sessions = 0;
  const calls: { request: ParseRequest; options: InterpretOptions; deferred: Deferred<ParseResponse> }[] = [];
  const interpret = vi.fn((request: ParseRequest, options: InterpretOptions) => {
    const result = deferred<ParseResponse>();
    calls.push({ request, options, deferred: result });
    return result.promise;
  });
  const controller = createOrderController({ catalog: CATALOG, interpret, sessionId: () => `test-session-${++sessions}` });
  liveControllers.push(controller);
  return { ...controller, calls, interpret };
}

function proposal(request: ParseRequest, ops: Op[] = [burger]): ParseResponse {
  return { v: API_VERSION, requestId: request.requestId, baseRevision: request.baseRevision, menuVersion: MENU_VERSION, parser: "rules", fallbackReason: null, result: { kind: "proposal", ops } };
}

function seedReview(controller: ReturnType<typeof harness>) {
  controller.getSnapshot().act({ type: "MANUAL", ops: [burger] });
  controller.getSnapshot().act({ type: "REVIEW" });
  const review = controller.getSnapshot().state.review;
  expect(review).not.toBeNull();
  if (!review) throw new Error("Expected review fixture.");
  return review;
}

afterEach(() => {
  for (const controller of liveControllers.splice(0)) controller.dispose();
});

describe("controller persistence default", () => {
  it("reports server saving as off and makes retry a no-op when no port is injected", () => {
    const controller = harness();
    expect(controller.getSnapshot().persistence).toEqual({ state: "off", savedSeq: 0, pendingCount: 0, message: "Server saving is off" });
    controller.getSnapshot().act({ type: "MANUAL", ops: [burger] });
    controller.getSnapshot().retryPersistence();
    expect(controller.getSnapshot().persistence.state).toBe("off");
    expect(controller.getSnapshot().state.lines).toHaveLength(1);
  });
});

describe("controller capture and review gates", () => {
  it("invalidates review synchronously at input start, before any parser work", () => {
    const controller = harness();
    const review = seedReview(controller);
    const lines = controller.getSnapshot().state.lines;
    controller.getSnapshot().startInput();
    const state = controller.getSnapshot();
    expect(state.busy).toBe(true);
    expect(state.state.phase).toBe("editing");
    expect(state.state.review).toBeNull();
    expect(state.state.pending).toBeNull();
    expect(state.state.revision).toBe(review.revision + 1);
    expect(state.state.lines).toEqual(lines);
    expect(controller.interpret).not.toHaveBeenCalled();

    state.act({ type: "REVIEW" });
    expect(controller.getSnapshot().state.review).toBeNull();
    state.act({ type: "CONFIRM", reviewId: review.id, revision: review.revision });
    expect(controller.getSnapshot().state.receipt).toBeNull();
    expect(controller.getSnapshot().notice).toMatch(/finish or cancel/i);
  });

  it("endInput releases abandoned capture without restoring a review or revision", () => {
    const controller = harness();
    const review = seedReview(controller);
    controller.getSnapshot().startInput();
    const revision = controller.getSnapshot().state.revision;
    controller.getSnapshot().endInput();
    expect(controller.getSnapshot().busy).toBe(false);
    expect(controller.getSnapshot().state.revision).toBe(revision);
    expect(controller.getSnapshot().state.review).toBeNull();
    controller.getSnapshot().act({ type: "CONFIRM", reviewId: review.id, revision: review.revision });
    expect(controller.getSnapshot().state.receipt).toBeNull();
    expect(controller.getSnapshot().notice).toMatch(/review the current order/i);
    controller.getSnapshot().act({ type: "REVIEW" });
    expect(controller.getSnapshot().state.review?.revision).toBe(revision);
  });

  it("manual edits preserve active draft or microphone capture until endInput", () => {
    const controller = harness();
    controller.getSnapshot().startInput();
    controller.getSnapshot().act({ type: "MANUAL", ops: [burger] });
    expect(controller.getSnapshot().busy).toBe(true);
    controller.getSnapshot().act({ type: "REVIEW" });
    expect(controller.getSnapshot().state.review).toBeNull();
    controller.getSnapshot().endInput();
    expect(controller.getSnapshot().busy).toBe(false);
    controller.getSnapshot().act({ type: "REVIEW" });
    expect(controller.getSnapshot().state.review?.totalCents).toBe(800);
  });

  it("submit ends capture, creates a fresh input revision, and remains busy until parsing settles", async () => {
    const controller = harness();
    const review = seedReview(controller);
    controller.getSnapshot().startInput();
    const inputRevision = controller.getSnapshot().state.revision;
    const submission = controller.getSnapshot().submit("  fries  ", "voice", 0.62);
    expect(controller.calls).toHaveLength(1);
    const call = controller.calls[0];
    expect(call.request).toMatchObject({ v: API_VERSION, menuVersion: MENU_VERSION, text: "fries", source: "voice", asrConfidence: 0.62, baseRevision: inputRevision + 1 });
    expect(call.options.catalog).toBe(CATALOG);
    expect(call.options.localOnly).toBe(false);
    expect(call.options.signal?.aborted).toBe(false);
    expect(controller.getSnapshot().busy).toBe(true);
    expect(controller.getSnapshot().state.review).toBeNull();
    controller.getSnapshot().endInput();
    expect(controller.getSnapshot().busy).toBe(true);
    controller.getSnapshot().act({ type: "REVIEW" });
    controller.getSnapshot().act({ type: "CONFIRM", reviewId: review.id, revision: review.revision });
    expect(controller.getSnapshot().state.review).toBeNull();
    expect(controller.getSnapshot().state.receipt).toBeNull();

    call.deferred.resolve(proposal(call.request, [fries]));
    await submission;
    expect(controller.getSnapshot().busy).toBe(false);
    expect(controller.getSnapshot().parser).toBe("rules");
    expect(controller.getSnapshot().state.totalCents).toBe(1100);
    controller.getSnapshot().act({ type: "REVIEW" });
    expect(controller.getSnapshot().state.review?.totalCents).toBe(1100);
  });

  it("empty or invalid input releases capture and invalidates the prior review without invoking parsing", async () => {
    const controller = harness();
    seedReview(controller);
    controller.getSnapshot().startInput();
    await controller.getSnapshot().submit("   ", "text", null);
    expect(controller.getSnapshot().busy).toBe(false);
    expect(controller.getSnapshot().state.review).toBeNull();
    expect(controller.getSnapshot().state.totalCents).toBe(800);
    expect(controller.getSnapshot().notice).toMatch(/format/i);
    expect(controller.interpret).not.toHaveBeenCalled();
  });

  it("new capture invalidates pending choices immediately", async () => {
    const controller = harness();
    const submission = controller.getSnapshot().submit("something", "text", null);
    const call = controller.calls[0];
    call.deferred.resolve({ ...proposal(call.request), result: { kind: "clarify", question: "Burger or fries?", choices: [{ id: "burger", label: "Burger", ops: [burger] }, { id: "fries", label: "Fries", ops: [fries] }] } });
    await submission;
    const pending = controller.getSnapshot().state.pending;
    expect(pending).not.toBeNull();
    const revision = controller.getSnapshot().state.revision;
    controller.getSnapshot().startInput();
    expect(controller.getSnapshot().state.pending).toBeNull();
    expect(controller.getSnapshot().state.phase).toBe("editing");
    expect(controller.getSnapshot().state.revision).toBe(revision + 1);
    controller.getSnapshot().endInput();
    controller.getSnapshot().act({ type: "CHOOSE", pendingId: pending!.id, choiceId: "burger" });
    expect(controller.getSnapshot().state.lines).toEqual([]);
    expect(controller.getSnapshot().notice).toMatch(/no longer active/i);
  });

  it("an invalid stale choice is an edit attempt and invalidates an existing review", () => {
    const controller = harness();
    const review = seedReview(controller);
    controller.getSnapshot().act({ type: "CHOOSE", pendingId: "expired", choiceId: "expired" });
    expect(controller.getSnapshot().state.review).toBeNull();
    expect(controller.getSnapshot().state.revision).toBeGreaterThan(review.revision);
    controller.getSnapshot().act({ type: "CONFIRM", reviewId: review.id, revision: review.revision });
    expect(controller.getSnapshot().state.receipt).toBeNull();
  });
});

describe("controller request cancellation and admission", () => {
  it.each(["manual", "clear", "reset", "capture"] as const)("ignores a late response after %s", async (cancellation) => {
    const controller = harness();
    const submission = controller.getSnapshot().submit("burger", "text", null);
    const call = controller.calls[0];
    if (cancellation === "manual") controller.getSnapshot().act({ type: "MANUAL", ops: [fries] });
    if (cancellation === "clear") controller.getSnapshot().act({ type: "CLEAR" });
    if (cancellation === "reset") controller.getSnapshot().reset();
    if (cancellation === "capture") controller.getSnapshot().startInput();
    expect(call.options.signal?.aborted).toBe(true);
    const before = controller.getSnapshot();
    call.deferred.resolve(proposal(call.request));
    await submission;
    expect(controller.getSnapshot()).toBe(before);
    expect(controller.getSnapshot().state.lines.some((line) => line.itemId === "burger")).toBe(false);
    expect(controller.getSnapshot().parser).toBe("none");
    expect(controller.getSnapshot().busy).toBe(cancellation === "capture");
    if (cancellation === "reset") {
      expect(controller.getSnapshot().state.sessionId).toBe("test-session-2");
      expect(controller.getSnapshot().state.revision).toBe(0);
      expect(controller.getSnapshot().state.audit).toEqual([]);
    }
  });

  it("a second submit aborts the first, and the first settling cannot clear the second's busy state", async () => {
    const controller = harness();
    const first = controller.getSnapshot().submit("burger", "text", null);
    const second = controller.getSnapshot().submit("fries", "text", null);
    const firstCall = controller.calls[0];
    const secondCall = controller.calls[1];
    expect(firstCall.options.signal?.aborted).toBe(true);
    expect(secondCall.options.signal?.aborted).toBe(false);
    expect(secondCall.request.requestId).not.toBe(firstCall.request.requestId);
    expect(secondCall.request.baseRevision).toBeGreaterThan(firstCall.request.baseRevision);
    firstCall.deferred.resolve(proposal(firstCall.request));
    await first;
    expect(controller.getSnapshot().busy).toBe(true);
    expect(controller.getSnapshot().state.lines).toEqual([]);
    secondCall.deferred.resolve(proposal(secondCall.request, [fries]));
    await second;
    expect(controller.getSnapshot().busy).toBe(false);
    expect(controller.getSnapshot().state.lines).toEqual([{ lineId: `${secondCall.request.requestId}:0`, itemId: "fries", qty: 1, modifiers: [] }]);
  });

  it("an old request resolving after the replacement completes cannot mutate the accepted order", async () => {
    const controller = harness();
    const first = controller.getSnapshot().submit("burger", "text", null);
    const second = controller.getSnapshot().submit("fries", "text", null);
    controller.calls[1].deferred.resolve(proposal(controller.calls[1].request, [fries]));
    await second;
    const before = controller.getSnapshot();
    controller.calls[0].deferred.resolve(proposal(controller.calls[0].request));
    await first;
    expect(controller.getSnapshot()).toBe(before);
    expect(controller.getSnapshot().state.totalCents).toBe(300);
  });

  it.each(["requestId", "revision", "menu", "schema"] as const)("does not admit a response with a mismatched %s", async (mismatch) => {
    const controller = harness();
    controller.getSnapshot().act({ type: "MANUAL", ops: [fries] });
    const submission = controller.getSnapshot().submit("burger", "text", null);
    const call = controller.calls[0];
    const before = controller.getSnapshot().state;
    const valid = proposal(call.request);
    const raw = mismatch === "requestId" ? { ...valid, requestId: "someone-else" }
      : mismatch === "revision" ? { ...valid, baseRevision: valid.baseRevision + 1 }
      : mismatch === "menu" ? { ...valid, menuVersion: "demo-v999" }
      : { ...valid, result: { kind: "proposal", ops: [{ ...burger, priceCents: 1 }] } };
    call.deferred.resolve(raw as ParseResponse);
    await submission;
    expect(controller.getSnapshot().state).toEqual(before);
    expect(controller.getSnapshot().state.totalCents).toBe(300);
    expect(controller.getSnapshot().busy).toBe(false);
    expect(controller.getSnapshot().parser).toBe("none");
    expect(controller.getSnapshot().notice).not.toBeNull();
    expect(controller.interpret).toHaveBeenCalledTimes(1);
  });

  it("rejects a previously accepted duplicate response returned for a new request", async () => {
    const controller = harness();
    const first = controller.getSnapshot().submit("burger", "text", null);
    const response = proposal(controller.calls[0].request);
    controller.calls[0].deferred.resolve(response);
    await first;
    expect(controller.getSnapshot().state.totalCents).toBe(800);
    const second = controller.getSnapshot().submit("burger again", "text", null);
    const before = controller.getSnapshot().state;
    controller.calls[1].deferred.resolve(response);
    await second;
    expect(controller.getSnapshot().state).toEqual(before);
    expect(controller.getSnapshot().state.lines).toHaveLength(1);
    expect(controller.getSnapshot().notice).toMatch(/outdated/i);
  });

  it("invalid manual edits cancel parsing and preserve the existing cart", async () => {
    const controller = harness();
    seedReview(controller);
    const submission = controller.getSnapshot().submit("fries", "text", null);
    controller.getSnapshot().act({ type: "MANUAL", ops: [{ ...burger, qty: 18000 }] } as UiAction);
    expect(controller.calls[0].options.signal?.aborted).toBe(true);
    expect(controller.getSnapshot().state.review).toBeNull();
    expect(controller.getSnapshot().state.totalCents).toBe(800);
    expect(controller.getSnapshot().busy).toBe(false);
    controller.calls[0].deferred.resolve(proposal(controller.calls[0].request, [fries]));
    await submission;
    expect(controller.getSnapshot().state.totalCents).toBe(800);
    expect(ExportLogSchema.safeParse(JSON.parse(controller.getSnapshot().exportLog())).success).toBe(true);
  });

  it("changing parser mode aborts the request without an automatic retry or fallback", async () => {
    const controller = harness();
    const first = controller.getSnapshot().submit("burger", "text", null);
    const firstCall = controller.calls[0];
    controller.getSnapshot().setLocalOnly(true);
    expect(firstCall.options.localOnly).toBe(false);
    expect(firstCall.options.signal?.aborted).toBe(true);
    expect(controller.getSnapshot().busy).toBe(false);
    const afterSwitch = controller.getSnapshot();
    firstCall.deferred.reject(new DOMException("Cancelled", "AbortError"));
    await first;
    expect(controller.getSnapshot()).toBe(afterSwitch);
    expect(controller.interpret).toHaveBeenCalledTimes(1);

    const second = controller.getSnapshot().submit("fries", "text", null);
    const secondCall = controller.calls[1];
    expect(secondCall.options.localOnly).toBe(true);
    controller.getSnapshot().setLocalOnly(true);
    expect(secondCall.options.signal?.aborted).toBe(false);
    expect(controller.getSnapshot().busy).toBe(true);
    controller.getSnapshot().setLocalOnly(false);
    expect(secondCall.options.signal?.aborted).toBe(true);
    secondCall.deferred.resolve(proposal(secondCall.request, [fries]));
    await second;
    expect(controller.getSnapshot().state.lines).toEqual([]);
    expect(controller.interpret).toHaveBeenCalledTimes(2);
  });

  it("mode changes invalidate existing review while preserving unfinished capture", () => {
    const controller = harness();
    const review = seedReview(controller);
    controller.getSnapshot().setLocalOnly(true);
    expect(controller.getSnapshot().state.review).toBeNull();
    expect(controller.getSnapshot().state.revision).toBe(review.revision + 1);
    controller.getSnapshot().startInput();
    controller.getSnapshot().setLocalOnly(false);
    expect(controller.getSnapshot().busy).toBe(true);
    expect(controller.getSnapshot().state.review).toBeNull();
    controller.getSnapshot().endInput();
    expect(controller.getSnapshot().busy).toBe(false);
  });

  it.each(["abort", "failure"] as const)("releases busy after an active parser %s without retrying", async (kind) => {
    const controller = harness();
    const submission = controller.getSnapshot().submit("burger", "text", null);
    controller.calls[0].deferred.reject(kind === "abort" ? new DOMException("Cancelled", "AbortError") : new Error("Unavailable"));
    await submission;
    expect(controller.getSnapshot().busy).toBe(false);
    expect(controller.getSnapshot().state.lines).toEqual([]);
    expect(controller.interpret).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().notice).toBe(kind === "abort" ? null : "Understanding is unavailable. Choose Local only for simple typed orders, or use the menu.");
  });

  it("formats rejected edits from the engine code and labels fallback truthfully", async () => {
    const controller = harness();
    const rejected = controller.getSnapshot().submit("pizza", "text", null);
    controller.calls[0].deferred.resolve({ ...proposal(controller.calls[0].request), result: { kind: "reject", code: "OFF_MENU", message: "I added pizza successfully." } });
    await rejected;
    expect(controller.getSnapshot().notice).toMatch(/isn.t on our demo menu/i);
    expect(controller.getSnapshot().assistant?.text).not.toMatch(/added pizza/i);
    expect(controller.getSnapshot().parser).toBe("rules");
    expect(controller.getSnapshot().state.lines).toEqual([]);
    const fallback = controller.getSnapshot().submit("burger", "text", null);
    controller.calls[1].deferred.resolve({ ...proposal(controller.calls[1].request), fallbackReason: "PROVIDER_UNAVAILABLE" });
    await fallback;
    expect(controller.getSnapshot().parser).toBe("rules");
    expect(controller.getSnapshot().notice).toMatch(/^Using local rules \(PROVIDER_UNAVAILABLE\)/);
    expect(controller.getSnapshot().state.totalCents).toBe(800);
  });
});

describe("controller commit, reset and replay", () => {
  it("requires a review and produces exactly one immutable simulated receipt across repeated confirmations", async () => {
    const controller = harness();
    controller.getSnapshot().act({ type: "MANUAL", ops: [burger] });
    controller.getSnapshot().act({ type: "CONFIRM", reviewId: "invented", revision: 1 });
    expect(controller.getSnapshot().state.receipt).toBeNull();
    controller.getSnapshot().act({ type: "REVIEW" });
    const review = controller.getSnapshot().state.review!;
    const confirmation: UiAction = { type: "CONFIRM", reviewId: review.id, revision: review.revision };
    controller.getSnapshot().act(confirmation);
    const receipt = controller.getSnapshot().state.receipt;
    expect(receipt).toMatchObject({ reviewId: review.id, lines: review.lines, totalCents: review.totalCents, simulated: true });
    expect(controller.getSnapshot().state.phase).toBe("committed");
    controller.getSnapshot().act(confirmation);
    controller.getSnapshot().act(confirmation);
    expect(controller.getSnapshot().state.receipt).toEqual(receipt);
    controller.getSnapshot().act({ ...confirmation, reviewId: "different" });
    expect(controller.getSnapshot().state.receipt).toEqual(receipt);
    expect(controller.getSnapshot().notice).toMatch(/review the current order/i);

    for (const action of [{ type: "MANUAL", ops: [fries] }, { type: "UNDO" }, { type: "CLEAR" }, { type: "REVIEW" }, { type: "CHOOSE", pendingId: "expired", choiceId: "expired" }] satisfies UiAction[]) {
      controller.getSnapshot().act(action);
      expect(controller.getSnapshot().state.receipt).toEqual(receipt);
      expect(controller.getSnapshot().state.lines).toEqual(review.lines);
      expect(controller.getSnapshot().state.revision).toBe(review.revision);
      expect(controller.getSnapshot().state.phase).toBe("committed");
    }
    controller.getSnapshot().startInput();
    await controller.getSnapshot().submit("fries", "text", null);
    controller.getSnapshot().setLocalOnly(true);
    expect(controller.getSnapshot().state.receipt).toEqual(receipt);
    expect(controller.getSnapshot().busy).toBe(false);
    expect(controller.interpret).not.toHaveBeenCalled();
  });

  it("reset creates a new session with no receipt, audit, history or parser state", async () => {
    const controller = harness();
    const review = seedReview(controller);
    controller.getSnapshot().act({ type: "CONFIRM", reviewId: review.id, revision: review.revision });
    const oldSession = controller.getSnapshot().state.sessionId;
    controller.getSnapshot().reset();
    expect(controller.getSnapshot()).toMatchObject({ busy: false, parser: "none", notice: null, state: { sessionId: "test-session-2", revision: 0, phase: "editing", lines: [], receipt: null, review: null, pending: null, audit: [], lastLineId: null, totalCents: 0 } });
    expect(controller.getSnapshot().state.sessionId).not.toBe(oldSession);
    controller.getSnapshot().act({ type: "UNDO" });
    expect(controller.getSnapshot().state.lines).toEqual([]);
    expect(controller.getSnapshot().notice).toMatch(/no earlier cart edits/i);
    const submission = controller.getSnapshot().submit("fries", "text", null);
    controller.calls[0].deferred.resolve(proposal(controller.calls[0].request, [fries]));
    await submission;
    expect(controller.getSnapshot().state.totalCents).toBe(300);
  });

  it("export replays the controller's accepted transaction without parser calls or changing the live order", async () => {
    const controller = harness();
    const submission = controller.getSnapshot().submit("burger", "text", null);
    controller.calls[0].deferred.resolve(proposal(controller.calls[0].request));
    await submission;
    controller.getSnapshot().act({ type: "MANUAL", ops: [fries] });
    controller.getSnapshot().act({ type: "UNDO" });
    controller.getSnapshot().act({ type: "REVIEW" });
    const review = controller.getSnapshot().state.review!;
    controller.getSnapshot().act({ type: "CONFIRM", reviewId: review.id, revision: review.revision });
    const before = controller.getSnapshot();
    const json = before.exportLog();
    expect(ExportLogSchema.safeParse(JSON.parse(json)).success).toBe(true);
    const replay = replayLog(json, CATALOG);
    expect(replay).toEqual(before.state);
    expect(controller.getSnapshot()).toBe(before);
    expect(controller.interpret).toHaveBeenCalledTimes(1);
  });
});
