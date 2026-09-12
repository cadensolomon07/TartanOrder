import { API_VERSION, MENU_VERSION, ParseRequestSchema, ParseResponseSchema, WaitEngineConfigSchema, SwapOfferSchema, type ParseResponse } from "./index";
import seedWaits from "../../config/wait-times.seed.json";
import equivalents from "../../config/equivalents.json";

export const WAIT_FIXTURE_CONFIG = WaitEngineConfigSchema.parse({
  snapshot: seedWaits, available: true, unavailableReason: null,
  evaluatedAt: "2026-09-12T14:00:00.000Z", ...equivalents,
  swapThresholdMinutes: 5, priceToleranceCents: 100,
});
export const WAIT_FIXTURE_OFFER = SwapOfferSchema.parse({
  offerId: "fixture-swap", originalLineId: "wait-order:0", revision: 2,
  waitSnapshotId: seedWaits.id, quantity: 2,
  original: { itemId: "cmu_188_nashville_sandwich_southern_style_fried_chicken", vendorId: "188", waitMinutes: 14, unitPriceCents: 920 },
  alternative: { itemId: "cmu_109_fried-chicken-sandwich", vendorId: "109", waitMinutes: 4, unitPriceCents: 999 },
  retainedModifiers: [], removedModifiers: [],
  differences: Object.values(equivalents.groups[0].differences),
  priceDifferenceCents: 158, currentCartEstimateMinutes: 14,
  projectedCartEstimateMinutes: 4, itemWaitReductionMinutes: 10, cartWaitReductionMinutes: 10,
});

/** Demonstration data is explicitly labelled fixture, never reported as live parsing. */
export const FIXTURE_REQUEST = ParseRequestSchema.parse({
  v: API_VERSION,
  requestId: "u1",
  baseRevision: 1,
  menuVersion: MENU_VERSION,
  text: "a burger, fries and lemonade",
  source: "fixture",
  asrConfidence: null,
});

export const FIXTURE_RESPONSE = ParseResponseSchema.parse({
  v: API_VERSION,
  requestId: "u1",
  baseRevision: 1,
  menuVersion: MENU_VERSION,
  parser: "fixture",
  fallbackReason: null,
  result: {
    kind: "proposal",
    ops: [
      { type: "ADD", itemId: "burger", qty: 1, modifiers: [] },
      { type: "ADD", itemId: "fries", qty: 1, modifiers: [] },
      { type: "ADD", itemId: "lemonade", qty: 1, modifiers: [] },
    ],
  },
});

export const FIXTURE_CLARIFICATION: ParseResponse = ParseResponseSchema.parse({
  ...FIXTURE_RESPONSE,
  requestId: "fixture-clarify",
  result: {
    kind: "clarify",
    question: "Would you like fries or lemonade?",
    choices: [
      { id: "fries", label: "Fries", ops: [{ type: "ADD", itemId: "fries", qty: 1, modifiers: [] }] },
      { id: "lemonade", label: "Lemonade", ops: [{ type: "ADD", itemId: "lemonade", qty: 1, modifiers: [] }] },
    ],
  },
});

export const FIXTURE_REJECTION: ParseResponse = ParseResponseSchema.parse({
  ...FIXTURE_RESPONSE,
  requestId: "fixture-reject",
  result: { kind: "reject", code: "OFF_MENU", message: "That item is not on our demonstration menu." },
});

export const FIXTURE_MIXED_ORDER: ParseResponse = ParseResponseSchema.parse({
  ...FIXTURE_RESPONSE,
  requestId: "fixture-mixed",
  result: {
    kind: "proposal",
    ops: [
      { type: "ADD", itemId: "burger", qty: 1, modifiers: [] },
      { type: "ADD", itemId: "lemonade", qty: 1, modifiers: [] },
    ],
    notices: [{ kind: "unavailable", item: "pizza" }],
  },
});

export const FIXTURE_RESOLUTION: ParseResponse = ParseResponseSchema.parse({
  ...FIXTURE_RESPONSE,
  requestId: "fixture-resolve",
  result: { kind: "resolve", pendingId: "fixture-pending", choiceId: "fries" },
});
