import { LIMITS, type ItemId, type ModifierId, type Op } from "@/contracts";
import { type Lexicon, type ModifierChange } from "./lexicon";
import { MESSAGES, reject, type Rejection } from "./messages";
import { applyChanges, parseClause, type Clause, type ModelRef } from "./clauses";
import { stripMarkers, tokenizeClause } from "./normalize";

type PendingAdd = { readonly kind: "add"; readonly itemId: ItemId; readonly qty: number; readonly modifiers: readonly ModifierId[] };
type PendingOp = { readonly kind: "op"; readonly op: Op };
type Pending = PendingAdd | PendingOp;

/**
 * The batch under construction. Only correction syntax rewrites it in place of emitting
 * compensating operations (D3); plain edit commands become sequential ops whose references
 * the engine resolves in order on its temporary cart. `topic` and `awaitingCorrection` carry
 * the "not X, I mean Y" form; `carry` remembers a marker with nothing after it yet.
 */
type BatchState = {
  readonly pending: readonly Pending[];
  readonly topic: ItemId | null;
  readonly awaitingCorrection: boolean;
  readonly carry: boolean;
};
type Flags = { readonly corrected: boolean; readonly drop: boolean };
type Step = { readonly ok: true; readonly state: BatchState } | { readonly ok: false; readonly rejection: Rejection };
type ModClause = Extract<Clause, { kind: "mod" }>;

const INITIAL: BatchState = { pending: [], topic: null, awaitingCorrection: false, carry: false };
const UNSUPPORTED = reject("UNSUPPORTED", MESSAGES.unsupported);

const ok = (state: BatchState): Step => ({ ok: true, state });
const fail = (rejection: Rejection): Step => ({ ok: false, rejection });

function lastIndexWhere<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) if (predicate(items[index])) return index;
  return -1;
}

/** The pending ADD a reference points at within this batch, or -1 if it targets the cart. */
function pendingAddIndex(pending: readonly Pending[], ref: ModelRef): number {
  if (ref.by === "item") return lastIndexWhere(pending, (entry) => entry.kind === "add" && entry.itemId === ref.itemId);
  const last = pending[pending.length - 1];
  return last?.kind === "add" ? pending.length - 1 : -1;
}

function replaceAt(pending: readonly Pending[], index: number, entry: Pending): Pending[] {
  return pending.map((current, position) => (position === index ? entry : current));
}

function push(state: BatchState, op: Op): BatchState {
  return { ...state, pending: [...state.pending, { kind: "op", op }] };
}

function pushMods(state: BatchState, ref: ModelRef, changes: readonly ModifierChange[]): BatchState {
  return changes.reduce((current, change) => push(current, { type: "MOD", ref, modifier: change.modifier, enabled: change.enabled }), state);
}

/** "remove it" after "not the fries, I mean the lemonade" means the lemonade. */
function resolveTopic(state: BatchState, ref: ModelRef): { ref: ModelRef; state: BatchState } {
  if (ref.by !== "last" || state.topic === null) return { ref, state };
  return { ref: { by: "item", itemId: state.topic }, state: { ...state, topic: null } };
}

/** "scratch the fries" retracts a pending ADD; with none pending it is a cart REMOVE. */
function retract(state: BatchState, ref: ModelRef): BatchState {
  const index = pendingAddIndex(state.pending, ref);
  if (index < 0) return push(state, { type: "REMOVE", ref });
  return { ...state, pending: state.pending.filter((_, position) => position !== index) };
}

/** "actually make that three" re-quantifies a pending ADD; with none pending it is a cart SET_QTY. */
function requantify(state: BatchState, ref: ModelRef, qty: number): BatchState {
  const index = pendingAddIndex(state.pending, ref);
  if (index < 0) return push(state, { type: "SET_QTY", ref, qty });
  const add = state.pending[index] as PendingAdd;
  return { ...state, pending: replaceAt(state.pending, index, { ...add, qty }) };
}

function attach(state: BatchState, index: number, changes: readonly ModifierChange[]): BatchState {
  const add = state.pending[index] as PendingAdd;
  return { ...state, pending: replaceAt(state.pending, index, { ...add, modifiers: applyChanges(add.modifiers, changes) }) };
}

/** "actually make it a double" modifies a pending ADD; with none pending it is a cart MOD. */
function remodify(state: BatchState, ref: ModelRef, changes: readonly ModifierChange[]): BatchState {
  const index = pendingAddIndex(state.pending, ref);
  return index >= 0 ? attach(state, index, changes) : pushMods(state, ref, changes);
}

/** A bare modifier phrase is inline for the ADD it follows; otherwise it targets the sole accepting item or the last line (D2). */
function applyBareMod(state: BatchState, changes: readonly ModifierChange[], lexicon: Lexicon): BatchState {
  const index = pendingAddIndex(state.pending, { by: "last" });
  if (index >= 0) return attach(state, index, changes);
  return changes.reduce((current, change) => {
    const sole = lexicon.soleItemForModifier[change.modifier];
    const target: ModelRef = sole ? { by: "item", itemId: sole } : { by: "last" };
    return push(current, { type: "MOD", ref: target, modifier: change.modifier, enabled: change.enabled });
  }, state);
}

function applyMod(state: BatchState, clause: ModClause, corrected: boolean, lexicon: Lexicon): BatchState {
  if (clause.ref === null) return applyBareMod(state, clause.changes, lexicon);
  const resolved = resolveTopic(state, clause.ref);
  return corrected ? remodify(resolved.state, resolved.ref, clause.changes) : pushMods(resolved.state, resolved.ref, clause.changes);
}

function applyAdd(state: BatchState, clause: Extract<Clause, { kind: "add" }>, corrected: boolean): BatchState {
  const entry: PendingAdd = { kind: "add", itemId: clause.itemId, qty: clause.qty, modifiers: clause.modifiers };
  const kept = corrected && state.pending.length > 0 ? state.pending.slice(0, -1) : state.pending;
  return { ...state, pending: [...kept, entry] };
}

/** Corrections rewrite the pending batch; plain REMOVE/SET_QTY/MOD commands keep their references for the engine. */
function applyParsed(state: BatchState, clause: Clause, corrected: boolean, lexicon: Lexicon): Step {
  switch (clause.kind) {
    case "reject": return fail(clause);
    case "undo": return ok(push(state, { type: "UNDO" }));
    case "add": return ok(applyAdd(state, clause, corrected));
    case "topic":
      if (clause.negated) return ok({ ...state, awaitingCorrection: true });
      return corrected ? ok({ ...state, topic: clause.itemId }) : fail(UNSUPPORTED);
    case "remove": {
      const { ref, state: current } = resolveTopic(state, clause.ref);
      return ok(corrected || clause.retracts ? retract(current, ref) : push(current, { type: "REMOVE", ref }));
    }
    case "setQty": {
      const { ref, state: current } = resolveTopic(state, clause.ref);
      return ok(corrected ? requantify(current, ref, clause.qty) : push(current, { type: "SET_QTY", ref, qty: clause.qty }));
    }
    case "mod": return ok(applyMod(state, clause, corrected, lexicon));
  }
}

function applyClause(state: BatchState, tokens: readonly string[], flags: Flags, lexicon: Lexicon): Step {
  const corrected = flags.corrected || state.carry;
  let pending = state.pending;
  if (flags.drop) {
    if (pending.length === 0) return fail(reject("UNSUPPORTED", MESSAGES.nothingToScratch));
    pending = pending.slice(0, -1);
  }
  if (tokens.length === 0) return ok({ ...state, pending, carry: corrected && !flags.drop });
  const clause = parseClause(tokens, lexicon);
  // After "not the fries", only a marker or a replacement topic ("I mean the lemonade") may follow.
  if (state.awaitingCorrection && !corrected && clause.kind !== "topic") return fail(UNSUPPORTED);
  const topicAfterNegation = clause.kind === "topic" && state.awaitingCorrection;
  return applyParsed({ ...state, pending, carry: false, awaitingCorrection: false }, clause, corrected || topicAfterNegation, lexicon);
}

function toOp(entry: Pending): Op {
  return entry.kind === "op" ? entry.op : { type: "ADD", itemId: entry.itemId, qty: entry.qty, modifiers: [...entry.modifiers] };
}

function finalize(state: BatchState): Op[] | Rejection {
  if (state.carry) return reject("UNSUPPORTED", MESSAGES.unfinished);
  if (state.awaitingCorrection || state.topic !== null) return UNSUPPORTED;
  const ops = state.pending.map(toOp);
  if (ops.length === 0) return reject("UNSUPPORTED", MESSAGES.nothingLeft);
  if (ops.length > 1 && ops.some((op) => op.type === "UNDO")) return reject("UNSUPPORTED", MESSAGES.undoAlone);
  if (ops.length > LIMITS.operations) return reject("UNSUPPORTED", MESSAGES.tooManyOps);
  return ops;
}

/** Processes clauses left to right with correction markers; fails closed on anything unclaimed. */
export function buildBatch(clauses: readonly string[], lexicon: Lexicon): Op[] | Rejection {
  let state = INITIAL;
  for (const clause of clauses) {
    const marked = stripMarkers(tokenizeClause(clause), lexicon);
    const step = applyClause(state, marked.tokens, { corrected: marked.corrected, drop: marked.drop }, lexicon);
    if (!step.ok) return step.rejection;
    state = step.state;
  }
  return finalize(state);
}
