import { z } from "zod";

// V3: the catalog is runtime data (see docs/adr-supabase-persistence.md). Item, location and
// menu-version identifiers are bounded strings validated against the loaded catalog.
export const API_VERSION = 3 as const;

/** Kiosk disclosures: shown on every screen; the app never sells anything. */
export const DEMO_DISCLOSURE = "TartanOrder Demo Counter · Seeded menu · No real purchase.";
export const CAMPUS_DISCLOSURE = "TartanOrder · CMU published menus · No real purchase.";

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
  "UNSUPPORTED", "STALE_OFFER",
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
export const ItemIdSchema = z.string().min(1).max(LIMITS.idChars).regex(/^[a-z0-9][a-z0-9_-]*$/, "Item IDs use lowercase letters, digits, underscores and hyphens.");
export const LocationIdSchema = z.string().min(1).max(20).regex(/^[a-z0-9]+$/, "Location IDs use lowercase letters and digits.");
export type LocationId = z.infer<typeof LocationIdSchema>;
/** The kiosk's default counter when the catalog lists it as active; otherwise the first ranked location. */
export const KIOSK_DEFAULT_LOCATION_ID = "188";
export const AllowedLocationIdsSchema = z.array(LocationIdSchema).min(1).max(100).refine(ids => new Set(ids).size === ids.length, "Location IDs must be unique.");
export const ModifierIdSchema = z.enum([
  "no_onions", "double", "extra_cheese", "no_lettuce", "no_mayo", "dressing_on_side", "no_ice",
]);
export type ItemId = z.infer<typeof ItemIdSchema>;
export type ModifierId = z.infer<typeof ModifierIdSchema>;

export const IdSchema = z.string().min(1).max(LIMITS.idChars);
/** A released catalog version id, e.g. cmu-shortlist-2026-09-12. Compared, never assumed. */
export const MenuVersionSchema = z.string().min(1).max(LIMITS.idChars).regex(/^[a-z0-9][a-z0-9_.-]*$/, "Menu versions use lowercase letters, digits, dots, underscores and hyphens.");
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

// ---------------------------------------------------------------------------
// Catalog (V3): one immutable released menu version, loaded at runtime and
// threaded into the engine, parsers and UI as data. Never a module constant.
// ---------------------------------------------------------------------------
const CatalogTextSchema = z.string().min(1).max(200);
const CatalogUrlSchema = z.string().min(1).max(1000).nullable();
const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/).nullable();
export const CatalogCategorySchema = z.enum(["mains", "sides", "drinks"]);
export type CatalogCategory = z.infer<typeof CatalogCategorySchema>;
export const CatalogLocationSchema = z.strictObject({
  id: LocationIdSchema,
  name: CatalogTextSchema,
  location: z.string().max(300),
  menuUrl: CatalogUrlSchema,
  directoryMenuUrl: CatalogUrlSchema,
  detailUrl: CatalogUrlSchema,
  sourceSha256: Sha256Schema,
  sourceNote: z.string().max(500).nullable(),
  /** 1-based public shortlist order; null means archived (not selectable). */
  activeRank: z.number().int().positive().nullable(),
});
export type CatalogLocation = z.infer<typeof CatalogLocationSchema>;
export const CatalogItemSchema = z.strictObject({
  id: ItemIdSchema,
  locationId: LocationIdSchema,
  label: CatalogTextSchema,
  category: CatalogCategorySchema,
  description: z.string().max(1000),
  priceCents: CentsSchema,
  aliases: z.array(CatalogTextSchema).max(50),
  allowedModifiers: ModifiersSchema,
  sourcePage: z.number().int().positive().nullable(),
});
export type CatalogItem = z.infer<typeof CatalogItemSchema>;
export const CatalogPreviewSchema = z.strictObject({
  locationId: LocationIdSchema,
  label: CatalogTextSchema,
  description: z.string().max(1000),
  priceCents: CentsSchema.nullable(),
  sourceUrl: CatalogUrlSchema,
  sourcePage: z.number().int().positive().nullable(),
  sourceSha256: Sha256Schema,
});
export type CatalogPreview = z.infer<typeof CatalogPreviewSchema>;
export const CatalogModifierSchema = z.strictObject({ id: ModifierIdSchema, label: CatalogTextSchema, priceCents: CentsSchema });
export type CatalogModifier = z.infer<typeof CatalogModifierSchema>;
export const CatalogSnapshotSchema = z.strictObject({
  checkedAt: z.iso.date(),
  directoryUrl: z.string().min(1).max(1000),
  sourceRepository: z.string().min(1).max(1000),
});
export const CatalogSchema = z.strictObject({
  versionId: MenuVersionSchema,
  snapshot: CatalogSnapshotSchema,
  locations: z.array(CatalogLocationSchema).min(1).max(1000),
  items: z.array(CatalogItemSchema).max(10000),
  previews: z.array(CatalogPreviewSchema).max(10000),
  modifiers: z.array(CatalogModifierSchema).max(ModifierIdSchema.options.length),
}).superRefine((catalog, ctx) => {
  const locationIds = new Set(catalog.locations.map((location) => location.id));
  if (locationIds.size !== catalog.locations.length) ctx.addIssue({ code: "custom", path: ["locations"], message: "Location IDs must be unique." });
  const itemIds = new Set(catalog.items.map((item) => item.id));
  if (itemIds.size !== catalog.items.length) ctx.addIssue({ code: "custom", path: ["items"], message: "Item IDs must be unique." });
  const modifierIds = new Set(catalog.modifiers.map((modifier) => modifier.id));
  if (modifierIds.size !== catalog.modifiers.length) ctx.addIssue({ code: "custom", path: ["modifiers"], message: "Modifier IDs must be unique." });
  catalog.items.forEach((item, index) => {
    if (!locationIds.has(item.locationId)) ctx.addIssue({ code: "custom", path: ["items", index, "locationId"], message: "Item location is not in the catalog." });
    if (item.allowedModifiers.some((modifier) => !modifierIds.has(modifier))) ctx.addIssue({ code: "custom", path: ["items", index, "allowedModifiers"], message: "Item allows a modifier the catalog does not define." });
  });
  catalog.previews.forEach((preview, index) => {
    if (!locationIds.has(preview.locationId)) ctx.addIssue({ code: "custom", path: ["previews", index, "locationId"], message: "Preview location is not in the catalog." });
  });
  const ranks = catalog.locations.flatMap((location) => location.activeRank === null ? [] : [location.activeRank]).sort((a, b) => a - b);
  if (ranks.some((rank, index) => rank !== index + 1)) ctx.addIssue({ code: "custom", path: ["locations"], message: "Active ranks must be unique and contiguous from 1." });
});
export type Catalog = z.infer<typeof CatalogSchema>;
export const CatalogSourceSchema = z.enum(["supabase", "bundled", "unavailable"]);
export type CatalogSource = z.infer<typeof CatalogSourceSchema>;

const WaitMinutesSchema = z.number().finite().nonnegative();
export const WaitTimeSnapshotSchema = z.strictObject({
  id: IdSchema,
  source: z.enum(["seeded", "api"]),
  asOf: z.iso.datetime(),
  waits: z.partialRecord(LocationIdSchema, WaitMinutesSchema.nullable()),
});
export type WaitTimeSnapshot = z.infer<typeof WaitTimeSnapshotSchema>;
export const WaitEngineConfigSchema = z.strictObject({
  snapshot: WaitTimeSnapshotSchema,
  available: z.boolean(),
  unavailableReason: MessageSchema.nullable(),
  evaluatedAt: z.iso.datetime(),
  groups: z.array(z.strictObject({
    id: IdSchema,
    itemIds: z.array(ItemIdSchema).min(2).max(10),
    differences: z.partialRecord(ItemIdSchema, MessageSchema),
  })).max(100),
  nearbyPairs: z.array(z.strictObject({
    vendors: z.tuple([LocationIdSchema, LocationIdSchema]),
    sourceUrl: z.url().max(1000),
    note: MessageSchema,
  })).max(100),
  swapThresholdMinutes: WaitMinutesSchema,
  priceToleranceCents: CentsSchema,
});
export type WaitEngineConfig = z.infer<typeof WaitEngineConfigSchema>;
export const WaitViewSchema = z.strictObject({
  snapshotId: IdSchema,
  source: z.enum(["seeded", "api"]),
  asOf: z.iso.datetime(),
  status: z.enum(["empty", "known", "unavailable"]),
  estimateMinutes: WaitMinutesSchema.nullable(),
  lineWaits: z.record(IdSchema, WaitMinutesSchema.nullable()),
});
export type WaitView = z.infer<typeof WaitViewSchema>;
const SwapItemSchema = z.strictObject({
  itemId: ItemIdSchema, vendorId: LocationIdSchema,
  waitMinutes: WaitMinutesSchema, unitPriceCents: CentsSchema,
});
export const SwapOfferSchema = z.strictObject({
  offerId: IdSchema, originalLineId: IdSchema, revision: RevisionSchema,
  waitSnapshotId: IdSchema, quantity: QuantitySchema,
  original: SwapItemSchema, alternative: SwapItemSchema,
  retainedModifiers: ModifiersSchema, removedModifiers: ModifiersSchema,
  differences: z.array(MessageSchema).max(12),
  priceDifferenceCents: z.number().int(),
  currentCartEstimateMinutes: WaitMinutesSchema.nullable(),
  projectedCartEstimateMinutes: WaitMinutesSchema.nullable(),
  itemWaitReductionMinutes: WaitMinutesSchema,
  cartWaitReductionMinutes: WaitMinutesSchema.nullable(),
});
export type SwapOffer = z.infer<typeof SwapOfferSchema>;

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
  menuVersion: MenuVersionSchema,
  text: z.string().min(1).max(LIMITS.transcriptChars),
  source: z.enum(["voice", "text", "fixture"]),
  asrConfidence: z.number().min(0).max(1).nullable(),
  context: OrderContextSchema.optional(),
  locationId: LocationIdSchema.optional(),
});
export type ParseRequest = z.infer<typeof ParseRequestSchema>;

// Public HTTP accepts only the loaded catalog's active shortlist: see
// catalogGuard(catalog).publicParseRequestSchema in src/catalog/lookup.ts.

export const ParseResponseSchema = z.strictObject({
  v: z.literal(API_VERSION),
  requestId: RequestIdSchema,
  baseRevision: RevisionSchema,
  menuVersion: MenuVersionSchema,
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
  z.strictObject({ type: z.literal("ACCEPT_SWAP"), offerId: IdSchema, revision: RevisionSchema }),
  z.strictObject({ type: z.literal("DECLINE_SWAP"), offerId: IdSchema }),
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
  wait: WaitViewSchema.optional(),
  swapOffer: SwapOfferSchema.nullable().optional(),
});
export type OrderView = z.infer<typeof OrderViewSchema>;

export const ExportLogSchema = z.strictObject({
  v: z.literal(API_VERSION), menuVersion: MenuVersionSchema, sessionId: IdSchema, audit: z.array(AuditEntrySchema),
  waitConfig: WaitEngineConfigSchema.optional(),
  allowedLocationIds: AllowedLocationIdsSchema.optional(),
});
export type ExportLog = z.infer<typeof ExportLogSchema>;

// ---------------------------------------------------------------------------
// Order persistence (V3): sessions, append-only audit entries and receipts are
// written behind the engine, never awaited by ordering. Bodies are validated
// here before any database call.
// ---------------------------------------------------------------------------
export const SessionCreateRequestSchema = z.strictObject({
  v: z.literal(API_VERSION),
  sessionId: IdSchema,
  menuVersion: MenuVersionSchema,
  waitConfig: WaitEngineConfigSchema.optional(),
  allowedLocationIds: AllowedLocationIdsSchema.optional(),
});
export type SessionCreateRequest = z.infer<typeof SessionCreateRequestSchema>;
export const SessionEventsRequestSchema = z.strictObject({
  v: z.literal(API_VERSION),
  entries: z.array(AuditEntrySchema).min(1).max(200),
});
export type SessionEventsRequest = z.infer<typeof SessionEventsRequestSchema>;
export const SessionReceiptRequestSchema = z.strictObject({
  v: z.literal(API_VERSION),
  receipt: ReceiptSchema,
});
export type SessionReceiptRequest = z.infer<typeof SessionReceiptRequestSchema>;
export const PersistenceCodeSchema = z.enum([
  "INVALID_REQUEST", "MENU_VERSION_MISMATCH", "INPUT_TOO_LARGE",
  "SESSION_NOT_FOUND", "AUDIT_SEQUENCE_GAP", "SESSION_LIMIT", "PERSISTENCE_UNAVAILABLE",
]);
/** Hard cap on stored audit entries per session; a kiosk order is a few dozen. */
export const MAX_SESSION_AUDIT_ENTRIES = 1000;
export type PersistenceCode = z.infer<typeof PersistenceCodeSchema>;
export const PersistenceErrorSchema = z.strictObject({
  v: z.literal(API_VERSION),
  sessionId: IdSchema.nullable(),
  error: z.strictObject({ code: PersistenceCodeSchema, message: MessageSchema, retryable: z.boolean() }),
});
export type PersistenceError = z.infer<typeof PersistenceErrorSchema>;
/** Every successful persistence write acknowledges the highest audit seq the server now holds. */
export const PersistAckSchema = z.strictObject({
  v: z.literal(API_VERSION),
  sessionId: IdSchema,
  savedSeq: z.number().int().nonnegative(),
});
export type PersistAck = z.infer<typeof PersistAckSchema>;
export const PersistenceStateSchema = z.enum(["off", "saved", "saving", "failed"]);
export type PersistenceState = z.infer<typeof PersistenceStateSchema>;
/** What the kiosk shows about server-side saving; ordering never waits on it. */
export type PersistenceStatus = {
  readonly state: PersistenceState;
  /** Highest audit seq the server has acknowledged for this session. */
  readonly savedSeq: number;
  readonly pendingCount: number;
  readonly message: string | null;
};

export const HealthResponseSchema = z.strictObject({
  v: z.literal(API_VERSION),
  menuVersion: MenuVersionSchema.nullable(),
  parser: z.enum(["rules", "gemini"]),
  catalog: z.strictObject({ source: CatalogSourceSchema, versionId: MenuVersionSchema.nullable() }),
  orderPersistence: z.enum(["supabase", "off"]),
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
  persistence: PersistenceStatus;
  /** Re-attempts a failed server save; a no-op when persistence is off or idle. */
  retryPersistence(): void;
};

/** The client-side rules fallback needs the same catalog the server is serving. */
export type InterpretOptions = { localOnly: boolean; signal?: AbortSignal; catalog: Catalog };
