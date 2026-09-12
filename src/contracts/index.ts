import { z } from "zod";

export const API_VERSION = 1 as const;
export const MENU_VERSION = "demo-v1" as const;

export const LIMITS = {
  lines: 5,
  totalUnits: 10,
  quantity: 5,
  operations: 8,
  choices: 3,
  requestBytes: 4096,
  transcriptChars: 500,
  idChars: 100,
  labelChars: 100,
  messageChars: 160,
  serverTimeoutMs: 5000,
  clientTimeoutMs: 6000,
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

export const ItemIdSchema = z.enum(["burger", "fries", "lemonade"]);
export const ModifierIdSchema = z.enum(["no_onions", "double", "extra_cheese"]);
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

export const ModifiersSchema = z.array(ModifierIdSchema).max(3).superRefine((modifiers, ctx) => {
  if (new Set(modifiers).size !== modifiers.length) {
    ctx.addIssue({ code: "custom", message: "A modifier may occur only once per unit." });
  }
});

const LastRefSchema = z.strictObject({ by: z.literal("last") });
const ItemRefSchema = z.strictObject({ by: z.literal("item"), itemId: ItemIdSchema });
const LineRefSchema = z.strictObject({ by: z.literal("line"), lineId: IdSchema });

export const RefSchema = z.discriminatedUnion("by", [LastRefSchema, ItemRefSchema, LineRefSchema]);
export const ModelRefSchema = z.discriminatedUnion("by", [LastRefSchema, ItemRefSchema]);
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
export const ChoicesSchema = z.array(ChoiceSchema).min(1).max(LIMITS.choices).superRefine((choices, ctx) => {
  if (new Set(choices.map((choice) => choice.id)).size !== choices.length) {
    ctx.addIssue({ code: "custom", message: "Choice IDs must be unique." });
  }
});
const ModelChoiceSchema = z.strictObject({ id: IdSchema, label: LabelSchema, ops: ModelOpsSchema });
const ModelChoicesSchema = z.array(ModelChoiceSchema).min(1).max(LIMITS.choices).superRefine((choices, ctx) => {
  if (new Set(choices.map((choice) => choice.id)).size !== choices.length) {
    ctx.addIssue({ code: "custom", message: "Choice IDs must be unique." });
  }
});

export const ParseResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("proposal"), ops: OpsSchema }),
  z.strictObject({ kind: z.literal("clarify"), question: MessageSchema, choices: ChoicesSchema }),
  z.strictObject({ kind: z.literal("reject"), code: CoreCodeSchema, message: MessageSchema }),
]);
export type ParseResult = z.infer<typeof ParseResultSchema>;

// This is the model-facing schema. Models cannot name internal cart line IDs.
export const ModelParseResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("proposal"), ops: ModelOpsSchema }),
  z.strictObject({ kind: z.literal("clarify"), question: MessageSchema, choices: ModelChoicesSchema }),
  z.strictObject({ kind: z.literal("reject"), code: CoreCodeSchema, message: MessageSchema }),
]);

export const ParseRequestSchema = z.strictObject({
  v: z.literal(API_VERSION),
  requestId: RequestIdSchema,
  baseRevision: RevisionSchema,
  menuVersion: z.literal(MENU_VERSION),
  text: z.string().min(1).max(LIMITS.transcriptChars),
  source: z.enum(["voice", "text", "fixture"]),
  asrConfidence: z.number().min(0).max(1).nullable(),
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
  z.strictObject({ type: z.literal("INPUT_STARTED") }),
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
  pending: z.strictObject({ id: IdSchema, question: MessageSchema, choices: ChoicesSchema }).nullable(),
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
  parser: "none" | "gemini" | "rules" | "fixture";
  notice: string | null;
  startInput(): void;
  endInput(): void;
  submit(text: string, source: ParseRequest["source"], asrConfidence: number | null): Promise<void>;
  act(action: UiAction): void;
  setLocalOnly(value: boolean): void;
  reset(): void;
  exportLog(): string;
};

export type InterpretOptions = { localOnly: boolean; signal?: AbortSignal };
