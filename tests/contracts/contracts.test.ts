import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  API_VERSION, MENU_VERSION, ApiErrorSchema, AuditEntrySchema, ExportLogSchema,
  HealthResponseSchema, IdSchema, LineSchema, LinesSchema, ModelParseResultSchema,
  ModelRefSchema, OpSchema, OpsSchema, OrderViewSchema, ParseRequestSchema,
  ParseResponseSchema, ParseResultSchema, ReceiptSchema, RefSchema, ReviewSchema,
  UiActionSchema,
} from "../../src/contracts";
import { FIXTURE_CLARIFICATION, FIXTURE_REJECTION, FIXTURE_REQUEST, FIXTURE_RESPONSE } from "../../src/contracts/fixtures";
import { DEMO_DISCLOSURE, MENU, MODIFIERS } from "../../src/contracts/menu";

const addBurger = { type: "ADD", itemId: "burger", qty: 1, modifiers: [] } as const;
const line = { lineId: "u1:0", itemId: "burger", qty: 1, modifiers: [] };
const review = { id: "session:review:2", revision: 2, lines: [line], totalCents: 800 };
const receipt = { id: "session:receipt:2", reviewId: review.id, lines: [line], totalCents: 800, simulated: true };
const audit = { seq: 1, event: { type: "INPUT_STARTED" }, outcome: "applied", code: null };

describe("shared strict contract V1", () => {
  it("exports the agreed API and menu versions and honest fixture envelopes", () => {
    expect(API_VERSION).toBe(1);
    expect(MENU_VERSION).toBe("demo-v1");
    expect(ParseRequestSchema.parse(FIXTURE_REQUEST).source).toBe("fixture");
    for (const response of [FIXTURE_RESPONSE, FIXTURE_CLARIFICATION, FIXTURE_REJECTION]) {
      expect(ParseResponseSchema.parse(response).parser).toBe("fixture");
    }
  });

  it("accepts the canonical actual-rules request and response shape", () => {
    expect(ParseRequestSchema.parse({ ...FIXTURE_REQUEST, source: "text" }).text).toBe("a burger, fries and lemonade");
    expect(ParseResponseSchema.parse({ ...FIXTURE_RESPONSE, parser: "rules" }).result).toEqual({
      kind: "proposal",
      ops: [addBurger, { type: "ADD", itemId: "fries", qty: 1, modifiers: [] }, { type: "ADD", itemId: "lemonade", qty: 1, modifiers: [] }],
    });
  });

  it.each([
    [ParseRequestSchema, FIXTURE_REQUEST],
    [ParseResponseSchema, FIXTURE_RESPONSE],
    [ParseResultSchema, { kind: "proposal", ops: [addBurger] }],
    [RefSchema, { by: "last" }],
    [OpSchema, addBurger],
    [LineSchema, line],
    [ReviewSchema, review],
    [ReceiptSchema, receipt],
    [UiActionSchema, { type: "REVIEW" }],
    [AuditEntrySchema, audit],
    [ExportLogSchema, { v: 1, menuVersion: "demo-v1", sessionId: "session", audit: [] }],
    [ApiErrorSchema, { v: 1, requestId: null, error: { code: "INVALID_REQUEST", message: "Invalid request.", retryable: false } }],
    [HealthResponseSchema, { v: 1, menuVersion: "demo-v1", parser: "rules" }],
  ])("rejects additional object keys for schema %#", (schema, valid) => {
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({ ...valid, unexpected: true }).success).toBe(false);
  });

  it("rejects nested unknown fields, prices, receipts and parser review/confirm commands", () => {
    expect(ParseResponseSchema.safeParse({ ...FIXTURE_RESPONSE, result: { kind: "proposal", ops: [{ ...addBurger, priceCents: 1 }] } }).success).toBe(false);
    expect(OpSchema.safeParse({ type: "REMOVE", ref: { by: "last", lineId: "u1:0" } }).success).toBe(false);
    expect(ParseResultSchema.safeParse({ kind: "proposal", ops: [{ type: "REVIEW" }] }).success).toBe(false);
    expect(ParseResultSchema.safeParse({ kind: "proposal", ops: [{ type: "CONFIRM", reviewId: "r", revision: 1 }] }).success).toBe(false);
    expect(ParseResultSchema.safeParse({ kind: "proposal", ops: [addBurger], receipt }).success).toBe(false);
  });

  it("allows explicit line references only outside the model-facing schema", () => {
    const explicit = { type: "REMOVE", ref: { by: "line", lineId: "u1:0" } };
    expect(OpSchema.safeParse(explicit).success).toBe(true);
    expect(ModelRefSchema.safeParse(explicit.ref).success).toBe(false);
    expect(ModelParseResultSchema.safeParse({ kind: "proposal", ops: [explicit] }).success).toBe(false);
    expect(ModelParseResultSchema.safeParse({ kind: "proposal", ops: [{ type: "REMOVE", ref: { by: "item", itemId: "burger" } }] }).success).toBe(true);
    expect(ModelParseResultSchema.safeParse({ kind: "clarify", question: "Which burger?", choices: [{ id: "one", label: "First", ops: [explicit] }] }).success).toBe(false);
  });

  it("can generate a JSON schema directly from the shared model-facing schema", () => {
    const schema = z.toJSONSchema(ModelParseResultSchema);
    expect(schema).toHaveProperty("$schema");
    expect(JSON.stringify(schema)).toContain('"additionalProperties":false');
    expect(JSON.stringify(schema)).not.toContain('"lineId"');
  });

  it.each([0, -1, 6, 18000, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid quantity %s without clamping", (qty) => {
    expect(OpSchema.safeParse({ ...addBurger, qty }).success).toBe(false);
    expect(LineSchema.safeParse({ ...line, qty }).success).toBe(false);
  });

  it("enforces bounded nonempty batches and standalone UNDO", () => {
    expect(OpsSchema.safeParse([]).success).toBe(false);
    expect(OpsSchema.safeParse(Array.from({ length: 8 }, () => addBurger)).success).toBe(true);
    expect(OpsSchema.safeParse(Array.from({ length: 9 }, () => addBurger)).success).toBe(false);
    expect(OpsSchema.safeParse([{ type: "UNDO" }]).success).toBe(true);
    expect(OpsSchema.safeParse([addBurger, { type: "UNDO" }]).success).toBe(false);
  });

  it("restricts menu IDs and disallows duplicate modifiers", () => {
    expect(OpSchema.safeParse({ ...addBurger, itemId: "pizza" }).success).toBe(false);
    expect(OpSchema.safeParse({ ...addBurger, modifiers: ["bacon"] }).success).toBe(false);
    expect(OpSchema.safeParse({ ...addBurger, modifiers: ["double", "double"] }).success).toBe(false);
    expect(OpSchema.safeParse({ ...addBurger, modifiers: ["double", "no_onions", "extra_cheese"] }).success).toBe(true);
  });

  it("bounds choices, messages, labels, and unique choice IDs", () => {
    const choice = { id: "c", label: "Burger", ops: [addBurger] };
    const clarify = (choices: unknown[]) => ({ kind: "clarify", question: "Which one?", choices });
    expect(ParseResultSchema.safeParse(clarify([])).success).toBe(false);
    expect(ParseResultSchema.safeParse(clarify([choice])).success).toBe(true);
    expect(ParseResultSchema.safeParse(clarify([choice, choice])).success).toBe(false);
    expect(ParseResultSchema.safeParse(clarify(Array.from({ length: 4 }, (_, i) => ({ ...choice, id: String(i) })))).success).toBe(false);
    expect(ParseResultSchema.safeParse({ ...clarify([choice]), question: "x".repeat(161) }).success).toBe(false);
    expect(ParseResultSchema.safeParse(clarify([{ ...choice, label: "x".repeat(101) }])).success).toBe(false);
    expect(ParseResultSchema.safeParse(clarify([{ ...choice, ops: [] }])).success).toBe(false);
    expect(ParseResultSchema.safeParse({ kind: "reject", code: "OFF_MENU", message: "x".repeat(161) }).success).toBe(false);
  });

  it("bounds every transcript and ID while retaining the agreed 100-character ID limit", () => {
    expect(ParseRequestSchema.safeParse({ ...FIXTURE_REQUEST, text: "x".repeat(500) }).success).toBe(true);
    expect(ParseRequestSchema.safeParse({ ...FIXTURE_REQUEST, text: "x".repeat(501) }).success).toBe(false);
    expect(ParseRequestSchema.safeParse({ ...FIXTURE_REQUEST, text: "" }).success).toBe(false);
    expect(IdSchema.safeParse("x".repeat(100)).success).toBe(true);
    expect(IdSchema.safeParse("x".repeat(101)).success).toBe(false);
    expect(ParseRequestSchema.safeParse({ ...FIXTURE_REQUEST, requestId: "x".repeat(100) }).success).toBe(true);
    expect(LineSchema.safeParse({ ...line, lineId: `${"x".repeat(100)}:0` }).success).toBe(false);
  });

  it("requires exact versions, nonnegative integer revisions, and diagnostic confidence within 0..1", () => {
    for (const replacement of [{ v: 2 }, { menuVersion: "demo-v2" }, { baseRevision: -1 }, { baseRevision: 1.5 }, { asrConfidence: -0.1 }, { asrConfidence: 1.1 }]) {
      expect(ParseRequestSchema.safeParse({ ...FIXTURE_REQUEST, ...replacement }).success).toBe(false);
    }
    for (const asrConfidence of [null, 0, 0.5, 1]) {
      expect(ParseRequestSchema.safeParse({ ...FIXTURE_REQUEST, asrConfidence }).success).toBe(true);
    }
  });

  it("bounds cart snapshots and enforces distinct line IDs and integer-cent totals", () => {
    expect(LinesSchema.safeParse(Array.from({ length: 6 }, (_, i) => ({ ...line, lineId: String(i) }))).success).toBe(false);
    expect(LinesSchema.safeParse([{ ...line, qty: 5 }, { ...line, lineId: "b", qty: 5 }]).success).toBe(true);
    expect(LinesSchema.safeParse([{ ...line, qty: 5 }, { ...line, lineId: "b", qty: 5 }, { ...line, lineId: "c" }]).success).toBe(false);
    expect(LinesSchema.safeParse([line, line]).success).toBe(false);
    expect(ReviewSchema.safeParse({ ...review, lines: [] }).success).toBe(false);
    expect(ReviewSchema.safeParse({ ...review, totalCents: 800.1 }).success).toBe(false);
    expect(ReceiptSchema.safeParse({ ...receipt, simulated: false }).success).toBe(false);
  });

  it("accepts the complete initial order view and rejects nested state extras", () => {
    const state = { sessionId: "session", revision: 0, phase: "editing", lines: [], lastLineId: null, pending: null, review: null, receipt: null, totalCents: 0, audit: [] };
    expect(OrderViewSchema.safeParse(state).success).toBe(true);
    expect(OrderViewSchema.safeParse({ ...state, balanceCents: 0 }).success).toBe(false);
    expect(OrderViewSchema.safeParse({ ...state, pending: { id: "p", question: "Which one?", choices: [{ id: "c", label: "Burger", ops: [addBurger], extra: true }] } }).success).toBe(false);
    expect(AuditEntrySchema.safeParse({ ...audit, event: { type: "INPUT_STARTED", transcript: "unrecorded" } }).success).toBe(false);
    expect(ApiErrorSchema.safeParse({ v: 1, requestId: null, error: { code: "INVALID_REQUEST", message: "Bad request.", retryable: false, secret: "no" } }).success).toBe(false);
  });
});

describe("agreed V1 codes", () => {
  it("rejects new parser, fallback, API, and audit codes until the contract is updated", () => {
    expect(ParseResultSchema.safeParse({kind:"reject",code:"INVENTED",message:"No."}).success).toBe(false);
    expect(ModelParseResultSchema.safeParse({kind:"reject",code:"RATE_LIMITED",message:"No."}).success).toBe(false);
    expect(ParseResponseSchema.safeParse({...FIXTURE_RESPONSE,fallbackReason:"INVENTED"}).success).toBe(false);
    expect(ApiErrorSchema.safeParse({v:1,requestId:null,error:{code:"INVENTED",message:"No.",retryable:false}}).success).toBe(false);
    expect(AuditEntrySchema.safeParse({...audit,code:"INVENTED"}).success).toBe(false);
  });
});

describe("authoritative seeded menu", () => {
  it("has exactly the specified illustrative prices and aliases", () => {
    expect(Object.keys(MENU)).toEqual(["burger", "fries", "lemonade"]);
    expect(MENU.burger.priceCents + MENU.fries.priceCents + MENU.lemonade.priceCents).toBe(1350);
    expect(MODIFIERS.double.priceCents).toBe(250);
    expect(MODIFIERS.extra_cheese.priceCents).toBe(100);
    expect(MODIFIERS.no_onions.priceCents).toBe(0);
    expect(MENU.burger.aliases).toEqual(["burger", "cheeseburger"]);
    expect(MENU.fries.aliases).toEqual(["fries", "french fries"]);
    expect(MENU.lemonade.aliases).toEqual(["lemonade", "lemon drink"]);
    expect(MENU.burger.allowedModifiers).toEqual(["no_onions", "double", "extra_cheese"]);
    expect(MENU.fries.allowedModifiers).toEqual([]);
    expect(MENU.lemonade.allowedModifiers).toEqual([]);
    expect(DEMO_DISCLOSURE).toBe("TartanOrder Demo Counter · Seeded menu · No real purchase.");
  });

  it("freezes menu records and nested values to preserve the source of truth", () => {
    expect(Object.isFrozen(MENU)).toBe(true);
    expect(Object.isFrozen(MENU.burger)).toBe(true);
    expect(Object.isFrozen(MENU.burger.allowedModifiers)).toBe(true);
    expect(Object.isFrozen(MENU.fries.aliases)).toBe(true);
    expect(Object.isFrozen(MODIFIERS.double)).toBe(true);
  });
});
