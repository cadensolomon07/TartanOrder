import {
  API_VERSION,
  MENU_VERSION,
  LIMITS,
  AuditEventSchema,
  ExportLogSchema,
  IdSchema,
  WaitEngineConfigSchema,
  type AuditEntry,
  type AuditEvent,
  type Choice,
  type CoreCode,
  type Line,
  type Op,
  type OrderView,
  type Ref,
  type UiAction,
  type WaitEngineConfig,
} from "@/contracts";
import { MENU, MODIFIERS } from "@/contracts/menu";
import { deriveWaitView, swapCandidates } from "./waits";

type CartSnapshot = { lines: Line[]; lastLineId: string | null };
type PendingContext = { requestId: string };
type Outcome = AuditEntry["outcome"];

/** Opaque application state. Use getView to expose a detached UI snapshot. */
export type EngineState = {
  readonly view: OrderView;
  readonly history: readonly CartSnapshot[];
  readonly seenRequestIds: readonly string[];
  readonly pendingContext: PendingContext | null;
  /** A spoken answer can resume the exact choice after input invalidates its visible buttons. */
  readonly continuation: { pending: NonNullable<OrderView["pending"]>; requestId: string } | null;
  readonly lastOutcome: Outcome;
  readonly lastCode: string | null;
  readonly waitConfig?: WaitEngineConfig;
  readonly suppressedLineIds: readonly string[];
};

type Failure = { kind: "error"; code: CoreCode };
type Success = { kind: "success"; cart: CartSnapshot };
type Ambiguity = { kind: "ambiguous"; index: number; matches: Line[] };
type BatchResult = Success | Failure | { kind: "clarify"; question: string; choices: Choice[] };

const clone = <T>(value: T): T => structuredClone(value);

export function totalCents(lines: readonly Line[]): number {
  return lines.reduce((total, line) => total + line.qty * (
    MENU[line.itemId].priceCents + line.modifiers.reduce((sum, modifier) => sum + MODIFIERS[modifier].priceCents, 0)
  ), 0);
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

export function createEngine(sessionId: string, config?: WaitEngineConfig): EngineState {
  IdSchema.parse(sessionId);
  const waitConfig = config === undefined ? undefined : WaitEngineConfigSchema.parse(clone(config));
  return {
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
      ...(waitConfig ? { wait: deriveWaitView([], waitConfig), swapOffer: null } : {}),
    },
    history: [],
    seenRequestIds: [],
    pendingContext: null,
    continuation: null,
    lastOutcome: "applied",
    lastCode: null,
    ...(waitConfig ? { waitConfig } : {}),
    suppressedLineIds: [],
  };
}

export function getView(state: EngineState): OrderView {
  return clone(state.waitConfig ? { ...state.view, wait: deriveWaitView(state.view.lines, state.waitConfig) } : state.view);
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
      ...(state.waitConfig ? { wait: deriveWaitView(state.view.lines, state.waitConfig) } : {}),
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
function scanBatch(original: CartSnapshot, ops: Op[], requestId: string): Success | Failure | Ambiguity {
  const cart = clone(original);
  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];
    if (op.type === "UNDO") return { kind: "error", code: "INVALID_SCHEMA" };
    if (op.type === "ADD") {
      if (!op.modifiers.every((modifier) => MENU[op.itemId].allowedModifiers.includes(modifier))) {
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
        if (!MENU[target.itemId].allowedModifiers.includes(op.modifier)) {
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

function evaluateBatch(original: CartSnapshot, ops: Op[], requestId: string): BatchResult {
  const result = scanBatch(original, ops, requestId);
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
    const candidate = scanBatch(original, explicit, requestId);
    if (candidate.kind === "ambiguous") return { kind: "error", code: "AMBIGUOUS_REFERENCE" };
    if (candidate.kind === "error") return candidate;
    const modifiers = target.modifiers.map((modifier) => MODIFIERS[modifier].label).join(", ");
    choices.push({
      id: `option-${index + 1}`,
      label: `${MENU[target.itemId].label} ${index + 1}, quantity ${target.qty}${modifiers ? `, ${modifiers}` : ""}`,
      ops: explicit,
    });
  }
  return { kind: "clarify", question: `Which ${MENU[result.matches[0].itemId].label.toLowerCase()} line did you mean?`, choices };
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
      totalCents: totalCents(cart.lines),
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
  const result = evaluateBatch(before, ops, requestId);
  if (result.kind === "error") return finish(state, event, "rejected", result.code);
  if (result.kind === "clarify") {
    return finish(enterPending(state, requestId, result.question, result.choices), event, "clarify", "AMBIGUOUS_REFERENCE");
  }
  let installed = installCart(state, result.cart, [...state.history, before]);
  if (state.waitConfig) {
    const addedIds = result.cart.lines.filter(line => !before.lines.some(previous => previous.lineId === line.lineId) && !state.suppressedLineIds.includes(line.lineId)).map(line => line.lineId);
    const candidate = swapCandidates(result.cart.lines, state.waitConfig, addedIds)[0];
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
    const candidate = swapCandidates(state.view.lines, state.waitConfig, [offer.originalLineId]).find(candidate => candidate.alternative.itemId === offer.alternative.itemId);
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
  if (state.seenRequestIds.includes(response.requestId) || response.baseRevision !== state.view.revision || response.menuVersion !== MENU_VERSION) {
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
    return finish(enterPending(next, response.requestId, response.result.question, response.result.choices), event, "clarify", "AMBIGUOUS_REFERENCE");
  }
  return applyBatch(next, event, response.result.ops, response.requestId);
}

export function exportLog(state: EngineState): string {
  return JSON.stringify({
    v: API_VERSION,
    menuVersion: MENU_VERSION,
    sessionId: state.view.sessionId,
    audit: state.view.audit,
    ...(state.waitConfig ? { waitConfig: state.waitConfig } : {}),
  }, null, 2);
}

/** Offline reconstruction only: no controller, recognition, API, or live order. */
export function replayLog(json: string): OrderView {
  const log = ExportLogSchema.parse(JSON.parse(json));
  let state = createEngine(log.sessionId, log.waitConfig);
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
