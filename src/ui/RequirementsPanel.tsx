"use client";
import { T } from "./Language";
import { useRef, useState, type FormEvent } from "react";
import type { DietaryProfile, Line, LocationId, MealComponent, RequirementChange, RequirementsState, UiAction } from "@/contracts";
import { COMMON_ALLERGENS, FOOD_GUIDANCE_URL } from "@/contracts/food";
import { MENU, MODIFIERS } from "@/contracts/menu";
import { totalCents } from "@/core/engine";
import { formatCents } from "./labels";
import styles from "./RequirementsPanel.module.css";
import { ItemNote } from "./ItemNote";

const EMPTY_PROFILE: DietaryProfile = { preference: "none", allergies: [], dislikes: [], exceptions: [] };
const COMPONENTS: { id: MealComponent; label: string }[] = [{ id: "mains", label: "Main" }, { id: "sides", label: "Side" }, { id: "drinks", label: "Drink" }];

export function RequirementsSummary({ requirements }: { requirements?: RequirementsState }) {
  if (!requirements) return null;
  const { meal, profile } = requirements;
  if (!meal && profile.preference === "none" && !profile.allergies.length && !profile.dislikes.length) return null;
  return <section className={styles.summaryPanel} data-testid="requirements-summary" aria-label="Requirements for this cart">
    <div className={styles.heading}><h2><T>For this cart</T></h2><a href="#food-requirements"><T>Edit requirements</T></a></div>
    <div className={styles.summaryChips}>
      <T>{meal && <><span><T>{meal.budgetCents === null ? "No menu budget" : `Menu budget ${formatCents(meal.budgetCents)}`}</T></span><span><T>{COMPONENTS.filter(component => meal.components.includes(component.id)).map(component => component.label).join(" + ")}</T></span><T>{meal.lockedItemIds.map(id => <span key={id}><T>Keep {MENU[id].label}</T></span>)}</T></>}</T>
      <T>{profile.preference !== "none" && <span><T>Preference: {profile.preference}</T></span>}</T>
      <T>{profile.allergies.map(name => <span className={styles.allergyChip} key={`allergy-${name}`}><T>Allergy: {name}</T></span>)}</T>
      <T>{profile.dislikes.map(name => <span key={`dislike-${name}`}><T>Dislike: {name}</T></span>)}</T>
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
    <div className={styles.heading}><h2><T>Your food requirements</T></h2><span><T>For this order</T></span></div>
    <p className={styles.note}><T>Preferences, allergies and dislikes stay separate. Changing them rechecks your cart; it does not silently remove food.</T></p>
    {decision && <div className={styles.decision} data-testid="requirements-decision" role="group" aria-label="Choose how to continue">
      <h3><T>Your choice</T></h3><p><T>{decision.message}</T></p>
      {proposedTotal !== null && <div className={styles.proposal} data-testid="proposed-meal"><strong><T>Proposed · not applied</T></strong><ul>{decision.proposedLines.map(line => <li key={line.lineId}><T>{line.qty}</T> × <T>{MENU[line.itemId].label}{line.modifiers.length ? ` · ${line.modifiers.map(modifier => MODIFIERS[modifier].label).join(", ")}` : ""}</T><ItemNote note={line.note} /></li>)}</ul><p><T>Proposed menu subtotal: </T><strong><T>{formatCents(proposedTotal)}</T></strong>. <T>{proposedTotal === acceptedTotalCents ? "Same subtotal as your accepted cart." : `${formatCents(Math.abs(proposedTotal - acceptedTotalCents))} ${proposedTotal > acceptedTotalCents ? "more" : "less"} than your accepted cart (${formatCents(acceptedTotalCents)}).`}</T></p></div>}
      <T>{decision.minimumCents !== null && <p><T>Minimum subtotal for this proposed requirement set: {formatCents(decision.minimumCents)}</T>.</p>}</T>
      <div className={styles.buttons}>{decision.choices.map(choice => <button key={choice.id} type="button" disabled={disabled || drafting} data-testid={`requirement-choice-${choice.id}`} onClick={() => onAction({ type: "DECIDE_REQUIREMENTS", pendingId: decision.id, revision: decision.revision, choiceId: choice.id })}><T>{choice.label}</T></button>)}</div>
    </div>}
    <fieldset disabled={disabled} className={styles.controls}>
      <div className={styles.preferenceRow}>
      <label className={styles.field}><T>Dietary preference
        </T><select disabled={drafting} data-testid="dietary-preference" value={profile.preference} onChange={event => change([{ type: "SET_DIETARY", preference: event.target.value as DietaryProfile["preference"] }])}>
          <option value="none"><T>No dietary preference</T></option><option value="vegetarian"><T>Vegetarian</T></option><option value="vegan"><T>Vegan</T></option>
        </select>
      </label>
      <div className={styles.chips} aria-label="Active requirements">
        {profile.preference !== "none" && <button disabled={drafting} type="button" onClick={() => change([{ type: "SET_DIETARY", preference: "none" }])}><T>Preference: {profile.preference}</T> ×</button>}
        {profile.allergies.map(allergen => <button className={styles.allergyChip} disabled={drafting} key={`allergy-${allergen}`} type="button" onClick={() => change([{ type: "REMOVE_ALLERGY", allergen }])}><T>Allergy: {allergen}</T> ×</button>)}
        {profile.dislikes.map(ingredient => <button disabled={drafting} key={`dislike-${ingredient}`} type="button" onClick={() => change([{ type: "SET_DISLIKE", ingredient, enabled: false }])}><T>Dislike: {ingredient}</T> ×</button>)}
      </div>
      </div>
      <div className={styles.forms}>
        <form onSubmit={event => addNamed(event, "allergy")} className={styles.inlineForm}>
          <label><T>Food allergy</T><input disabled={drafting && !dirtyFields.has("allergy")} onChange={event => draft("allergy", event.target.value.trim())} name="allergy" list="common-allergens" maxLength={60} placeholder="e.g. sesame, or another allergen" data-testid="allergy-input" /></label>
          <datalist id="common-allergens"><T>{COMMON_ALLERGENS.map(name => <option key={name} value={name} />)}</T></datalist>
          <button disabled={drafting && !dirtyFields.has("allergy")} type="submit" data-testid="add-allergy"><T>Add allergy</T></button>
        </form>
        <form onSubmit={event => addNamed(event, "dislike")} className={styles.inlineForm}>
          <label><T>Disliked ingredient</T><input disabled={drafting && !dirtyFields.has("dislike")} onChange={event => draft("dislike", event.target.value.trim())} name="dislike" maxLength={60} placeholder="e.g. onions" data-testid="dislike-input" /></label>
          <button disabled={drafting && !dirtyFields.has("dislike")} type="submit" data-testid="add-dislike"><T>Add dislike</T></button>
        </form>
      </div>
      {drafting && <p className={styles.draftNote} data-testid="requirements-draft"><T>Apply this change, erase it, or </T><button type="button" data-testid="discard-requirements-draft" onClick={endDraft}><T>Discard this draft</T></button><T>. A new review is required afterward.</T></p>}
      {profile.allergies.filter(name => /^(nut|nuts)$/i.test(name.trim())).map(name => <div key={name} className={styles.warning} data-testid="nuts-clarification">
        <p><T>Does “{name}” mean peanuts, tree nuts, or both? The restriction stays active until you clarify.</T></p>
        <div className={styles.buttons}>{[{ label: "Peanuts", to: ["peanut"] }, { label: "Tree nuts", to: ["tree nuts"] }, { label: "Both", to: ["peanut", "tree nuts"] }].map(choice => <button key={choice.label} disabled={drafting} type="button" onClick={() => change([{ type: "RESOLVE_ALLERGEN", from: name, to: choice.to }])}><T>{choice.label}</T></button>)}</div>
      </div>)}
      {profile.dislikes.filter(name => /^(nut|nuts)$/i.test(name.trim())).map(name => <div key={`dislike-${name}`} className={styles.warning} data-testid="nuts-dislike-clarification">
        <p><T>For your “{name}” dislike, should we exclude peanuts, tree nuts, or both? This is an ingredient preference, not an allergy.</T></p>
        <div className={styles.buttons}>{[{ label: "Avoid peanuts", to: ["peanut"] }, { label: "Avoid tree nuts", to: ["tree nuts"] }, { label: "Avoid both", to: ["peanut", "tree nuts"] }].map(choice => <button key={choice.label} disabled={drafting} type="button" onClick={() => change([{ type: "SET_DISLIKE", ingredient: name, enabled: false }, ...choice.to.map(ingredient => ({ type: "SET_DISLIKE" as const, ingredient, enabled: true }))])}><T>{choice.label}</T></button>)}</div>
      </div>)}
      <label className={styles.mode}><input disabled={drafting} type="checkbox" data-testid="meal-mode" checked={Boolean(meal)} onChange={event => change([{ type: "SET_MEAL_MODE", enabled: event.target.checked }])} /><T> Build my meal </T><span><T>Optional · choose required parts and a budget</T></span></label>
      {meal && <div className={styles.meal}>
        <p className={styles.mealSummary} data-testid="meal-requirement-summary"><strong><T>{meal.budgetCents === null ? "No menu budget set" : `Menu budget ${formatCents(meal.budgetCents)}`}</T></strong><span><T>{COMPONENTS.filter(component => meal.components.includes(component.id)).map(component => component.label).join(" + ")}</T></span></p>
        <div className={styles.mealControls}>
        <form onSubmit={setBudget} className={styles.inlineForm}>
          <label><T>Maximum menu subtotal ($)</T><input disabled={drafting && !dirtyFields.has("budget")} onChange={event => draft("budget", event.target.value, meal.budgetCents === null ? "" : (meal.budgetCents / 100).toFixed(2))} key={meal.budgetCents ?? "none"} name="budget" inputMode="decimal" defaultValue={meal.budgetCents === null ? "" : (meal.budgetCents / 100).toFixed(2)} placeholder="No limit" data-testid="meal-budget" /></label>
          <button disabled={drafting && !dirtyFields.has("budget")} type="submit" data-testid="apply-budget"><T>Apply budget</T></button>
        </form>
        <div className={styles.componentField}><span className={styles.fieldLabel}><T>Required meal parts</T></span><div className={styles.components} role="group" aria-label="Required meal parts">{COMPONENTS.map(component => <label key={component.id}><input type="checkbox" data-testid={`component-${component.id}`} checked={meal.components.includes(component.id)} disabled={drafting || (meal.components.length === 1 && meal.components.includes(component.id))} onChange={event => change([{ type: "SET_COMPONENTS", components: event.target.checked ? [...meal.components, component.id] : meal.components.filter(value => value !== component.id) }])} /><T>{component.label}</T></label>)}</div></div>
        </div>
        <p className={styles.note}><T>Menu prices only. Tax and fees are not included. You pay per item; this is not a meal-plan exchange.</T></p>
        <T>{requirements?.remainingCents !== null && requirements?.remainingCents !== undefined && <p className={styles.remaining} data-testid="meal-remaining"><T>{requirements.remainingCents >= 0 ? `${formatCents(requirements.remainingCents)} left in your menu budget` : `${formatCents(-requirements.remainingCents)} over your menu budget`}</T></p>}</T>
        {meal.selections.length > 0 && <div className={styles.selections} aria-label="Requested meal items">{meal.selections.map(selection => <div key={selection.component}>
          <span><T>{meal.lockedItemIds.includes(selection.itemId) ? "Keep " : "Requested: "}{MENU[selection.itemId].label}{selection.modifiers.length ? ` · ${selection.modifiers.map(modifier => MODIFIERS[modifier].label).join(", ")}` : ""}</T></span>
          <button disabled={drafting} type="button" data-testid={`lock-${selection.itemId}`} onClick={() => change([meal.lockedItemIds.includes(selection.itemId) ? { type: "UNLOCK_ITEM", itemId: selection.itemId } : { type: "SELECT_ITEM", itemId: selection.itemId, modifiers: selection.modifiers, locked: true }])}><T>{meal.lockedItemIds.includes(selection.itemId) ? "Unlock" : "Lock item"}</T></button>
          <button disabled={drafting} type="button" onClick={() => change([{ type: "CLEAR_SELECTION", component: selection.component }])}><T>Let the meal builder choose</T></button>
        </div>)}</div>}
      </div>}
      {profile.exceptions.length > 0 && <div className={styles.warning} aria-label="Explicit preference exceptions">{profile.exceptions.map(exception => <p key={`${exception.itemId}-${exception.modifiers.join()}`}><T>Exception: {MENU[exception.itemId].label}{exception.modifiers.length ? ` with ${exception.modifiers.map(modifier => MODIFIERS[modifier].label).join(", ")}` : ""}. Allergies still apply. </T><button disabled={drafting} type="button" onClick={() => change([{ type: "REMOVE_EXCEPTION", itemId: exception.itemId }])}><T>Remove exception</T></button></p>)}</div>}
    </fieldset>
    <T>{formNotice && <p role="status"><T>{formNotice}</T></p>}</T>
    <T>{requirements?.message && !decision && <p className={styles.message} data-testid="requirements-message" role="status"><T>{requirements.message}</T></p>}</T>
    <T>{issues.length > 0 && <div className={styles.warning} data-testid="cart-requirement-issues"><h3><T>These cart items need attention</T></h3><T>{issues.map(check => {
      const line = lines.find(line => line.lineId === check.lineId);
      return <p key={check.lineId}><strong><T>{line ? MENU[line.itemId].label : "Cart item"}</T> · <T>{check.status === "unknown" ? "Needs verification" : "Conflicts with requirements"}</T></strong><br /><T>{check.reasons.join(" ")}</T></p>;
    })}</T></div>}</T>
    {(profile.allergies.length > 0 || staffIssues.length > 0) && <details className={styles.staff} data-testid="staff-summary" open={staffIssues.length > 0}>
      <summary><T>Show a summary to dining staff</T></summary>
      <p><strong><T>Please verify these allergies: </T>{profile.allergies.join(", ") || "See item notes below"}.</strong></p>
      {lines.map(line => <p key={line.lineId}><T>{line.qty}</T> × <T>{MENU[line.itemId].label}{line.modifiers.length ? ` · ${line.modifiers.map(modifier => MODIFIERS[modifier].label).join(", ")}` : ""}</T><ItemNote note={line.note} /></p>)}
      <p><T>Please check complete ingredients, preparation and cross-contact. No staff member has been contacted. This app cannot guarantee allergy safety or override missing evidence.</T></p>
      <a href={FOOD_GUIDANCE_URL} target="_blank" rel="noreferrer"><T>FARE: questions about cross-contact</T></a>
    </details>}
    <p className={styles.privacyNote}><T>Your requirements are held in this browser session. New order clears them. An explicit order-log download includes them; do not share that file unintentionally.</T></p>
  </section>;
}
