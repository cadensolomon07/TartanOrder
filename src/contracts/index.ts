import { z } from "zod";
import { ACTIVE_LOCATION_IDS, CAMPUS_ITEMS, DINING_LOCATIONS } from "./campus";

export const API_VERSION = 2 as const;
export const MENU_VERSION = "cmu-meal-2026-09-12" as const;

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
  noteChars: 160,
  serverTimeoutMs: 15000,
  clientTimeoutMs: 17000,
} as const;

export const CORE_CODES = [
  "OFF_MENU", "INVALID_MODIFIER", "QUANTITY_LIMIT", "CART_LIMIT",
  "AMBIGUOUS_REFERENCE", "UNKNOWN_REFERENCE", "STALE_RESPONSE", "INVALID_SCHEMA",
  "REVIEW_REQUIRED", "EMPTY_CART", "NO_UNDO", "NO_PENDING", "SESSION_COMMITTED",
  "UNSUPPORTED", "STALE_OFFER", "REQUIREMENT_CONFLICT", "STAFF_REVIEW_REQUIRED", "STALE_DECISION",
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
export const ActiveLocationIdSchema = z.enum(ACTIVE_LOCATION_IDS);
// The fictional counter is explicitly available for the meal/ingredient demonstration.
export const PUBLIC_LOCATION_IDS = [...ACTIVE_LOCATION_IDS, "demo"] as const;
export const PublicLocationIdSchema = z.enum(PUBLIC_LOCATION_IDS);
export const AllowedLocationIdsSchema = z.array(LocationIdSchema).min(1).max(46).refine(ids => new Set(ids).size === ids.length, "Location IDs must be unique.");
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
/** Unverified staff request; an empty SET_NOTE clears the line's note. */
export const NoteSchema = z.string().trim().max(LIMITS.noteChars);
export type Note = z.infer<typeof NoteSchema>;
const CodeSchema = z.enum([...CORE_CODES, ...HTTP_CODES]);
const CentsSchema = z.number().int().nonnegative();

export const ModifiersSchema = z.array(ModifierIdSchema).max(ModifierIdSchema.options.length).superRefine((modifiers, ctx) => {
  if (new Set(modifiers).size !== modifiers.length) {
    ctx.addIssue({ code: "custom", message: "A modifier may occur only once per unit." });
  }
});

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
  note: NoteSchema.min(1).optional(),
});
const UndoOpSchema = z.strictObject({ type: z.literal("UNDO") });

export const OpSchema = z.discriminatedUnion("type", [
  AddOpSchema,
  z.strictObject({ type: z.literal("REMOVE"), ref: RefSchema }),
  z.strictObject({ type: z.literal("SET_QTY"), ref: RefSchema, qty: QuantitySchema }),
  z.strictObject({ type: z.literal("SET_NOTE"), ref: RefSchema, note: NoteSchema }),
  z.strictObject({ type: z.literal("MOD"), ref: RefSchema, modifier: ModifierIdSchema, enabled: z.boolean() }),
  UndoOpSchema,
]);
export type Op = z.infer<typeof OpSchema>;

export const ModelOpSchema = z.discriminatedUnion("type", [
  AddOpSchema,
  z.strictObject({ type: z.literal("REMOVE"), ref: ModelRefSchema }),
  z.strictObject({ type: z.literal("SET_QTY"), ref: ModelRefSchema, qty: QuantitySchema }),
  z.strictObject({ type: z.literal("SET_NOTE"), ref: ModelRefSchema, note: NoteSchema }),
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

export const LineSchema = z.strictObject({
  lineId: IdSchema, itemId: ItemIdSchema, qty: QuantitySchema, modifiers: ModifiersSchema,
  note: NoteSchema.min(1).optional(),
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

// Persistent meal and dietary requirements. Ingredient evidence is owned by the menu,
// never supplied by the parser. Additional allergen names remain explicit strings.
export const MealComponentSchema = z.enum(["mains", "sides", "drinks"]);
export type MealComponent = z.infer<typeof MealComponentSchema>;
export const IngredientNameSchema = z.string().trim().min(1).max(60);
const IngredientsSchema = z.array(IngredientNameSchema).max(20);
export const DietaryProfileSchema = z.strictObject({
  preference: z.enum(["none", "vegetarian", "vegan"]),
  allergies: IngredientsSchema,
  dislikes: IngredientsSchema,
  exceptions: z.array(z.strictObject({ itemId: ItemIdSchema, modifiers: ModifiersSchema, preference: z.enum(["none", "vegetarian", "vegan"]), dislikes: IngredientsSchema })).max(20),
});
export type DietaryProfile = z.infer<typeof DietaryProfileSchema>;
export const MealSelectionSchema = z.strictObject({ component: MealComponentSchema, itemId: ItemIdSchema, modifiers: ModifiersSchema });
export const MealRequirementsSchema = z.strictObject({
  locationId: LocationIdSchema,
  budgetCents: CentsSchema.max(100000).nullable(),
  components: z.array(MealComponentSchema).min(1).max(3).refine(values => new Set(values).size === values.length, "Meal components must be unique."),
  selections: z.array(MealSelectionSchema).max(3),
  lockedItemIds: z.array(ItemIdSchema).max(3),
});
export type MealRequirements = z.infer<typeof MealRequirementsSchema>;
export const CompatibilityResultSchema = z.strictObject({
  status: z.enum(["match", "conflict", "unknown"]),
  reasons: z.array(MessageSchema).max(30),
  staffReview: z.boolean(),
  source: MessageSchema,
});
export type CompatibilityResult = z.infer<typeof CompatibilityResultSchema>;
export const CartCompatibilityCheckSchema = CompatibilityResultSchema.extend({ lineId: IdSchema });
export type CartCompatibilityCheck = z.infer<typeof CartCompatibilityCheckSchema>;
export const SolverSummarySchema = z.strictObject({
  checkedCombinations: z.number().int().nonnegative(),
  exhaustive: z.literal(true),
  minimumCents: CentsSchema.nullable(),
  explanation: MessageSchema,
});
export type SolverSummary = z.infer<typeof SolverSummarySchema>;
export const RequirementChoiceSchema = z.strictObject({ id: IdSchema, label: LabelSchema });
export const RequirementDecisionSchema = z.strictObject({
  id: IdSchema, revision: RevisionSchema,
  kind: z.enum(["budget", "locked_item", "preference", "leave_meal", "switch_counter", "conflict"]),
  message: MessageSchema,
  proposedMeal: MealRequirementsSchema.nullable(),
  proposedLines: LinesSchema,
  minimumCents: CentsSchema.nullable(),
  nextLocationId: LocationIdSchema.optional(),
  choices: z.array(RequirementChoiceSchema).min(1).max(2),
});
export type RequirementDecision = z.infer<typeof RequirementDecisionSchema>;
export const RequirementsStateSchema = z.strictObject({
  locationId: LocationIdSchema,
  meal: MealRequirementsSchema.nullable(),
  profile: DietaryProfileSchema,
  decision: RequirementDecisionSchema.nullable(),
  checks: z.array(CartCompatibilityCheckSchema).max(LIMITS.lines),
  message: MessageSchema.nullable(),
  remainingCents: z.number().int().nullable(),
  solver: SolverSummarySchema.nullable(),
});
export type RequirementsState = z.infer<typeof RequirementsStateSchema>;
export const RequirementChangeSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("SET_MEAL_MODE"), enabled: z.boolean() }),
  z.strictObject({ type: z.literal("SET_BUDGET"), budgetCents: CentsSchema.max(100000).nullable() }),
  z.strictObject({ type: z.literal("SET_COMPONENTS"), components: MealRequirementsSchema.shape.components }),
  z.strictObject({ type: z.literal("SELECT_ITEM"), itemId: ItemIdSchema, modifiers: ModifiersSchema, locked: z.boolean() }),
  z.strictObject({ type: z.literal("CLEAR_SELECTION"), component: MealComponentSchema }),
  z.strictObject({ type: z.literal("UNLOCK_ITEM"), itemId: ItemIdSchema }),
  z.strictObject({ type: z.literal("SET_DIETARY"), preference: DietaryProfileSchema.shape.preference }),
  z.strictObject({ type: z.literal("ADD_ALLERGY"), allergen: IngredientNameSchema }),
  z.strictObject({ type: z.literal("REMOVE_ALLERGY"), allergen: IngredientNameSchema }),
  z.strictObject({ type: z.literal("RESOLVE_ALLERGEN"), from: IngredientNameSchema, to: IngredientsSchema.min(1) }),
  z.strictObject({ type: z.literal("SET_DISLIKE"), ingredient: IngredientNameSchema, enabled: z.boolean() }),
  z.strictObject({ type: z.literal("REMOVE_EXCEPTION"), itemId: ItemIdSchema }),
  z.strictObject({ type: z.literal("SWITCH_LOCATION"), locationId: LocationIdSchema }),
]);
export type RequirementChange = z.infer<typeof RequirementChangeSchema>;
export const RequirementChangesSchema = z.array(RequirementChangeSchema).min(1).max(12);
export const RequirementsResultSchema = z.strictObject({
  kind: z.literal("requirements"), locationId: LocationIdSchema,
  changes: RequirementChangesSchema, ops: OpsSchema.optional(),
});
export const DecideRequirementsResultSchema = z.strictObject({ kind: z.literal("decide_requirements"), pendingId: IdSchema, choiceId: IdSchema });

export const ParseResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("proposal"), ops: OpsSchema, notices: NoticesSchema }),
  z.strictObject({ kind: z.literal("clarify"), question: MessageSchema, choices: ChoicesSchema }),
  z.strictObject({ kind: z.literal("reject"), code: CoreCodeSchema, message: MessageSchema, notices: NoticesSchema }),
  ResolveResultSchema,
  RequirementsResultSchema,
  DecideRequirementsResultSchema,
]);
export type ParseResult = z.infer<typeof ParseResultSchema>;

// Models may reference current context lines and resolve an existing pending
// choice. Context membership is a server/engine semantic check, not a JSON shape.
export const ModelParseResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("proposal"), ops: ModelOpsSchema, notices: NoticesSchema }),
  z.strictObject({ kind: z.literal("clarify"), question: MessageSchema, choices: ModelChoicesSchema }),
  z.strictObject({ kind: z.literal("reject"), code: CoreCodeSchema, message: MessageSchema, notices: NoticesSchema }),
  ResolveResultSchema,
  RequirementsResultSchema,
  DecideRequirementsResultSchema,
]);
export type ModelParseResult = z.infer<typeof ModelParseResultSchema>;

export const ConversationTurnSchema = z.strictObject({
  role: z.enum(["user", "assistant"]), text: z.string().min(1).max(1000),
});
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
export const OrderContextSchema = z.strictObject({
  lines: LinesSchema,
  lastLineId: IdSchema.nullable(),
  pending: PendingSchema.nullable(),
  recent: z.array(ConversationTurnSchema).max(8),
  requirements: RequirementsStateSchema.optional(),
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

// Public HTTP accepts only the selected campus shortlist. Internal parser/core
// fixtures retain the wider archive schema; no request field can enable it.
const activeItemIds = new Set<string>([...DEMO_ITEM_IDS, ...CAMPUS_ITEMS.filter(item => ACTIVE_LOCATION_IDS.some(id => id === item.locationId)).map(item => item.id)]);
export const PublicParseRequestSchema = ParseRequestSchema.extend({
  locationId: PublicLocationIdSchema.default("188"),
}).superRefine((request, ctx) => {
  const ids = [
    ...(request.context?.lines.map(line => line.itemId) ?? []),
    ...(request.context?.requirements?.profile.exceptions.map(value => value.itemId) ?? []),
    ...(request.context?.requirements?.meal?.selections.map(value => value.itemId) ?? []),
    ...(request.context?.requirements?.meal?.lockedItemIds ?? []),
    ...(request.context?.requirements?.decision?.proposedLines.map(value => value.itemId) ?? []),
    ...(request.context?.requirements?.decision?.proposedMeal?.selections.map(value => value.itemId) ?? []),
    ...(request.context?.pending?.choices.flatMap(choice => choice.ops.flatMap(op => op.type === "ADD" ? [op.itemId] : "ref" in op && op.ref.by === "item" ? [op.ref.itemId] : [])) ?? []),
  ];
  const locations = [request.context?.requirements?.locationId, request.context?.requirements?.meal?.locationId, request.context?.requirements?.decision?.nextLocationId, request.context?.requirements?.decision?.proposedMeal?.locationId].filter(value => value !== undefined);
  if(locations.some(id => !PUBLIC_LOCATION_IDS.some(allowed => allowed === id)))ctx.addIssue({code:"custom", message:"Requirement context contains a restaurant outside the active catalog."});
  if(ids.some(id => !activeItemIds.has(id)))ctx.addIssue({ code: "custom", message: "Cart context contains an item outside the active campus catalog." });
});

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
  z.strictObject({ type: z.literal("ACCEPT_SWAP"), offerId: IdSchema, revision: RevisionSchema }),
  z.strictObject({ type: z.literal("DECLINE_SWAP"), offerId: IdSchema }),
  z.strictObject({ type: z.literal("REQUIREMENTS"), locationId: LocationIdSchema, changes: RequirementChangesSchema }),
  z.strictObject({ type: z.literal("RESUME_REQUIREMENTS_DECISION") }),
  z.strictObject({ type: z.literal("DECIDE_REQUIREMENTS"), pendingId: IdSchema, revision: RevisionSchema, choiceId: IdSchema }),
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
  requirements: RequirementsStateSchema.optional(),
});
export type OrderView = z.infer<typeof OrderViewSchema>;

export const ExportLogSchema = z.strictObject({
  v: z.literal(API_VERSION), menuVersion: z.literal(MENU_VERSION), sessionId: IdSchema, audit: z.array(AuditEntrySchema),
  waitConfig: WaitEngineConfigSchema.optional(),
  allowedLocationIds: AllowedLocationIdsSchema.optional(),
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
