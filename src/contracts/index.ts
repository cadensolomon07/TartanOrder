import { z } from "zod";
import { CAMPUS_ITEMS, DINING_LOCATIONS } from "./campus";

export const API_VERSION = 2 as const;
export const MENU_VERSION = "cmu-published-2026-09-12" as const;

export const LIMITS = {
  lines: 5,
  totalUnits: 10,
  quantity: 5,
  operations: 8,
  choices: 3,
  requestBytes: 32768,
  transcriptChars: 1500,
  idChars: 100,
  labelChars: 100,
  messageChars: 300,
  serverTimeoutMs: 15000,
  clientTimeoutMs: 17000,
} as const;

export const CORE_CODES = [
  "OFF_MENU", "INVALID_MODIFIER", "QUANTITY_LIMIT", "CART_LIMIT",
  "AMBIGUOUS_REFERENCE", "UNKNOWN_REFERENCE", "STALE_RESPONSE", "INVALID_SCHEMA",
  "REVIEW_REQUIRED", "EMPTY_CART", "NO_UNDO", "NO_PENDING", "SESSION_COMMITTED",
  "UNSUPPORTED",
] as const;

export const HTTP_CODES = [
  "INVALID_REQUEST", "MENU_VERSION_MISMATCH", "INPUT_TOO_LARGE",
  "INVALID_MODEL_OUTPUT", "PROVIDER_UNAVAILABLE", "PARSE_TIMEOUT", "RATE_LIMITED",
] as const;

export const CoreCodeSchema = z.enum(CORE_CODES);
export const HttpCodeSchema = z.enum(HTTP_CODES);
export type CoreCode = z.infer<typeof CoreCodeSchema>;
export type HttpCode = z.infer<typeof HttpCodeSchema>;

export const DEMO_ITEM_IDS = [
  "burger", "chicken_sandwich", "veggie_wrap", "grilled_cheese",
  "fries", "onion_rings", "side_salad", "lemonade", "iced_tea", "cola", "water",
] as const;
export const ItemIdSchema = z.enum([...DEMO_ITEM_IDS, ...CAMPUS_ITEMS.map(item => item.id)]);
export const LocationIdSchema = z.enum(["demo", ...DINING_LOCATIONS.map(location => location.id)]);
export type LocationId = z.infer<typeof LocationIdSchema>;
export const ModifierIdSchema = z.enum([
  "no_onions", "double", "extra_cheese", "no_lettuce", "no_mayo", "dressing_on_side", "no_ice",
]);
export type ItemId = z.infer<typeof ItemIdSchema>;
export type ModifierId = z.infer<typeof ModifierIdSchema>;

export const IdSchema = z.string().min(1).max(LIMITS.idChars);
// Generated ADD line IDs must independently fit IdSchema's 100-character bound.
export const RequestIdSchema = IdSchema;
export const RevisionSchema = z.number().int().nonnegative();
export const QuantitySchema = z.number().int().min(1).max(LIMITS.quantity);
export const MessageSchema = z.string().min(1).max(LIMITS.messageChars);
export const LabelSchema = z.string().min(1).max(LIMITS.labelChars);
const CodeSchema = z.enum([...CORE_CODES, ...HTTP_CODES]);
const CentsSchema = z.number().int().nonnegative();

export const ModifiersSchema = z.array(ModifierIdSchema).max(ModifierIdSchema.options.length).superRefine((modifiers, ctx) => {
  if (new Set(modifiers).size !== modifiers.length) {
    ctx.addIssue({ code: "custom", message: "A modifier may occur only once per unit." });
  }
});

const LastRefSchema = z.strictObject({ by: z.literal("last") });
const ItemRefSchema = z.strictObject({ by: z.literal("item"), itemId: ItemIdSchema });
const LineRefSchema = z.strictObject({ by: z.literal("line"), lineId: IdSchema });

export const RefSchema = z.discriminatedUnion("by", [LastRefSchema, ItemRefSchema, LineRefSchema]);
// V2 sends bounded cart context. The server validates model line references
// against that context before the engine resolves and validates the whole batch.
export const ModelRefSchema = z.discriminatedUnion("by", [LastRefSchema, ItemRefSchema, LineRefSchema]);
export type Ref = z.infer<typeof RefSchema>;

const AddOpSchema = z.strictObject({
  type: z.literal("ADD"), itemId: ItemIdSchema, qty: QuantitySchema, modifiers: ModifiersSchema,
});
const UndoOpSchema = z.strictObject({ type: z.literal("UNDO") });

export const OpSchema = z.discriminatedUnion("type", [
  AddOpSchema,
  z.strictObject({ type: z.literal("REMOVE"), ref: RefSchema }),
  z.strictObject({ type: z.literal("SET_QTY"), ref: RefSchema, qty: QuantitySchema }),
  z.strictObject({ type: z.literal("MOD"), ref: RefSchema, modifier: ModifierIdSchema, enabled: z.boolean() }),
  UndoOpSchema,
]);
export type Op = z.infer<typeof OpSchema>;

export const ModelOpSchema = z.discriminatedUnion("type", [
  AddOpSchema,
  z.strictObject({ type: z.literal("REMOVE"), ref: ModelRefSchema }),
  z.strictObject({ type: z.literal("SET_QTY"), ref: ModelRefSchema, qty: QuantitySchema }),
  z.strictObject({ type: z.literal("MOD"), ref: ModelRefSchema, modifier: ModifierIdSchema, enabled: z.boolean() }),
  UndoOpSchema,
]);

function validateUndo(ops: { type: string }[], ctx: z.RefinementCtx) {
  if (ops.length > 1 && ops.some((op) => op.type === "UNDO")) {
    ctx.addIssue({ code: "custom", message: "UNDO must be the only operation in its batch." });
  }
}

export const OpsSchema = z.array(OpSchema).min(1).max(LIMITS.operations).superRefine(validateUndo);
export const ModelOpsSchema = z.array(ModelOpSchema).min(1).max(LIMITS.operations).superRefine(validateUndo);

export const ChoiceSchema = z.strictObject({ id: IdSchema, label: LabelSchema, ops: OpsSchema });
export type Choice = z.infer<typeof ChoiceSchema>;
// An open question may have no prescribed edits. Any offered choice must still
// contain a nonempty valid batch; a later natural answer supplies the intent.
export const ChoicesSchema = z.array(ChoiceSchema).max(LIMITS.choices).superRefine((choices, ctx) => {
  if (new Set(choices.map((choice) => choice.id)).size !== choices.length) {
    ctx.addIssue({ code: "custom", message: "Choice IDs must be unique." });
  }
});
const ModelChoiceSchema = z.strictObject({ id: IdSchema, label: LabelSchema, ops: ModelOpsSchema });
const ModelChoicesSchema = z.array(ModelChoiceSchema).max(LIMITS.choices).superRefine((choices, ctx) => {
  if (new Set(choices.map((choice) => choice.id)).size !== choices.length) {
    ctx.addIssue({ code: "custom", message: "Choice IDs must be unique." });
  }
});

export const PendingSchema = z.strictObject({ id: IdSchema, question: MessageSchema, choices: ChoicesSchema });
export type Pending = z.infer<typeof PendingSchema>;

export const UnavailableNoticeSchema = z.strictObject({
  kind: z.literal("unavailable"), item: z.string().min(1).max(60),
});
export type UnavailableNotice = z.infer<typeof UnavailableNoticeSchema>;
export const UnavailableOptionNoticeSchema = z.strictObject({
  kind: z.literal("unavailable_option"), itemId: ItemIdSchema, option: z.string().trim().min(1).max(60),
});
export type UnavailableOptionNotice = z.infer<typeof UnavailableOptionNoticeSchema>;
export const OrderNoticeSchema = z.discriminatedUnion("kind", [UnavailableNoticeSchema, UnavailableOptionNoticeSchema]);
export type OrderNotice = z.infer<typeof OrderNoticeSchema>;
const NoticesSchema = z.array(OrderNoticeSchema).max(5).optional();
const ResolveResultSchema = z.strictObject({ kind: z.literal("resolve"), pendingId: IdSchema, choiceId: IdSchema });

export const ParseResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("proposal"), ops: OpsSchema, notices: NoticesSchema }),
  z.strictObject({ kind: z.literal("clarify"), question: MessageSchema, choices: ChoicesSchema }),
  z.strictObject({ kind: z.literal("reject"), code: CoreCodeSchema, message: MessageSchema, notices: NoticesSchema }),
  ResolveResultSchema,
]);
export type ParseResult = z.infer<typeof ParseResultSchema>;

// Models may reference current context lines and resolve an existing pending
// choice. Context membership is a server/engine semantic check, not a JSON shape.
export const ModelParseResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("proposal"), ops: ModelOpsSchema, notices: NoticesSchema }),
  z.strictObject({ kind: z.literal("clarify"), question: MessageSchema, choices: ModelChoicesSchema }),
  z.strictObject({ kind: z.literal("reject"), code: CoreCodeSchema, message: MessageSchema, notices: NoticesSchema }),
  ResolveResultSchema,
]);
export type ModelParseResult = z.infer<typeof ModelParseResultSchema>;

export const LineSchema = z.strictObject({
  lineId: IdSchema, itemId: ItemIdSchema, qty: QuantitySchema, modifiers: ModifiersSchema,
});
export type Line = z.infer<typeof LineSchema>;
export const LinesSchema = z.array(LineSchema).max(LIMITS.lines).superRefine((lines, ctx) => {
  if (lines.reduce((sum, line) => sum + line.qty, 0) > LIMITS.totalUnits) {
    ctx.addIssue({ code: "custom", message: "The cart may contain at most 10 units." });
  }
  if (new Set(lines.map((line) => line.lineId)).size !== lines.length) {
    ctx.addIssue({ code: "custom", message: "Cart line IDs must be unique." });
  }
});

export const ConversationTurnSchema = z.strictObject({
  role: z.enum(["user", "assistant"]), text: z.string().min(1).max(1000),
});
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
export const OrderContextSchema = z.strictObject({
  lines: LinesSchema,
  lastLineId: IdSchema.nullable(),
  pending: PendingSchema.nullable(),
  recent: z.array(ConversationTurnSchema).max(8),
});
export type OrderContext = z.infer<typeof OrderContextSchema>;

export const ParseRequestSchema = z.strictObject({
  v: z.literal(API_VERSION),
  requestId: RequestIdSchema,
  baseRevision: RevisionSchema,
  menuVersion: z.literal(MENU_VERSION),
  text: z.string().min(1).max(LIMITS.transcriptChars),
  source: z.enum(["voice", "text", "fixture"]),
  asrConfidence: z.number().min(0).max(1).nullable(),
  context: OrderContextSchema.optional(),
  locationId: LocationIdSchema.optional(),
});
export type ParseRequest = z.infer<typeof ParseRequestSchema>;

export const ParseResponseSchema = z.strictObject({
  v: z.literal(API_VERSION),
  requestId: RequestIdSchema,
  baseRevision: RevisionSchema,
  menuVersion: z.literal(MENU_VERSION),
  parser: z.enum(["gemini", "rules", "fixture"]),
  fallbackReason: HttpCodeSchema.nullable(),
  result: ParseResultSchema,
});
export type ParseResponse = z.infer<typeof ParseResponseSchema>;

export const ApiErrorSchema = z.strictObject({
  v: z.literal(API_VERSION),
  requestId: RequestIdSchema.nullable(),
  error: z.strictObject({ code: HttpCodeSchema, message: MessageSchema, retryable: z.boolean() }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ReviewSchema = z.strictObject({
  id: IdSchema, revision: RevisionSchema, lines: LinesSchema.min(1), totalCents: CentsSchema,
});
export type Review = z.infer<typeof ReviewSchema>;

export const ReceiptSchema = z.strictObject({
  id: IdSchema, reviewId: IdSchema, lines: LinesSchema.min(1), totalCents: CentsSchema, simulated: z.literal(true),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

export const UiActionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("MANUAL"), ops: OpsSchema }),
  z.strictObject({ type: z.literal("CHOOSE"), pendingId: IdSchema, choiceId: IdSchema }),
  z.strictObject({ type: z.literal("UNDO") }),
  z.strictObject({ type: z.literal("CLEAR") }),
  z.strictObject({ type: z.literal("REVIEW") }),
  z.strictObject({ type: z.literal("CONFIRM"), reviewId: IdSchema, revision: RevisionSchema }),
]);
export type UiAction = z.infer<typeof UiActionSchema>;

export const AuditEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("INPUT_STARTED"), discardContinuation: z.literal(true).optional() }),
  z.strictObject({ type: z.literal("PARSE_RECEIVED"), response: ParseResponseSchema }),
  z.strictObject({ type: z.literal("UI"), action: UiActionSchema }),
]);
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export const AuditEntrySchema = z.strictObject({
  seq: z.number().int().positive(),
  event: AuditEventSchema,
  outcome: z.enum(["applied", "clarify", "rejected", "ignored"]),
  code: CodeSchema.nullable(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const OrderViewSchema = z.strictObject({
  sessionId: IdSchema,
  revision: RevisionSchema,
  phase: z.enum(["editing", "clarifying", "reviewing", "committed"]),
  lines: LinesSchema,
  lastLineId: IdSchema.nullable(),
  pending: PendingSchema.nullable(),
  review: ReviewSchema.nullable(),
  receipt: ReceiptSchema.nullable(),
  totalCents: CentsSchema,
  audit: z.array(AuditEntrySchema),
});
export type OrderView = z.infer<typeof OrderViewSchema>;

export const ExportLogSchema = z.strictObject({
  v: z.literal(API_VERSION), menuVersion: z.literal(MENU_VERSION), sessionId: IdSchema, audit: z.array(AuditEntrySchema),
});
export type ExportLog = z.infer<typeof ExportLogSchema>;

export const HealthResponseSchema = z.strictObject({
  v: z.literal(API_VERSION), menuVersion: z.literal(MENU_VERSION), parser: z.enum(["rules", "gemini"]),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export type OrderController = {
  state: OrderView;
  busy: boolean;
  localOnly: boolean;
  locationId: LocationId;
  parser: "none" | "gemini" | "rules" | "fixture";
  notice: string | null;
  assistant: { id: string; text: string } | null;
  startInput(): void;
  endInput(): void;
  submit(text: string, source: ParseRequest["source"], asrConfidence: number | null): Promise<void>;
  act(action: UiAction): void;
  setLocalOnly(value: boolean): void;
  setLocation(value: LocationId): void;
  reset(): void;
  exportLog(): string;
};

export type InterpretOptions = { localOnly: boolean; signal?: AbortSignal };
