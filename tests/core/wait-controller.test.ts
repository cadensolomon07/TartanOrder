import { describe, expect, it, vi } from "vitest";
import { API_VERSION, MENU_VERSION, type ParseRequest, type ParseResponse } from "../../src/contracts";
import { WAIT_FIXTURE_CONFIG, WAIT_FIXTURE_OFFER } from "../../src/contracts/fixtures";
import { createOrderController } from "../../src/controller/controller";
import { replayLog } from "../../src/core/engine";

describe("wait controller integration", () => {
  it("sends the accepted item and selected vendor in subsequent context without wait recommendations", async () => {
    const interpret = vi.fn(async (request: ParseRequest): Promise<ParseResponse> => ({
      v: API_VERSION, menuVersion: MENU_VERSION, requestId: request.requestId,
      baseRevision: request.baseRevision, parser: "fixture", fallbackReason: null,
      result: { kind: "proposal", ops: [{ type: "SET_QTY", ref: { by: "last" }, qty: 2 }] },
    }));
    const store = createOrderController({ interpret, locationId: "188", waitConfig: WAIT_FIXTURE_CONFIG });
    store.getSnapshot().act({ type: "MANUAL", ops: [{ type: "ADD", itemId: WAIT_FIXTURE_OFFER.original.itemId, qty: 1, modifiers: [] }] });
    const offer = store.getSnapshot().state.swapOffer!;
    store.getSnapshot().act({ type: "ACCEPT_SWAP", offerId: offer.offerId, revision: offer.revision });
    expect(store.getSnapshot().locationId).toBe("109");
    expect(store.getSnapshot().assistant?.text).toContain("Updated to");
    await store.getSnapshot().submit("make that two", "text", null);
    const request = interpret.mock.calls[0][0];
    expect(request.locationId).toBe("109");
    expect(request.context?.lines[0].itemId).toBe(WAIT_FIXTURE_OFFER.alternative.itemId);
    expect(JSON.stringify(request)).not.toMatch(/waitSnapshot|waitMinutes|Simulated wait|swapOffer|quicker option/);
    expect(store.getSnapshot().state.totalCents).toBe(1998);
    expect(store.getSnapshot().state.wait?.estimateMinutes).toBe(4);
    expect(replayLog(store.getSnapshot().exportLog())).toEqual(store.getSnapshot().state);
    store.dispose();
  });

  it("dismisses before capture, rejects an old acceptance and resets the session suppression", () => {
    const store = createOrderController({ locationId: "188", waitConfig: WAIT_FIXTURE_CONFIG });
    const add = () => store.getSnapshot().act({ type: "MANUAL", ops: [{ type: "ADD", itemId: WAIT_FIXTURE_OFFER.original.itemId, qty: 1, modifiers: [] }] });
    add();
    const offer = store.getSnapshot().state.swapOffer!;
    store.getSnapshot().startInput();
    store.getSnapshot().act({ type: "ACCEPT_SWAP", offerId: offer.offerId, revision: offer.revision });
    expect(store.getSnapshot().state.swapOffer).toBeNull();
    expect(store.getSnapshot().state.totalCents).toBe(920);
    expect(store.getSnapshot().busy).toBe(true);
    store.getSnapshot().endInput();
    store.getSnapshot().reset();
    add();
    expect(store.getSnapshot().state.swapOffer).not.toBeNull();
    store.dispose();
  });
});
