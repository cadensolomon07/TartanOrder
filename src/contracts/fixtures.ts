import { API_VERSION, MENU_VERSION, ParseRequestSchema, ParseResponseSchema, type ParseResponse } from "./index";

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
