import { describe, expect, it } from "vitest";
import { SwapOfferSchema, WaitEngineConfigSchema, WaitTimeSnapshotSchema, UiActionSchema, ModelOpSchema } from "../../src/contracts";
import { WAIT_FIXTURE_CONFIG, WAIT_FIXTURE_OFFER } from "../../src/contracts/fixtures";

describe("strict wait contracts", () => {
  it("validates shared fixtures, nullable unknown waits and exact UI intents", () => {
    expect(WaitEngineConfigSchema.parse(WAIT_FIXTURE_CONFIG)).toEqual(WAIT_FIXTURE_CONFIG);
    expect(SwapOfferSchema.parse(WAIT_FIXTURE_OFFER)).toEqual(WAIT_FIXTURE_OFFER);
    expect(UiActionSchema.safeParse({ type: "ACCEPT_SWAP", offerId: "offer", revision: 2 }).success).toBe(true);
    expect(UiActionSchema.safeParse({ type: "DECLINE_SWAP", offerId: "offer" }).success).toBe(true);
    expect(ModelOpSchema.safeParse({ type: "ACCEPT_SWAP", offerId: "offer", revision: 2 }).success).toBe(false);
  });
  it("rejects nonfinite, negative, arbitrary vendor and extra snapshot fields", () => {
    for (const waits of [{ "188": -1 }, { "188": Infinity }, { "188": NaN }, { arbitrary: 4 }]) {
      expect(WaitTimeSnapshotSchema.safeParse({ ...WAIT_FIXTURE_CONFIG.snapshot, waits }).success).toBe(false);
    }
    expect(WaitTimeSnapshotSchema.safeParse({ ...WAIT_FIXTURE_CONFIG.snapshot, live: true }).success).toBe(false);
    expect(SwapOfferSchema.safeParse({ ...WAIT_FIXTURE_OFFER, quantity: 0 }).success).toBe(false);
  });
});
