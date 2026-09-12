"use client";
import { useRef, useState, type FormEvent } from "react";
import type { DietaryProfile, Line, LocationId, MealComponent, RequirementChange, RequirementsState, UiAction } from "@/contracts";
import { COMMON_ALLERGENS, FOOD_GUIDANCE_URL } from "@/contracts/food";
import { MENU, MODIFIERS } from "@/contracts/menu";
import { totalCents } from "@/core/engine";
import { formatCents } from "./labels";
import styles from "./RequirementsPanel.module.css";

const EMPTY_PROFILE: DietaryProfile = { preference: "none", allergies: [], dislikes: [], exceptions: [] };
const COMPONENTS: { id: MealComponent; label: string }[] = [{ id: "mains", label: "Main" }, { id: "sides", label: "Side" }, { id: "drinks", label: "Drink" }];

export function RequirementsSummary({ requirements }: { requirements?: RequirementsState }) {
  if (!requirements) return null;
  const { meal, profile } = requirements;
  if (!meal && profile.preference === "none" && !profile.allergies.length && !profile.dislikes.length) return null;
  return <section className={styles.summaryPanel} data-testid="requirements-summary" aria-label="Requirements for this cart">
    <div className={styles.heading}><h2>For this cart</h2><a href="#food-requirements">Edit requirements</a></div>
    <div className={styles.summaryChips}>
      {meal && <><span>{meal.budgetCents === null ? "No menu budget" : `Menu budget ${formatCents(meal.budgetCents)}`}</span><span>{COMPONENTS.filter(component => meal.components.includes(component.id)).map(component => component.label).join(" + ")}</span>{meal.lockedItemIds.map(id => <span key={id}>Keep {MENU[id].label}</span>)}</>}
      {profile.preference !== "none" && <span>Preference: {profile.preference}</span>}
      {profile.allergies.map(name => <span key={`allergy-${name}`}>Allergy: {name}</span>)}
      {profile.dislikes.map(name => <span key={`dislike-${name}`}>Dislike: {name}</span>)}
    </div>
  </section>;
}

export function RequirementsPanel({ requirements, lines, acceptedTotalCents, locationId, disabled, onAction, onStartDraft, onEndDraft }: {
  requirements?: RequirementsState; lines: Line[]; acceptedTotalCents: number; locationId: LocationId; disabled: boolean; onAction: (action: UiAction) => void; onStartDraft?: () => void; onEndDraft?: () => void;
}) {
  const profile = requirements?.profile ?? EMPTY_PROFILE;
  const meal = requirements?.meal;
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  const dirtyRef = useRef(new Set<string>());
  const [dirtyFields, setDirtyFields] = useState(new Set<string>());
  const drafting = dirtyFields.size > 0;
  const endDraft = () => {
    const owned = dirtyRef.current.size > 0;
    dirtyRef.current = new Set(); setDirtyFields(new Set());
    panel.current?.querySelectorAll("form").forEach(form => form.reset());
    if (owned) onEndDraft?.();
  };
  const draft = (field: string, value: string, original = "") => {
    const next = new Set(dirtyRef.current);
    if (value === original) next.delete(field); else next.add(field);
    if (next.size > 0 && dirtyRef.current.size === 0) onStartDraft?.();
    if (next.size === 0 && dirtyRef.current.size > 0) { endDraft(); return; }
    dirtyRef.current = next; setDirtyFields(next);
  };
  const change = (changes: RequirementChange[]) => { setFormNotice(null); onAction({ type: "REQUIREMENTS", locationId, changes }); };
  const addNamed = (event: FormEvent<HTMLFormElement>, kind: "allergy" | "dislike") => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get(kind) ?? "").trim();
    if (!value || value.length > 60) return;
    endDraft();
    change([kind === "allergy" ? { type: "ADD_ALLERGY", allergen: value } : { type: "SET_DISLIKE", ingredient: value, enabled: true }]);
    event.currentTarget.reset();
  };
  const setBudget = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("budget") ?? "").trim();
    if (value && !/^\d{1,4}(?:\.\d{1,2})?$/.test(value)) { setFormNotice("Enter a menu budget in dollars, with at most two decimal places."); return; }
    const cents = value ? Math.round(Number(value) * 100) : null;
    if (cents !== null && cents > 100000) { setFormNotice("The demo supports a menu budget up to $1,000."); return; }
    endDraft();
    change([{ type: "SET_BUDGET", budgetCents: cents }]);
  };
  const issues = requirements?.checks.filter(check => check.status !== "match") ?? [];
  const staffIssues = issues.filter(check => check.staffReview);
  const decision = requirements?.decision;
  const proposedTotal = decision?.proposedLines.length ? totalCents(decision.proposedLines) : null;

  return <section ref={panel} id="food-requirements" className={styles.panel} data-testid="requirements-panel" aria-label="Your food requirements">
    <div className={styles.heading}><h2>Your food requirements</h2><span>For this order</span></div>
    <p className={styles.note}>Preferences, allergies and dislikes stay separate. Changing them rechecks your cart; it does not silently remove food.</p>
    <fieldset disabled={disabled} className={styles.controls}>
      <label className={styles.field}>Dietary preference
        <select disabled={drafting} data-testid="dietary-preference" value={profile.preference} onChange={event => change([{ type: "SET_DIETARY", preference: event.target.value as DietaryProfile["preference"] }])}>
          <option value="none">No dietary preference</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option>
        </select>
      </label>
      <div className={styles.chips} aria-label="Active requirements">
        {profile.preference !== "none" && <button disabled={drafting} type="button" onClick={() => change([{ type: "SET_DIETARY", preference: "none" }])}>Preference: {profile.preference} ×</button>}
        {profile.allergies.map(allergen => <button disabled={drafting} key={`allergy-${allergen}`} type="button" onClick={() => change([{ type: "REMOVE_ALLERGY", allergen }])}>Allergy: {allergen} ×</button>)}
        {profile.dislikes.map(ingredient => <button disabled={drafting} key={`dislike-${ingredient}`} type="button" onClick={() => change([{ type: "SET_DISLIKE", ingredient, enabled: false }])}>Dislike: {ingredient} ×</button>)}
      </div>
      <div className={styles.forms}>
        <form onSubmit={event => addNamed(event, "allergy")} className={styles.inlineForm}>
          <label>Food allergy<input disabled={drafting && !dirtyFields.has("allergy")} onChange={event => draft("allergy", event.target.value.trim())} name="allergy" list="common-allergens" maxLength={60} placeholder="e.g. sesame, or another allergen" data-testid="allergy-input" /></label>
          <datalist id="common-allergens">{COMMON_ALLERGENS.map(name => <option key={name} value={name} />)}</datalist>
          <button disabled={drafting && !dirtyFields.has("allergy")} type="submit" data-testid="add-allergy">Add allergy</button>
        </form>
        <form onSubmit={event => addNamed(event, "dislike")} className={styles.inlineForm}>
          <label>Disliked ingredient<input disabled={drafting && !dirtyFields.has("dislike")} onChange={event => draft("dislike", event.target.value.trim())} name="dislike" maxLength={60} placeholder="e.g. onions" data-testid="dislike-input" /></label>
          <button disabled={drafting && !dirtyFields.has("dislike")} type="submit" data-testid="add-dislike">Add dislike</button>
        </form>
      </div>
      {drafting && <p className={styles.note} data-testid="requirements-draft">Apply this change, erase it, or <button type="button" data-testid="discard-requirements-draft" onClick={endDraft}>Discard this draft</button>. A new review is required afterward.</p>}
      {profile.allergies.filter(name => /^(nut|nuts)$/i.test(name.trim())).map(name => <div key={name} className={styles.warning} data-testid="nuts-clarification">
        <p>Does “{name}” mean peanuts, tree nuts, or both? The restriction stays active until you clarify.</p>
        <div className={styles.buttons}>{[{ label: "Peanuts", to: ["peanut"] }, { label: "Tree nuts", to: ["tree nuts"] }, { label: "Both", to: ["peanut", "tree nuts"] }].map(choice => <button key={choice.label} disabled={drafting} type="button" onClick={() => change([{ type: "RESOLVE_ALLERGEN", from: name, to: choice.to }])}>{choice.label}</button>)}</div>
      </div>)}
      {profile.dislikes.filter(name => /^(nut|nuts)$/i.test(name.trim())).map(name => <div key={`dislike-${name}`} className={styles.warning} data-testid="nuts-dislike-clarification">
        <p>For your “{name}” dislike, should we exclude peanuts, tree nuts, or both? This is an ingredient preference, not an allergy.</p>
        <div className={styles.buttons}>{[{ label: "Avoid peanuts", to: ["peanut"] }, { label: "Avoid tree nuts", to: ["tree nuts"] }, { label: "Avoid both", to: ["peanut", "tree nuts"] }].map(choice => <button key={choice.label} disabled={drafting} type="button" onClick={() => change([{ type: "SET_DISLIKE", ingredient: name, enabled: false }, ...choice.to.map(ingredient => ({ type: "SET_DISLIKE" as const, ingredient, enabled: true }))])}>{choice.label}</button>)}</div>
      </div>)}
      <label className={styles.mode}><input disabled={drafting} type="checkbox" data-testid="meal-mode" checked={Boolean(meal)} onChange={event => change([{ type: "SET_MEAL_MODE", enabled: event.target.checked }])} /> Build my meal <span>Optional · choose required parts and a budget</span></label>
      {meal && <div className={styles.meal}>
        <p className={styles.mealSummary} data-testid="meal-requirement-summary"><strong>{meal.budgetCents === null ? "No menu budget set" : `Menu budget ${formatCents(meal.budgetCents)}`}</strong><span>{COMPONENTS.filter(component => meal.components.includes(component.id)).map(component => component.label).join(" + ")}</span></p>
        <form onSubmit={setBudget} className={styles.inlineForm}>
          <label>Maximum menu subtotal ($)<input disabled={drafting && !dirtyFields.has("budget")} onChange={event => draft("budget", event.target.value, meal.budgetCents === null ? "" : (meal.budgetCents / 100).toFixed(2))} key={meal.budgetCents ?? "none"} name="budget" inputMode="decimal" defaultValue={meal.budgetCents === null ? "" : (meal.budgetCents / 100).toFixed(2)} placeholder="No limit" data-testid="meal-budget" /></label>
          <button disabled={drafting && !dirtyFields.has("budget")} type="submit" data-testid="apply-budget">Apply budget</button>
        </form>
        <p className={styles.note}>Menu prices only. Tax and fees are not included. You pay per item; this is not a meal-plan exchange.</p>
        <div className={styles.components} role="group" aria-label="Required meal parts">{COMPONENTS.map(component => <label key={component.id}><input type="checkbox" data-testid={`component-${component.id}`} checked={meal.components.includes(component.id)} disabled={drafting || (meal.components.length === 1 && meal.components.includes(component.id))} onChange={event => change([{ type: "SET_COMPONENTS", components: event.target.checked ? [...meal.components, component.id] : meal.components.filter(value => value !== component.id) }])} />{component.label}</label>)}</div>
        {requirements?.remainingCents !== null && requirements?.remainingCents !== undefined && <p data-testid="meal-remaining">{requirements.remainingCents >= 0 ? `${formatCents(requirements.remainingCents)} left in your menu budget` : `${formatCents(-requirements.remainingCents)} over your menu budget`}</p>}
        {meal.selections.length > 0 && <div className={styles.selections} aria-label="Requested meal items">{meal.selections.map(selection => <div key={selection.component}>
          <span>{meal.lockedItemIds.includes(selection.itemId) ? "Keep " : "Requested: "}{MENU[selection.itemId].label}{selection.modifiers.length ? ` · ${selection.modifiers.map(modifier => MODIFIERS[modifier].label).join(", ")}` : ""}</span>
          <button disabled={drafting} type="button" data-testid={`lock-${selection.itemId}`} onClick={() => change([meal.lockedItemIds.includes(selection.itemId) ? { type: "UNLOCK_ITEM", itemId: selection.itemId } : { type: "SELECT_ITEM", itemId: selection.itemId, modifiers: selection.modifiers, locked: true }])}>{meal.lockedItemIds.includes(selection.itemId) ? "Unlock" : "Lock item"}</button>
          <button disabled={drafting} type="button" onClick={() => change([{ type: "CLEAR_SELECTION", component: selection.component }])}>Let the meal builder choose</button>
        </div>)}</div>}
      </div>}
      {profile.exceptions.length > 0 && <div className={styles.warning} aria-label="Explicit preference exceptions">{profile.exceptions.map(exception => <p key={`${exception.itemId}-${exception.modifiers.join()}`}>Exception: {MENU[exception.itemId].label}{exception.modifiers.length ? ` with ${exception.modifiers.map(modifier => MODIFIERS[modifier].label).join(", ")}` : ""}. Allergies still apply. <button disabled={drafting} type="button" onClick={() => change([{ type: "REMOVE_EXCEPTION", itemId: exception.itemId }])}>Remove exception</button></p>)}</div>}
    </fieldset>
    {formNotice && <p role="status">{formNotice}</p>}
    {requirements?.message && <p className={styles.message} data-testid="requirements-message" role="status">{requirements.message}</p>}
    {decision && <div className={styles.decision} data-testid="requirements-decision" role="group" aria-label="Choose how to continue">
      <h3>Your choice</h3><p>{decision.message}</p>
      {proposedTotal !== null && <div className={styles.proposal} data-testid="proposed-meal"><strong>Proposed · not applied</strong><ul>{decision.proposedLines.map(line => <li key={line.lineId}>{line.qty} × {MENU[line.itemId].label}{line.modifiers.length ? ` · ${line.modifiers.map(modifier => MODIFIERS[modifier].label).join(", ")}` : ""}</li>)}</ul><p>Proposed menu subtotal: <strong>{formatCents(proposedTotal)}</strong>. {proposedTotal === acceptedTotalCents ? "Same subtotal as your accepted cart." : `${formatCents(Math.abs(proposedTotal - acceptedTotalCents))} ${proposedTotal > acceptedTotalCents ? "more" : "less"} than your accepted cart (${formatCents(acceptedTotalCents)}).`}</p></div>}
      {decision.minimumCents !== null && <p>Minimum subtotal for this proposed requirement set: {formatCents(decision.minimumCents)}.</p>}
      <div className={styles.buttons}>{decision.choices.map(choice => <button key={choice.id} type="button" disabled={disabled || drafting} data-testid={`requirement-choice-${choice.id}`} onClick={() => onAction({ type: "DECIDE_REQUIREMENTS", pendingId: decision.id, revision: decision.revision, choiceId: choice.id })}>{choice.label}</button>)}</div>
    </div>}
    {issues.length > 0 && <div className={styles.warning} data-testid="cart-requirement-issues"><h3>These cart items need attention</h3>{issues.map(check => {
      const line = lines.find(line => line.lineId === check.lineId);
      return <p key={check.lineId}><strong>{line ? MENU[line.itemId].label : "Cart item"} · {check.status === "unknown" ? "Needs verification" : "Conflicts with requirements"}</strong><br />{check.reasons.join(" ")}</p>;
    })}</div>}
    {(profile.allergies.length > 0 || staffIssues.length > 0) && <details className={styles.staff} data-testid="staff-summary" open={staffIssues.length > 0}>
      <summary>Show a summary to dining staff</summary>
      <p><strong>Please verify these allergies: {profile.allergies.join(", ") || "See item notes below"}.</strong></p>
      {lines.map(line => <p key={line.lineId}>{line.qty} × {MENU[line.itemId].label}{line.modifiers.length ? ` · ${line.modifiers.map(modifier => MODIFIERS[modifier].label).join(", ")}` : ""}</p>)}
      <p>Please check complete ingredients, preparation and cross-contact. No staff member has been contacted. This app cannot guarantee allergy safety or override missing evidence.</p>
      <a href={FOOD_GUIDANCE_URL} target="_blank" rel="noreferrer">FARE: questions about cross-contact</a>
    </details>}
    <p className={styles.note}>Your requirements are held in this browser session. New order clears them. An explicit order-log download includes them; do not share that file unintentionally.</p>
  </section>;
}
