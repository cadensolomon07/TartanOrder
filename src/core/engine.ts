import {
  API_VERSION,
  LIMITS,
  AuditEventSchema,
  ExportLogSchema,
  IdSchema,
  WaitEngineConfigSchema,
  AllowedLocationIdsSchema,
  DietaryProfileSchema,
  MealRequirementsSchema,
  type AuditEntry,
  type AuditEvent,
  type Catalog,
  type CatalogItem,
  type Choice,
  type CoreCode,
  type Line,
  type LocationId,
  type Op,
  type OrderView,
  type Ref,
  type UiAction,
  type WaitEngineConfig,
  type DietaryProfile,
  type MealRequirements,
  type RequirementChange,
  type RequirementDecision,
  type RequirementsState,
} from "@/contracts";
import { indexCatalog, type CatalogIndex } from "@/catalog/lookup";
import { normalizeFoodName } from "@/contracts/food";
import { deriveWaitView, swapCandidates, unitPriceCents } from "./waits";
import { checkCompatibility } from "./compatibility";
import { solveMeal, mealCartConflict, type MealSolution } from "./meal";

type CartSnapshot = { lines: Line[]; lastLineId: string | null; meal?: MealRequirements | null };
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
  readonly requirementsContinuation: RequirementDecision | null;
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
    requirementsContinuation: null,
    lastOutcome: "applied",
    lastCode: null,
    ...(waitConfig ? { waitConfig } : {}),
    ...(locations === undefined ? {} : { allowedLocationIds: locations }),
    suppressedLineIds: [],
  };
}

export function getView(state: EngineState): OrderView {
  return clone(refreshRequirements(indexCatalog(state.catalog), state.waitConfig ? { ...state.view, wait: deriveWaitView(state.view.lines, state.waitConfig, state.catalog) } : state.view));
}

function snapshot(state: EngineState): CartSnapshot {
  return { lines: clone(state.view.lines), lastLineId: state.view.lastLineId, ...(state.view.requirements ? { meal: clone(state.view.requirements.meal) } : {}) };
}

function refreshRequirements(menu: CatalogIndex, view: OrderView): OrderView {
  if (!view.requirements) return view;
  return { ...view, requirements: { ...view.requirements,
    checks: view.lines.map(line => ({ lineId: line.lineId, ...checkCompatibility(menu, line.itemId, line.modifiers, view.requirements!.profile) })),
    remainingCents: view.requirements.meal?.budgetCents == null ? null : view.requirements.meal.budgetCents - view.totalCents,
  } };
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
    requirementsContinuation: null,
    view: {
      ...state.view,
      revision: state.view.revision + 1,
      phase: "editing",
      pending: null,
      review: null,
      ...(state.view.requirements ? { requirements: { ...state.view.requirements, decision: null } } : {}),
    },
  };
}

function finish(state: EngineState, event: AuditEvent, outcome: Outcome, code: AuditEntry["code"] = null): EngineState {
  return {
    ...state,
    lastOutcome: outcome,
    lastCode: code,
    view: refreshRequirements(indexCatalog(state.catalog), {
      ...state.view,
      ...(state.waitConfig ? { wait: deriveWaitView(state.view.lines, state.waitConfig, state.catalog) } : {}),
      audit: [...state.view.audit, {
        seq: state.view.audit.length + 1,
        event: clone(event),
        outcome,
        code,
      }],
    }),
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
      cart.lines.push({ lineId, itemId: op.itemId, qty: op.qty, modifiers: [...op.modifiers], ...(op.note ? { note: op.note } : {}) });
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
      } else if (op.type === "SET_NOTE") {
        if (op.note) target.note = op.note;
        else delete target.note;
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
      ...(state.view.requirements ? { requirements: { ...state.view.requirements, locationId: cart.meal?.locationId ?? state.view.requirements.locationId, meal: clone(cart.meal ?? null), decision: null, message: null, solver: null } } : {}),
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

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const emptyProfile = (): DietaryProfile => ({ preference: "none", allergies: [], dislikes: [], exceptions: [] });
const sameConfiguration = (left: Line, right: Line) => left.itemId === right.itemId && [...left.modifiers].sort().join() === [...right.modifiers].sort().join();
const normalizeIngredient = (value: string) => { const name = normalizeFoodName(value); return name === "nut" ? "nuts" : name; };
/** Cart lines and accepted meal selections always name catalog items; anything else is an invariant violation. */
function itemOf(menu: CatalogIndex, itemId: string): CatalogItem {
  const item = menu.item(itemId);
  if (!item) throw new Error(`INVALID_SCHEMA: item ${itemId} is not in catalog ${menu.catalog.versionId}.`);
  return item;
}
const labelOf = (menu: CatalogIndex, itemId: string): string => menu.item(itemId)?.label ?? itemId;

function withRequirements(state: EngineState, locationId: LocationId): EngineState {
  if (state.view.requirements) return state;
  const requirements: RequirementsState = { locationId, meal: null, profile: emptyProfile(), decision: null, checks: [], message: null, remainingCents: null, solver: null };
  return { ...state, view: { ...state.view, requirements } };
}

function requirementsMessage(state: EngineState, message: string | null): EngineState {
  if (!state.view.requirements) return state;
  return { ...state, view: { ...state.view, requirements: { ...state.view.requirements, message: message?.slice(0, 300) ?? null } } };
}

function decision(state: EngineState, event: AuditEvent, value: Omit<RequirementDecision, "id" | "revision" | "choices">, extraChoice?: RequirementDecision["choices"][number], staff = false): EngineState {
  const pending: RequirementDecision = {
    ...value, message: value.message.slice(0, 300), id: derivedId(state, "decision", state.view.audit.length + 1), revision: state.view.revision,
    choices: [{ id: "keep", label: state.view.lines.length ? `Keep current ${dollars(state.view.totalCents)} order` : "Keep my current requirements" }, ...(extraChoice ? [extraChoice] : [])],
  };
  return finish({ ...state, requirementsContinuation: null, view: { ...state.view, phase: "clarifying", review: null,
    requirements: { ...state.view.requirements!, decision: pending, message: pending.message } } }, event, staff ? "rejected" : "clarify", staff ? "STAFF_REVIEW_REQUIRED" : "REQUIREMENT_CONFLICT");
}

function rowsForSolution(state: EngineState, solution: MealSolution, noteLines: readonly Line[] = state.view.lines): Line[] {
  const menu = indexCatalog(state.catalog);
  return solution.selections.map(selection => {
    const previous = state.view.lines.find(line => itemOf(menu, line.itemId).category === selection.component && line.qty === 1);
    // A staff request belongs to its item, never to an interchangeable meal slot.
    const note = noteLines.find(line => line.itemId === selection.itemId && line.qty === 1)?.note;
    return { lineId: previous?.lineId ?? derivedId(state, `meal-${selection.component}`, state.view.audit.length + 1), itemId: selection.itemId, qty: 1, modifiers: [...selection.modifiers], ...(note ? { note } : {}) };
  });
}

function changedLocks(state: EngineState, proposedMeal: MealRequirements) {
  const menu = indexCatalog(state.catalog);
  return proposedMeal.lockedItemIds.filter(itemId => {
    // A locked id that is not in the catalog can never be satisfied; it counts as a changed lock.
    const category = menu.item(itemId)?.category;
    const selected = proposedMeal.selections.find(selection => selection.component === category);
    const previous = state.view.requirements?.meal?.selections.find(selection => selection.itemId === itemId) ?? state.view.lines.find(line => line.itemId === itemId);
    return category === undefined || !proposedMeal.components.includes(category) || (selected && (selected.itemId !== itemId || (previous && [...selected.modifiers].sort().join() !== [...previous.modifiers].sort().join())));
  });
}

function mealConflict(state: EngineState, event: AuditEvent, proposedMeal: MealRequirements, proposedLines: Line[], message: string, minimumCents: number | null, noteLines: readonly Line[] = state.view.lines): EngineState {
  const menu = indexCatalog(state.catalog);
  const withoutBudget = mealCartConflict(menu, proposedLines, { ...proposedMeal, budgetCents: null });
  const conflictingLocks = changedLocks(state, proposedMeal);
  if (!conflictingLocks.length && minimumCents !== null && !withoutBudget && proposedMeal.budgetCents !== null && minimumCents > proposedMeal.budgetCents) {
    return decision(state, event, { kind: "budget", proposedMeal, proposedLines, minimumCents,
      message: `The requested meal costs ${dollars(minimumCents)}, above the ${dollars(proposedMeal.budgetCents)} menu-subtotal budget. Your accepted cart and requirements have not changed.` },
    { id: "raise_budget", label: `Increase menu budget to ${dollars(minimumCents)}` });
  }
  if (conflictingLocks.length) {
    const relaxed = { ...proposedMeal, lockedItemIds: proposedMeal.lockedItemIds.filter(itemId => !conflictingLocks.includes(itemId)) };
    const alternative = solveMeal(menu, relaxed, state.view.requirements!.profile, state.view.lines);
    if (alternative.kind === "solved") return decision(state, event, { kind: "locked_item", proposedMeal: relaxed, proposedLines: rowsForSolution(state, alternative, noteLines), minimumCents: alternative.totalCents,
      message: `This changes your locked ${conflictingLocks.map(itemId => labelOf(menu, itemId)).join(" and ")}. Keep the accepted meal, or explicitly replace that locked choice.` },
    { id: "replace_locked", label: "Replace the listed locked choice" });
  }
  return decision(state, event, { kind: "conflict", proposedMeal, proposedLines, minimumCents: null, message });
}

/** Checks the entire proposed cart without silently repairing or relaxing it. */
function enforceRequirements(state: EngineState, event: AuditEvent, cart: CartSnapshot): EngineState | null {
  const requirements = state.view.requirements;
  if (!requirements) return null;
  const menu = indexCatalog(state.catalog);
  if (requirements.meal) {
    const selected = cart.lines.map(line => ({ component: itemOf(menu, line.itemId).category, itemId: line.itemId, modifiers: [...line.modifiers] }));
    cart.meal = { ...requirements.meal, selections: selected.length <= 3 ? selected : requirements.meal.selections };
  }
  const flagged = cart.lines.map(line => ({ line, check: checkCompatibility(menu, line.itemId, line.modifiers, requirements.profile) })).filter(({ line, check }) => {
    if (check.status === "match") return false;
    // Previously accepted rows flagged by a later declaration stay visible. A
    // user can remove/reduce them one at a time, while confirmation stays blocked.
    return !state.view.lines.some(previous => previous.lineId === line.lineId && sameConfiguration(previous, line) && line.qty <= previous.qty);
  });
  if (flagged.length) {
    const staff = flagged.some(entry => entry.check.staffReview);
    return decision(state, event, { kind: staff ? "conflict" : "preference", proposedMeal: cart.meal ?? null, proposedLines: clone(cart.lines), minimumCents: null,
      message: `Not added: ${flagged.map(({ line, check }) => `${labelOf(menu, line.itemId)}: ${check.reasons.join(" ")}`).join(" ")}` },
    staff ? undefined : { id: "allow_preference", label: "Allow this exact preference exception" }, staff);
  }
  if (cart.meal) {
    if (changedLocks(state, cart.meal).length) return mealConflict(state, event, cart.meal, cart.lines, "This changes a locked item or its configuration.", totalCents(cart.lines, state.catalog), cart.lines);
    const conflict = mealCartConflict(menu, cart.lines, cart.meal);
    if (conflict) return mealConflict(state, event, cart.meal, cart.lines, conflict, totalCents(cart.lines, state.catalog), cart.lines);
  }
  return null;
}

function commitMeal(state: EngineState, event: AuditEvent, meal: MealRequirements, noteLines: readonly Line[] = state.view.lines): EngineState {
  if (state.allowedLocationIds && !state.allowedLocationIds.includes(meal.locationId)) return finish(requirementsMessage(state, "This counter is outside the current ordering catalog."), event, "rejected", "OFF_MENU");
  const solved = solveMeal(indexCatalog(state.catalog), meal, state.view.requirements!.profile, state.view.lines);
  const solving = { ...state, view: { ...state.view, requirements: { ...state.view.requirements!, solver: solved.summary } } };
  const lines = rowsForSolution(state, solved, noteLines);
  if (changedLocks(state, meal).length) return mealConflict(solving, event, meal, lines, "This changes a locked item or its configuration.", solved.totalCents, noteLines);
  if (solved.kind !== "solved") return mealConflict(solving, event, meal, lines, solved.reason, solved.totalCents, noteLines);
  const next = installCart(solving, { lines, lastLineId: lines.at(-1)?.lineId ?? null, meal }, [...state.history, snapshot(state)]);
  next.view.requirements = { ...next.view.requirements!, solver: solved.summary };
  const remaining = meal.budgetCents === null ? "" : ` ${dollars(meal.budgetCents - totalCents(lines, state.catalog))} remains under your menu-subtotal budget.`;
  return finish(requirementsMessage(next, `Your meal includes one of each requested component.${remaining} Taxes and fees are not calculated.`), event, "applied");
}

function applyRequirements(state: EngineState, event: AuditEvent, locationId: LocationId, changes: RequirementChange[], ops?: Op[], requestId = "requirements"): EngineState {
  if (state.allowedLocationIds && !state.allowedLocationIds.includes(locationId)) return finish(state, event, "rejected", "OFF_MENU");
  const menu = indexCatalog(state.catalog);
  state = withRequirements(state, locationId);
  const accepted = state.view.requirements!;
  const profile = clone(accepted.profile);
  let invalidResolution = false;
  // Declarations take effect even when a concurrent item request cannot apply.
  for (const change of changes) {
    if (change.type === "SET_DIETARY") { if (profile.preference !== change.preference) profile.exceptions = []; profile.preference = change.preference; }
    if (change.type === "ADD_ALLERGY") profile.allergies = [...new Set([...profile.allergies, normalizeIngredient(change.allergen)])];
    if (change.type === "REMOVE_ALLERGY") profile.allergies = profile.allergies.filter(name => normalizeIngredient(name) !== normalizeIngredient(change.allergen));
    if (change.type === "RESOLVE_ALLERGEN") {
      if (normalizeIngredient(change.from) !== "nuts" || !profile.allergies.some(name => normalizeIngredient(name) === "nuts")) invalidResolution = true;
      else profile.allergies = [...new Set([...profile.allergies.filter(name => normalizeIngredient(name) !== "nuts"), ...change.to.map(normalizeIngredient)])];
    }
    if (change.type === "SET_DISLIKE") profile.dislikes = change.enabled ? [...new Set([...profile.dislikes, normalizeIngredient(change.ingredient)])] : profile.dislikes.filter(name => normalizeIngredient(name) !== normalizeIngredient(change.ingredient));
    if (change.type === "REMOVE_EXCEPTION") profile.exceptions = profile.exceptions.filter(exception => exception.itemId !== change.itemId);
  }
  if (!DietaryProfileSchema.safeParse(profile).success) return decision(state, event, { kind: "conflict", proposedMeal: accepted.meal, proposedLines: clone(state.view.lines), minimumCents: null,
    message: "The profile limit was reached. Your previous profile is retained; the new declaration was not stored. Review these restrictions with staff and explicitly edit the profile before continuing." }, undefined, true);
  state = { ...state, view: { ...state.view, requirements: { ...accepted, profile, decision: null, message: null } } };
  if (invalidResolution) return finish(requirementsMessage(state, "Only an existing ambiguous nuts restriction can be clarified this way. Changing a declared allergy requires its explicit removal; the original allergy remains active."), event, "rejected", "REQUIREMENT_CONFLICT");
  let meal = clone(accepted.meal);
  let mealChanged = false;
  let leaving = false;
  let nextLocation: LocationId | null = null;
  const ensureMeal = () => meal ??= { locationId: accepted.locationId, budgetCents: null, components: ["mains", "sides", "drinks"], selections: state.view.lines.filter(line => line.modifiers.length > 0).map(line => ({ component: itemOf(menu, line.itemId).category, itemId: line.itemId, modifiers: [...line.modifiers] })), lockedItemIds: [] };
  for (const change of changes) {
    if (change.type === "SET_MEAL_MODE") { if (change.enabled) { ensureMeal(); mealChanged = true; } else leaving = meal !== null; }
    if (change.type === "SET_BUDGET") { ensureMeal().budgetCents = change.budgetCents; mealChanged = true; }
    if (change.type === "SET_COMPONENTS") { ensureMeal().components = [...change.components]; mealChanged = true; }
    if (change.type === "SELECT_ITEM") {
      // The schema bounds the id's shape only; a requested item must exist in the loaded catalog.
      const selectedItem = menu.item(change.itemId);
      if (!selectedItem) return finish(requirementsMessage(state, "That item is not in the current catalog. Your dietary declarations remain active."), event, "rejected", "OFF_MENU");
      const target = ensureMeal(); const component = selectedItem.category;
      target.selections = [...target.selections.filter(selection => selection.component !== component), { component, itemId: change.itemId, modifiers: [...change.modifiers] }];
      if (change.locked) target.lockedItemIds = [...new Set([...target.lockedItemIds, change.itemId])];
      mealChanged = true;
    }
    if (change.type === "CLEAR_SELECTION") { ensureMeal().selections = ensureMeal().selections.filter(selection => selection.component !== change.component); mealChanged = true; }
    if (change.type === "UNLOCK_ITEM") { ensureMeal().lockedItemIds = ensureMeal().lockedItemIds.filter(itemId => itemId !== change.itemId); mealChanged = true; }
    if (change.type === "SWITCH_LOCATION") nextLocation = change.locationId;
  }
  if (nextLocation && state.allowedLocationIds && !state.allowedLocationIds.includes(nextLocation)) return finish(requirementsMessage(state, "This counter is outside the current ordering catalog."), event, "rejected", "OFF_MENU");
  if (nextLocation && nextLocation !== accepted.locationId && accepted.meal) return decision(state, event, { kind: "switch_counter", proposedMeal: null, proposedLines: clone(state.view.lines), minimumCents: null, nextLocationId: nextLocation,
    message: "Changing counters will leave Build my meal mode and keep your current cart and dietary profile. Confirm this change first." }, { id: "switch_counter", label: "Switch counter and leave meal mode" });
  if (leaving) return decision(state, event, { kind: "leave_meal", proposedMeal: null, proposedLines: clone(state.view.lines), minimumCents: null,
    message: "Leaving Build my meal removes its budget, component and lock requirements. Your current cart and dietary profile will remain." }, { id: "leave_meal", label: "Leave meal mode; keep cart and profile" });
  if (nextLocation) state = { ...state, view: { ...state.view, requirements: { ...state.view.requirements!, locationId: nextLocation } } };
  if (mealChanged && meal) {
    let noteLines: readonly Line[] = state.view.lines;
    if (!accepted.meal && (state.view.lines.some(line => line.qty !== 1) || new Set(state.view.lines.map(line => itemOf(menu, line.itemId).category)).size !== state.view.lines.length)) return finish(requirementsMessage(state, "Build my meal needs one item per component. Your existing quantities and separate items were kept; edit them explicitly before enabling meal mode."), event, "rejected", "REQUIREMENT_CONFLICT");
    if (ops) {
      const trial = evaluateBatch(menu, snapshot(state), ops, requestId, state.allowedLocationIds);
      if (trial.kind !== "success") return finish(requirementsMessage(state, "The additional item edits could not be applied. Your dietary declaration remains active."), event, "rejected", trial.kind === "error" ? trial.code : "AMBIGUOUS_REFERENCE");
      if (trial.cart.lines.some(line => line.qty !== 1) || new Set(trial.cart.lines.map(line => itemOf(menu, line.itemId).category)).size !== trial.cart.lines.length) return finish(requirementsMessage(state, "Build my meal supports one item per component; no requested quantity or separate item was dropped."), event, "rejected", "REQUIREMENT_CONFLICT");
      noteLines = trial.cart.lines;
      for (const line of trial.cart.lines) {
        const previous = state.view.lines.find(old => old.lineId === line.lineId);
        if (!previous || !sameConfiguration(previous, line)) {
          if (line.qty !== 1) return finish(requirementsMessage(state, "Build my meal supports one item per component; the requested quantity was not reduced."), event, "rejected", "REQUIREMENT_CONFLICT");
          const component = itemOf(menu, line.itemId).category;
          meal.selections = [...meal.selections.filter(selection => selection.component !== component), { component, itemId: line.itemId, modifiers: [...line.modifiers] }];
        }
      }
    }
    if (!MealRequirementsSchema.safeParse(meal).success) return finish(requirementsMessage(state, "These meal requirements exceed the supported component or lock limits. Your accepted meal is unchanged; explicitly unlock a choice before replacing it."), event, "rejected", "REQUIREMENT_CONFLICT");
    return commitMeal(state, event, meal, noteLines);
  }
  if (ops) return applyBatch(state, event, ops, requestId);
  const checks = refreshRequirements(menu, state.view).requirements!.checks;
  const flags = checks.filter(check => check.status !== "match");
  return finish(requirementsMessage(state, flags.length ? `Your profile is saved. The current cart needs attention: ${flags.flatMap(check => check.reasons).join(" ")}` : "Your requirements are saved and remain active for future edits."), event, "applied");
}

function decideRequirements(state: EngineState, event: AuditEvent, pendingId: string, choiceId: string, revision?: number): EngineState {
  const menu = indexCatalog(state.catalog);
  const active = state.view.requirements?.decision;
  const pending = revision === undefined ? active ?? state.requirementsContinuation : active;
  if (!pending || pending.id !== pendingId || (revision !== undefined && (pending.revision !== revision || state.view.revision !== revision)) || !pending.choices.some(choice => choice.id === choiceId)) return finish(state, event, "rejected", "STALE_DECISION");
  let next = invalidate(state);
  if (choiceId === "keep") return finish(requirementsMessage(next, "Kept your accepted cart and requirements."), event, "applied");
  if (choiceId === "switch_counter" || choiceId === "leave_meal") {
    const locationId = pending.nextLocationId ?? state.view.requirements!.locationId;
    next = { ...next, view: { ...next.view, requirements: { ...next.view.requirements!, locationId, meal: null, solver: null } } };
    return finish(requirementsMessage(installCart(next, { lines: clone(pending.proposedLines), lastLineId: pending.proposedLines.some(line => line.lineId === state.view.lastLineId) ? state.view.lastLineId : null, meal: null }, [...state.history, snapshot(state)]), "Meal mode has ended. Your dietary profile remains active."), event, "applied");
  }
  const meal = clone(pending.proposedMeal);
  if (choiceId === "raise_budget") {
    if (!meal || pending.minimumCents === null) return finish(next, event, "rejected", "STALE_DECISION");
    meal.budgetCents = pending.minimumCents;
  }
  if (choiceId === "allow_preference") {
    const profile = clone(next.view.requirements!.profile);
    for (const line of pending.proposedLines) {
      const check = checkCompatibility(menu, line.itemId, line.modifiers, profile);
      if (check.staffReview) return finish(requirementsMessage(next, "Allergy or preparation uncertainty requires staff review; no automatic exception is available."), event, "rejected", "STAFF_REVIEW_REQUIRED");
      if (check.status !== "match") profile.exceptions.push({ itemId: line.itemId, modifiers: [...line.modifiers], preference: profile.preference, dislikes: [...profile.dislikes] });
    }
    if (profile.exceptions.length > 20) return finish(next, event, "rejected", "REQUIREMENT_CONFLICT");
    next = { ...next, view: { ...next.view, requirements: { ...next.view.requirements!, profile } } };
  }
  const lines = clone(pending.proposedLines);
  if (lines.some(line => {
    const item = menu.item(line.itemId);
    return !item || (state.allowedLocationIds !== undefined && !state.allowedLocationIds.includes(item.locationId)) || !line.modifiers.every(modifier => item.allowedModifiers.includes(modifier));
  })) return finish(next, event, "rejected", "OFF_MENU");
  const checks = lines.map(line => checkCompatibility(menu, line.itemId, line.modifiers, next.view.requirements!.profile));
  if (checks.some(check => check.status !== "match")) return finish(requirementsMessage(next, "The proposed change still conflicts with your current profile."), event, "rejected", checks.some(check => check.staffReview) ? "STAFF_REVIEW_REQUIRED" : "REQUIREMENT_CONFLICT");
  const mealProblem = meal ? mealCartConflict(menu, lines, meal) : null;
  if (meal && mealProblem) return mealConflict(next, event, meal, lines, mealProblem, totalCents(lines, state.catalog));
  const installed = installCart(next, { lines, lastLineId: lines.at(-1)?.lineId ?? null, meal }, [...state.history, snapshot(state)]);
  return finish(requirementsMessage(installed, choiceId === "raise_budget" ? `You explicitly set the menu-subtotal budget to ${dollars(meal!.budgetCents!)}. The proposed meal is now accepted.` : "Your explicit choice is applied. Dietary requirements remain active."), event, "applied");
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
  const blocked = enforceRequirements(state, event, result.cart);
  if (blocked) return blocked;
  let installed = installCart(state, result.cart, [...state.history, before]);
  if (state.waitConfig && !state.view.requirements?.meal) {
    const addedIds = result.cart.lines.filter(line => !before.lines.some(previous => previous.lineId === line.lineId) && !state.suppressedLineIds.includes(line.lineId)).map(line => line.lineId);
    // A swap is only offered when the alternative also satisfies the active dietary profile.
    const candidate = swapCandidates(result.cart.lines, state.waitConfig, addedIds, state.catalog, state.allowedLocationIds)
      .find(candidate => !state.view.requirements || checkCompatibility(indexCatalog(state.catalog), candidate.alternative.itemId, candidate.retainedModifiers, state.view.requirements.profile).status === "match");
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
    const requirements = getView(state).requirements;
    if (requirements && (requirements.decision || state.requirementsContinuation || requirements.checks.some(check => check.status !== "match") || (requirements.meal && mealCartConflict(indexCatalog(state.catalog), state.view.lines, requirements.meal)))) return finish(state, event, "rejected", requirements.checks.some(check => check.staffReview) ? "STAFF_REVIEW_REQUIRED" : "REQUIREMENT_CONFLICT");
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
  if (action.type === "RESUME_REQUIREMENTS_DECISION") {
    const pending = state.requirementsContinuation;
    if (!pending) return finish(state, event, "rejected", "STALE_DECISION");
    const proposal = { kind: pending.kind, message: pending.message, proposedMeal: pending.proposedMeal, proposedLines: pending.proposedLines, minimumCents: pending.minimumCents, ...(pending.nextLocationId ? { nextLocationId: pending.nextLocationId } : {}) };
    const staff = pending.proposedLines.some(line => checkCompatibility(indexCatalog(state.catalog), line.itemId, line.modifiers, state.view.requirements!.profile).staffReview);
    return decision(invalidate(state), event, proposal, pending.choices[1], staff);
  }
  if (action.type === "REQUIREMENTS") return applyRequirements(invalidate(state), event, action.locationId, action.changes);
  if (action.type === "DECIDE_REQUIREMENTS") return decideRequirements(state, event, action.pendingId, action.choiceId, action.revision);
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
    const cart = { lines, lastLineId: offer.originalLineId };
    const blocked = enforceRequirements(next, event, cart);
    if (blocked) return blocked;
    const switched = next.view.requirements ? { ...next, view: { ...next.view, requirements: { ...next.view.requirements, locationId: offer.alternative.vendorId } } } : next;
    return finish(installCart(switched, cart, [...state.history, snapshot(state)]), event, "applied");
  }
  if (action.type === "REVIEW") {
    if (state.view.pending) return finish(state, event, "rejected", "AMBIGUOUS_REFERENCE");
    if (state.view.lines.length === 0) return finish(state, event, "rejected", "EMPTY_CART");
    const requirements = getView(state).requirements;
    if (requirements && (requirements.decision || state.requirementsContinuation || requirements.checks.some(check => check.status !== "match") || (requirements.meal && mealCartConflict(indexCatalog(state.catalog), state.view.lines, requirements.meal)))) return finish(state, event, "rejected", requirements.checks.some(check => check.staffReview) ? "STAFF_REVIEW_REQUIRED" : "REQUIREMENT_CONFLICT");
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
    if (state.view.requirements?.meal) return decision(next, event, { kind: "leave_meal", proposedMeal: null, proposedLines: [], minimumCents: null,
      message: "Clearing the cart also leaves Build my meal mode. Your dietary profile will remain active." }, { id: "leave_meal", label: "Clear cart and leave meal mode" });
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
    const requirementsContinuation = event.discardContinuation ? null : state.view.requirements?.decision ?? state.requirementsContinuation;
    return finish({ ...invalidate(state), continuation, requirementsContinuation }, event, "applied");
  }
  if (event.type === "UI") return reduceUi({ ...state, continuation: null }, event, event.action);
  const response = event.response;
  if (state.seenRequestIds.includes(response.requestId) || response.baseRevision !== state.view.revision || response.menuVersion !== state.catalog.versionId) {
    return finish({ ...state, seenRequestIds: [...new Set([...state.seenRequestIds, response.requestId])] }, event, "ignored", "STALE_RESPONSE");
  }
  const admitted: EngineState = { ...state, seenRequestIds: [...state.seenRequestIds, response.requestId] };
  if (state.view.phase === "committed") return finish(admitted, event, "ignored", "SESSION_COMMITTED");
  if (response.result.kind === "requirements") return applyRequirements(invalidate(admitted), event, response.result.locationId, response.result.changes, response.result.ops, response.requestId);
  if (response.result.kind === "decide_requirements") return decideRequirements(admitted, event, response.result.pendingId, response.result.choiceId);
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
