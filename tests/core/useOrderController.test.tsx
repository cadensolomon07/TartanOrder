// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOrderController } from "../../src/controller/useOrderController";
import { replayLog } from "../../src/core/engine";
import { FIXTURE_CLARIFICATION, FIXTURE_REJECTION, FIXTURE_REQUEST, FIXTURE_RESPONSE } from "../../src/contracts/fixtures";
import type { InterpretOptions, ParseRequest, ParseResponse } from "../../src/contracts";
import { interpret } from "../../src/parser/client";
import { CATALOG } from "../helpers/catalog";

vi.mock("../../src/parser/client", () => ({ interpret: vi.fn() }));

type PendingCall = {
  request: ParseRequest;
  options: InterpretOptions;
  resolve(response: ParseResponse): void;
};

const calls: PendingCall[] = [];
const interpretMock = vi.mocked(interpret);
const fetchMock = vi.fn();

function responseFor(call: PendingCall, fixture: ParseResponse): ParseResponse {
  return { ...fixture, requestId: call.request.requestId, baseRevision: call.request.baseRevision, menuVersion: call.request.menuVersion };
}

beforeEach(() => {
  calls.length = 0;
  interpretMock.mockReset();
  interpretMock.mockImplementation((request, options) => new Promise<ParseResponse>((resolve) => {
    calls.push({ request, options, resolve });
  }));
  fetchMock.mockReset();
  fetchMock.mockRejectedValue(new Error("This fixture-only hook test must not call HTTP."));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useOrderController persistence wiring", () => {
  it("keeps saving off by default and uses an injected port in supabase mode without any fetch", async () => {
    const off = renderHook(() => useOrderController(CATALOG), { wrapper: StrictMode });
    expect(off.result.current.persistence.state).toBe("off");
    const createSession = vi.fn(async () => ({ ok: true as const, savedSeq: 0 }));
    const port = { createSession, appendEvents: vi.fn(async () => ({ ok: true as const, savedSeq: 1 })), saveReceipt: vi.fn(async () => ({ ok: true as const, savedSeq: 1 })) };
    const on = renderHook(() => useOrderController(CATALOG, "demo", undefined, undefined, { mode: "supabase", port }), { wrapper: StrictMode });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId: on.result.current.state.sessionId }));
    expect(on.result.current.persistence.state).toBe("saved");
    act(() => on.result.current.act({ type: "MANUAL", ops: [{ type: "ADD", itemId: "burger", qty: 1, modifiers: [] }] }));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(port.appendEvents).toHaveBeenCalledTimes(1);
    expect(on.result.current.persistence).toEqual({ state: "saved", savedSeq: 1, pendingCount: 0, message: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useOrderController React lifecycle", () => {
  it("publishes fixture input, invalidates review, and keeps cancellation/export/replay isolated from live actions", async () => {
    const { result } = renderHook(() => useOrderController(CATALOG), { wrapper: StrictMode });
    let submission!: Promise<void>;
    act(() => {
      submission = result.current.submit(FIXTURE_REQUEST.text, "fixture", null);
    });
    expect(result.current.busy).toBe(true);
    expect(calls[0].request.source).toBe("fixture");
    await act(async () => {
      calls[0].resolve(responseFor(calls[0], FIXTURE_RESPONSE));
      await submission;
    });
    expect(result.current.busy).toBe(false);
    expect(result.current.parser).toBe("fixture");
    expect(result.current.state.lines.map((line) => line.itemId)).toEqual(["burger", "fries", "lemonade"]);
    expect(result.current.state.totalCents).toBe(1350);

    act(() => result.current.act({ type: "REVIEW" }));
    const originalReview = result.current.state.review!;
    act(() => result.current.startInput());
    expect(result.current.state.review).toBeNull();
    expect(result.current.state.revision).toBe(originalReview.revision + 1);
    expect(result.current.busy).toBe(true);
    act(() => result.current.endInput());
    expect(result.current.busy).toBe(false);
    expect(result.current.state.review).toBeNull();

    let cancelled!: Promise<void>;
    act(() => { cancelled = result.current.submit("cancel this fixture", "fixture", null); });
    const cancelledCall = calls[1];
    expect(result.current.busy).toBe(true);
    act(() => result.current.startInput());
    expect(cancelledCall.options.signal?.aborted).toBe(true);
    act(() => result.current.endInput());
    const cancelledExport = result.current.exportLog();
    const afterCancellation = result.current;
    await act(async () => {
      cancelledCall.resolve(responseFor(cancelledCall, FIXTURE_RESPONSE));
      await cancelled;
    });
    expect(result.current).toBe(afterCancellation);
    expect(result.current.exportLog()).toBe(cancelledExport);
    expect(replayLog(cancelledExport, CATALOG)).toEqual(result.current.state);
    expect(interpretMock).toHaveBeenCalledTimes(2);

    act(() => result.current.act({ type: "REVIEW" }));
    const review = result.current.state.review!;
    act(() => result.current.act({ type: "CONFIRM", reviewId: review.id, revision: review.revision }));
    expect(result.current.state.phase).toBe("committed");
    expect(result.current.state.receipt).toMatchObject({ reviewId: review.id, lines: review.lines, totalCents: 1350, simulated: true });
    const committed = result.current;
    const exported = result.current.exportLog();
    const replay = replayLog(exported, CATALOG);
    expect(replay).toEqual(committed.state);
    replay.lines[0].qty = 5;
    replay.audit.length = 0;
    expect(result.current).toBe(committed);
    expect(result.current.state.lines[0].qty).toBe(1);
    expect(result.current.exportLog()).toBe(exported);
    expect(interpretMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts an unmounted StrictMode session and ignores its late result after an independent remount", async () => {
    let oldRenders = 0;
    const previous = renderHook(() => {
      oldRenders += 1;
      return useOrderController(CATALOG);
    }, { wrapper: StrictMode });
    let oldSubmission!: Promise<void>;
    act(() => { oldSubmission = previous.result.current.submit(FIXTURE_REQUEST.text, "fixture", null); });
    const oldCall = calls[0];
    const oldController = previous.result.current;
    const oldExport = oldController.exportLog();
    const oldSessionId = oldController.state.sessionId;
    expect(oldController.busy).toBe(true);
    previous.unmount();
    expect(oldCall.options.signal?.aborted).toBe(true);
    const unmountedRenderCount = oldRenders;

    let newRenders = 0;
    const current = renderHook(() => {
      newRenders += 1;
      return useOrderController(CATALOG);
    }, { wrapper: StrictMode });
    expect(current.result.current.state.sessionId).not.toBe(oldSessionId);
    expect(current.result.current.state.lines).toEqual([]);
    expect(current.result.current.busy).toBe(false);
    let clarification!: Promise<void>;
    act(() => { clarification = current.result.current.submit("fixture choice", "fixture", null); });
    const newCall = calls[1];
    expect(newCall.options.signal?.aborted).toBe(false);
    await act(async () => {
      newCall.resolve(responseFor(newCall, FIXTURE_CLARIFICATION));
      await clarification;
    });
    expect(current.result.current.parser).toBe("fixture");
    expect(current.result.current.state.phase).toBe("clarifying");
    expect(current.result.current.state.pending?.question).toBe(FIXTURE_CLARIFICATION.result.kind === "clarify" ? FIXTURE_CLARIFICATION.result.question : "");
    const beforeLateResponse = current.result.current;
    const currentRenderCount = newRenders;

    await act(async () => {
      oldCall.resolve(responseFor(oldCall, FIXTURE_RESPONSE));
      await oldSubmission;
    });
    expect(oldRenders).toBe(unmountedRenderCount);
    expect(oldController.exportLog()).toBe(oldExport);
    expect(newRenders).toBe(currentRenderCount);
    expect(current.result.current).toBe(beforeLateResponse);
    expect(current.result.current.state.lines).toEqual([]);

    let rejection!: Promise<void>;
    act(() => { rejection = current.result.current.submit("fixture off-menu", "fixture", null); });
    await act(async () => {
      calls[2].resolve(responseFor(calls[2], FIXTURE_REJECTION));
      await rejection;
    });
    expect(current.result.current.state.pending).toBeNull();
    expect(current.result.current.state.lines).toEqual([]);
    expect(current.result.current.parser).toBe("fixture");
    // Rejection copy is application-owned; a model cannot claim a cart edit.
    expect(current.result.current.notice).toMatch(/isn't on our demo menu/);
    expect(current.result.current.busy).toBe(false);
    expect(interpretMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
