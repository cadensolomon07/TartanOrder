import {
  API_VERSION,
  LIMITS,
  AuditEventSchema,
  ExportLogSchema,
  IdSchema,
  WaitEngineConfigSchema,
  AllowedLocationIdsSchema,
  type AuditEntry,
  type AuditEvent,
  type Catalog,
  type Choice,
  type CoreCode,
  type Line,
  type LocationId,
  type Op,
  type OrderView,
  type Ref,
  type UiAction,
  type WaitEngineConfig,
} from "@/contracts";
import { indexCatalog, type CatalogIndex } from "@/catalog/lookup";
import { deriveWaitView, swapCandidates, unitPriceCents } from "./waits";

type CartSnapshot = { lines: Line[]; lastLineId: string | null };
type PendingContext = { requestId: string };
type Outcome = AuditEntry["outcome"];

/**
 * Everything the engine needs beyond the session id. The catalog is the one
 * immutable released menu version this session prices against; it was validated
 * at the load boundary and is never re-parsed here.
 */
export type EngineOptions = {
  readonly catalog: Catalog;
  readonly waitConfig?: WaitEngineConfig;
  readonly allowedLocationIds?: readonly LocationId[];
};

/** Opaque application state. Use getView to expose a detached UI snapshot. */
export type EngineState = {
  readonly catalog: Catalog;
  readonly view: OrderView;
  readonly history: readonly CartSnapshot[];
  readonly seenRequestIds: readonly string[];
  readonly pendingContext: PendingContext | null;
  /** A spoken answer can resume the exact choice after input invalidates its visible buttons. */
  readonly continuation: { pending: NonNullable<OrderView["pending"]>; requestId: string } | null;
  readonly lastOutcome: Outcome;
  readonly lastCode: string | null;
  readonly waitConfig?: WaitEngineConfig;
  readonly allowedLocationIds?: readonly LocationId[];
  readonly suppressedLineIds: readonly string[];
};

type Failure = { kind: "error"; code: CoreCode };
type Success = { kind: "success"; cart: CartSnapshot };
type Ambiguity = { kind: "ambiguous"; index: number; matches: Line[] };
type BatchResult = Success | Failure | { kind: "clarify"; question: string; choices: Choice[] };

const clone = <T>(value: T): T => structuredClone(value);

export function totalCents(lines: readonly Line[], catalog: Catalog): number {
  const menu = indexCatalog(catalog);
  return lines.reduce((total, line) => {
    const item = menu.item(line.itemId);
    if (!item) throw new Error(`INVALID_SCHEMA: item ${line.itemId} is not in catalog ${catalog.versionId}.`);
    return total + line.qty * unitPriceCents(menu, item, line.modifiers);
  }, 0);
}

// Session IDs are supplied by the controller; every derived ID is deterministic.
// The compact hash keeps review/receipt IDs within the shared 100-character cap.
function sessionKey(sessionId: string): string {
  let hash = 2166136261;
  for (let index = 0; index < sessionId.length; index += 1) {
    hash = Math.imul(hash ^ sessionId.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36);
}

function derivedId(state: EngineState, kind: string, number: number): string {
  return `${sessionKey(state.view.sessionId)}:${kind}:${number}`;
}

export function createEngine(sessionId: string, options: EngineOptions): EngineState {
  IdSchema.parse(sessionId);
  const { catalog } = options;
  const menu = indexCatalog(catalog);
  const waitConfig = options.waitConfig === undefined ? undefined : WaitEngineConfigSchema.parse(clone(options.waitConfig));
  const locations = options.allowedLocationIds === undefined ? undefined : AllowedLocationIdsSchema.parse([...options.allowedLocationIds]);
  for (const locationId of locations ?? []) {
    if (!menu.location(locationId)) throw new Error(`INVALID_SCHEMA: allowed location ${locationId} is not in catalog ${catalog.versionId}.`);
  }
  return {
    catalog,
    view: {
      sessionId,
      revision: 0,
      phase: "editing",
      lines: [],
      lastLineId: null,
      pending: null,
      review: null,
      receipt: null,
      totalCents: 0,
      audit: [],
      ...(waitConfig ? { wait: deriveWaitView([], waitConfig, catalog), swapOffer: null } : {}),
    },
    history: [],
    seenRequestIds: [],
    pendingContext: null,
    continuation: null,
    lastOutcome: "applied",
    lastCode: null,
    ...(waitConfig ? { waitConfig } : {}),
    ...(locations === undefined ? {} : { allowedLocationIds: locations }),
    suppressedLineIds: [],
  };
}

export function getView(state: EngineState): OrderView {
  return clone(state.waitConfig ? { ...state.view, wait: deriveWaitView(state.view.lines, state.waitConfig, state.catalog) } : state.view);
}

function snapshot(state: EngineState): CartSnapshot {
  return { lines: clone(state.view.lines), lastLineId: state.view.lastLineId };
}

function dismissOffer(state: EngineState): EngineState {
  if (!state.waitConfig) return state;
  const lineId = state.view.swapOffer?.originalLineId;
  return {
    ...state,
    suppressedLineIds: lineId ? [...new Set([...state.suppressedLineIds, lineId])] : state.suppressedLineIds,
    view: { ...state.view, swapOffer: null },
  };
}

function invalidate(original: EngineState): EngineState {
  const state = dismissOffer(original);
  return {
    ...state,
    pendingContext: null,
    continuation: null,
    view: {
      ...state.view,
      revision: state.view.revision + 1,
      phase: "editing",
      pending: null,
      review: null,
    },
  };
}

function finish(state: EngineState, event: AuditEvent, outcome: Outcome, code: AuditEntry["code"] = null): EngineState {
  return {
    ...state,
    lastOutcome: outcome,
    lastCode: code,
    view: {
      ...state.view,
      ...(state.waitConfig ? { wait: deriveWaitView(state.view.lines, state.waitConfig, state.catalog) } : {}),
      audit: [...state.view.audit, {
        seq: state.view.audit.length + 1,
        event: clone(event),
        outcome,
        code,
      }],
    },
  };
}

function referenceMatches(cart: CartSnapshot, ref: Ref): Line[] {
  if (ref.by === "last") return cart.lines.filter((line) => line.lineId === cart.lastLineId);
  if (ref.by === "line") return cart.lines.filter((line) => line.lineId === ref.lineId);
  return cart.lines.filter((line) => line.itemId === ref.itemId);
}

/** Evaluates sequentially on a temporary cart, never on live state. */
function scanBatch(menu: CatalogIndex, original: CartSnapshot, ops: Op[], requestId: string, allowedLocationIds?: readonly LocationId[]): Success | Failure | Ambiguity {
  const cart = clone(original);
  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];
    if (op.type === "UNDO") return { kind: "error", code: "INVALID_SCHEMA" };
    if (op.type === "ADD") {
      // The schema only bounds the id's shape; membership is decided against the loaded catalog here.
      const item = menu.item(op.itemId);
      if (!item || (allowedLocationIds && !allowedLocationIds.includes(item.locationId))) {
        return { kind: "error", code: "OFF_MENU" };
      }
      if (!op.modifiers.every((modifier) => item.allowedModifiers.includes(modifier))) {
        return { kind: "error", code: "INVALID_MODIFIER" };
      }
      const lineId = `${requestId}:${index}`;
      if (!IdSchema.safeParse(lineId).success || cart.lines.some((line) => line.lineId === lineId)) {
        return { kind: "error", code: "INVALID_SCHEMA" };
      }
      cart.lines.push({ lineId, itemId: op.itemId, qty: op.qty, modifiers: [...op.modifiers] });
      cart.lastLineId = lineId;
    } else {
      const matches = referenceMatches(cart, op.ref);
      if (matches.length === 0) return { kind: "error", code: "UNKNOWN_REFERENCE" };
      if (matches.length > 1) return { kind: "ambiguous", index, matches };
      const target = matches[0];
      if (op.type === "REMOVE") {
        cart.lines = cart.lines.filter((line) => line.lineId !== target.lineId);
        if (cart.lastLineId === target.lineId) cart.lastLineId = null;
      } else if (op.type === "SET_QTY") {
        target.qty = op.qty;
        cart.lastLineId = target.lineId;
      } else {
        const item = menu.item(target.itemId);
        if (!item) return { kind: "error", code: "OFF_MENU" };
        if (!item.allowedModifiers.includes(op.modifier)) {
          return { kind: "error", code: "INVALID_MODIFIER" };
        }
        if (op.enabled && !target.modifiers.includes(op.modifier)) target.modifiers.push(op.modifier);
        if (!op.enabled) target.modifiers = target.modifiers.filter((modifier) => modifier !== op.modifier);
        cart.lastLineId = target.lineId;
      }
    }
    if (cart.lines.length > LIMITS.lines || cart.lines.reduce((units, line) => units + line.qty, 0) > LIMITS.totalUnits) {
      return { kind: "error", code: "CART_LIMIT" };
    }
  }
  return { kind: "success", cart };
}

function evaluateBatch(menu: CatalogIndex, original: CartSnapshot, ops: Op[], requestId: string, allowedLocationIds?: readonly LocationId[]): BatchResult {
  const result = scanBatch(menu, original, ops, requestId, allowedLocationIds);
  if (result.kind !== "ambiguous") return result;
  if (result.matches.length > LIMITS.choices) return { kind: "error", code: "AMBIGUOUS_REFERENCE" };

  const choices: Choice[] = [];
  for (let index = 0; index < result.matches.length; index += 1) {
    const target = result.matches[index];
    const explicit = clone(ops);
    const ambiguousOp = explicit[result.index];
    if (!("ref" in ambiguousOp)) return { kind: "error", code: "INVALID_SCHEMA" };
    ambiguousOp.ref = { by: "line", lineId: target.lineId };

    // Explore the entire batch for every candidate. A second ambiguous reference
    // or an invalid later operation cannot be hidden behind the first choice.
    const candidate = scanBatch(menu, original, explicit, requestId, allowedLocationIds);
    if (candidate.kind === "ambiguous") return { kind: "error", code: "AMBIGUOUS_REFERENCE" };
    if (candidate.kind === "error") return candidate;
    const modifiers = target.modifiers.map((modifier) => menu.modifier(modifier)?.label ?? modifier).join(", ");
    choices.push({
      id: `option-${index + 1}`,
      label: `${menu.item(target.itemId)?.label ?? target.itemId} ${index + 1}, quantity ${target.qty}${modifiers ? `, ${modifiers}` : ""}`,
      ops: explicit,
    });
  }
  const first = result.matches[0];
  return { kind: "clarify", question: `Which ${(menu.item(first.itemId)?.label ?? first.itemId).toLowerCase()} line did you mean?`, choices };
}

function installCart(state: EngineState, cart: CartSnapshot, history: readonly CartSnapshot[]): EngineState {
  return {
    ...state,
    history,
    pendingContext: null,
    view: {
      ...state.view,
      phase: "editing",
      lines: clone(cart.lines),
      lastLineId: cart.lastLineId,
      totalCents: totalCents(cart.lines, state.catalog),
      pending: null,
      review: null,
    },
  };
}

function enterPending(state: EngineState, requestId: string, question: string, choices: Choice[]): EngineState {
  return {
    ...state,
    pendingContext: { requestId },
    view: {
      ...state.view,
      phase: "clarifying",
      review: null,
      pending: {
        id: derivedId(state, "pending", state.view.audit.length + 1),
        question,
        choices: clone(choices),
      },
    },
  };
}

function applyBatch(state: EngineState, event: AuditEvent, ops: Op[], requestId: string): EngineState {
  if (ops.length === 1 && ops[0].type === "UNDO") {
    const previous = state.history.at(-1);
    if (!previous) return finish(state, event, "rejected", "NO_UNDO");
    return finish(installCart(state, previous, state.history.slice(0, -1)), event, "applied");
  }
  const before = snapshot(state);
  const result = evaluateBatch(indexCatalog(state.catalog), before, ops, requestId, state.allowedLocationIds);
  if (result.kind === "error") return finish(state, event, "rejected", result.code);
  if (result.kind === "clarify") {
    return finish(enterPending(state, requestId, result.question, result.choices), event, "clarify", "AMBIGUOUS_REFERENCE");
  }
  let installed = installCart(state, result.cart, [...state.history, before]);
  if (state.waitConfig) {
    const addedIds = result.cart.lines.filter(line => !before.lines.some(previous => previous.lineId === line.lineId) && !state.suppressedLineIds.includes(line.lineId)).map(line => line.lineId);
    const candidate = swapCandidates(result.cart.lines, state.waitConfig, addedIds, state.catalog, state.allowedLocationIds)[0];
    if (candidate) installed = {
      ...installed,
      view: { ...installed.view, swapOffer: { ...candidate, offerId: derivedId(installed, "swap", state.view.audit.length + 1), revision: installed.view.revision } },
    };
  }
  return finish(installed, event, "applied");
}

function reduceUi(state: EngineState, event: AuditEvent & { type: "UI" }, action: UiAction): EngineState {
  if (action.type === "CONFIRM") {
    if (state.view.phase === "committed") {
      const same = state.view.receipt?.reviewId === action.reviewId && state.view.review?.revision === action.revision;
      return finish(state, event, same ? "applied" : "rejected", same ? null : "REVIEW_REQUIRED");
    }
    const review = state.view.review;
    if (state.view.phase !== "reviewing" || !review || review.id !== action.reviewId ||
        review.revision !== action.revision || state.view.revision !== action.revision) {
      return finish(state, event, "rejected", "REVIEW_REQUIRED");
    }
    return finish({
      ...state,
      view: {
        ...state.view,
        phase: "committed",
        receipt: {
          id: derivedId(state, "receipt", review.revision),
          reviewId: review.id,
          lines: clone(review.lines),
          totalCents: review.totalCents,
          simulated: true,
        },
      },
    }, event, "applied");
  }
  if (state.view.phase === "committed") return finish(state, event, "rejected", "SESSION_COMMITTED");
  if (action.type === "DECLINE_SWAP") {
    if (!state.view.swapOffer || state.view.swapOffer.offerId !== action.offerId) return finish(state, event, "rejected", "STALE_OFFER");
    return finish(dismissOffer(state), event, "applied");
  }
  if (action.type === "ACCEPT_SWAP") {
    const offer = state.view.swapOffer;
    const next = invalidate(state);
    if (!state.waitConfig || !offer || state.view.phase !== "editing" || offer.offerId !== action.offerId ||
        offer.revision !== action.revision || state.view.revision !== action.revision ||
        offer.waitSnapshotId !== state.waitConfig.snapshot.id || state.suppressedLineIds.includes(offer.originalLineId)) {
      return finish(next, event, "rejected", "STALE_OFFER");
    }
    const candidate = swapCandidates(state.view.lines, state.waitConfig, [offer.originalLineId], state.catalog, state.allowedLocationIds).find(candidate => candidate.alternative.itemId === offer.alternative.itemId);
    if (!candidate || JSON.stringify({ ...candidate, offerId: offer.offerId, revision: offer.revision }) !== JSON.stringify(offer)) {
      return finish(next, event, "rejected", "STALE_OFFER");
    }
    const lines = state.view.lines.map(line => line.lineId === offer.originalLineId
      ? { ...line, itemId: offer.alternative.itemId, modifiers: [...offer.retainedModifiers] }
      : clone(line));
    return finish(installCart(next, { lines, lastLineId: offer.originalLineId }, [...state.history, snapshot(state)]), event, "applied");
  }
  if (action.type === "REVIEW") {
    if (state.view.pending) return finish(state, event, "rejected", "AMBIGUOUS_REFERENCE");
    if (state.view.lines.length === 0) return finish(state, event, "rejected", "EMPTY_CART");
    const reviewed = dismissOffer(state);
    return finish({
      ...reviewed,
      view: {
        ...reviewed.view,
        phase: "reviewing",
        review: {
          id: derivedId(state, "review", state.view.revision),
          revision: state.view.revision,
          lines: clone(state.view.lines),
          totalCents: state.view.totalCents,
        },
      },
    }, event, "applied");
  }
  if (action.type === "CHOOSE") {
    const pending = state.view.pending;
    const context = state.pendingContext;
    if (!pending || pending.id !== action.pendingId || !context) {
      return finish(state.view.review ? invalidate(state) : state, event, "rejected", "NO_PENDING");
    }
    const choice = pending.choices.find((candidate) => candidate.id === action.choiceId);
    if (!choice) return finish(state, event, "rejected", "NO_PENDING");
    return applyBatch(invalidate(state), event, choice.ops, context.requestId);
  }
  const next = invalidate(state);
  if (action.type === "CLEAR") {
    return finish(installCart(next, { lines: [], lastLineId: null }, [...state.history, snapshot(state)]), event, "applied");
  }
  if (action.type === "UNDO") return applyBatch(next, event, [{ type: "UNDO" }], "unused");
  return applyBatch(next, event, action.ops, `${state.view.sessionId}:ui:${state.view.audit.length + 1}`);
}

/**
 * Pure, deterministic transition. The controller owns capture/request activity
 * and must gate REVIEW/CONFIRM while busy, and discard cancelled request IDs.
 * Every admitted event is copied to the append-only audit.
 */
export function reduceEngine(state: EngineState, candidate: AuditEvent): EngineState {
  const parsed = AuditEventSchema.safeParse(candidate);
  if (!parsed.success) {
    // Invalid payloads cannot appear in a strict V1 audit. Still record the
    // valid input-attempt event for malformed manual edits, invalidating review.
    const isEditAttempt = candidate?.type === "UI" && candidate.action?.type !== "REVIEW" && candidate.action?.type !== "CONFIRM";
    const next = isEditAttempt ? reduceEngine(state, { type: "INPUT_STARTED" }) : state;
    return { ...next, lastOutcome: "rejected", lastCode: "INVALID_SCHEMA" };
  }
  const event = parsed.data;
  if (event.type === "INPUT_STARTED") {
    if (state.view.phase === "committed") return finish(state, event, "ignored", "SESSION_COMMITTED");
    const continuation = event.discardContinuation ? null : state.view.pending && state.pendingContext
      ? { pending: clone(state.view.pending), requestId: state.pendingContext.requestId }
      : state.continuation;
    return finish({ ...invalidate(state), continuation }, event, "applied");
  }
  if (event.type === "UI") return reduceUi({ ...state, continuation: null }, event, event.action);
  const response = event.response;
  if (state.seenRequestIds.includes(response.requestId) || response.baseRevision !== state.view.revision || response.menuVersion !== state.catalog.versionId) {
    return finish({ ...state, seenRequestIds: [...new Set([...state.seenRequestIds, response.requestId])] }, event, "ignored", "STALE_RESPONSE");
  }
  const admitted: EngineState = { ...state, seenRequestIds: [...state.seenRequestIds, response.requestId] };
  if (state.view.phase === "committed") return finish(admitted, event, "ignored", "SESSION_COMMITTED");
  if (response.result.kind === "reject") {
    return finish(admitted, event, "rejected", response.result.code);
  }
  if (response.result.kind === "resolve") {
    const choiceId = response.result.choiceId;
    const continuation = state.view.pending && state.pendingContext
      ? { pending: state.view.pending, requestId: state.pendingContext.requestId }
      : state.continuation;
    const choice = continuation?.pending.id === response.result.pendingId
      ? continuation.pending.choices.find((choice) => choice.id === choiceId)
      : undefined;
    if (!continuation || !choice) return finish(admitted, event, "rejected", "NO_PENDING");
    // Use the original batch's ADD IDs, never model-authored replacement ops.
    return applyBatch(invalidate(admitted), event, choice.ops, continuation.requestId);
  }
  const next = invalidate(admitted);
  if (response.result.kind === "clarify") {
    const menu = indexCatalog(state.catalog);
    // Every choice is checked against the catalog and the venue policy before any choice is displayed.
    if (response.result.choices.some(choice => choice.ops.some(op => {
      if (op.type !== "ADD") return false;
      const item = menu.item(op.itemId);
      return !item || (state.allowedLocationIds !== undefined && !state.allowedLocationIds.includes(item.locationId));
    }))) {
      return finish(next, event, "rejected", "OFF_MENU");
    }
    return finish(enterPending(next, response.requestId, response.result.question, response.result.choices), event, "clarify", "AMBIGUOUS_REFERENCE");
  }
  return applyBatch(next, event, response.result.ops, response.requestId);
}

export function exportLog(state: EngineState): string {
  return JSON.stringify({
    v: API_VERSION,
    menuVersion: state.catalog.versionId,
    sessionId: state.view.sessionId,
    audit: state.view.audit,
    ...(state.waitConfig ? { waitConfig: state.waitConfig } : {}),
    ...(state.allowedLocationIds === undefined ? {} : { allowedLocationIds: state.allowedLocationIds }),
  }, null, 2);
}

/**
 * Offline reconstruction only: no controller, recognition, API, or live order.
 * A log is replayed only against the exact catalog version it was recorded under;
 * an older or newer catalog is refused rather than silently repricing the order.
 */
export function replayLog(json: string, catalog: Catalog): OrderView {
  const log = ExportLogSchema.parse(JSON.parse(json));
  if (log.menuVersion !== catalog.versionId) {
    throw new Error(`MENU_VERSION_MISMATCH: log recorded under ${log.menuVersion}, catalog is ${catalog.versionId}.`);
  }
  let state = createEngine(log.sessionId, { catalog, waitConfig: log.waitConfig, allowedLocationIds: log.allowedLocationIds });
  for (const entry of log.audit) {
    if (entry.seq !== state.view.audit.length + 1) throw new Error("INVALID_SCHEMA: audit sequence is not contiguous.");
    state = reduceEngine(state, entry.event);
    const actual = state.view.audit.at(-1);
    if (!actual || actual.outcome !== entry.outcome || actual.code !== entry.code) {
      throw new Error(`INVALID_SCHEMA: audit outcome differs at sequence ${entry.seq}.`);
    }
  }
  return getView(state);
}
