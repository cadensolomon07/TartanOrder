// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import type { DietaryProfile, RequirementsState } from "@/contracts";
import { RequirementsPanel } from "@/ui/RequirementsPanel";
import { MenuButtons } from "@/ui/MenuButtons";
import { Kiosk } from "@/ui/Kiosk";
import { createOrderController } from "@/controller/controller";

const profile = (changes: Partial<DietaryProfile> = {}): DietaryProfile => ({ preference: "none", allergies: [], dislikes: [], exceptions: [], ...changes });
const state = (changes: Partial<RequirementsState> = {}): RequirementsState => ({ locationId: "demo", meal: null, profile: profile(), decision: null, checks: [], message: null, remainingCents: null, solver: null, ...changes });
afterEach(cleanup);

describe("persistent requirements controls", () => {
  it("dispatches distinct preference, allergy and dislike changes", () => {
    const onAction = vi.fn();
    render(<RequirementsPanel acceptedTotalCents={1200} locationId="demo" lines={[]} disabled={false} onAction={onAction} />);
    fireEvent.change(screen.getByTestId("dietary-preference"), { target: { value: "vegan" } });
    expect(onAction).toHaveBeenLastCalledWith({ type: "REQUIREMENTS", locationId: "demo", changes: [{ type: "SET_DIETARY", preference: "vegan" }] });
    fireEvent.change(screen.getByTestId("allergy-input"), { target: { value: "sesame" } });
    fireEvent.click(screen.getByTestId("add-allergy"));
    expect(onAction).toHaveBeenLastCalledWith({ type: "REQUIREMENTS", locationId: "demo", changes: [{ type: "ADD_ALLERGY", allergen: "sesame" }] });
    fireEvent.change(screen.getByTestId("dislike-input"), { target: { value: "onions" } });
    fireEvent.click(screen.getByTestId("add-dislike"));
    expect(onAction).toHaveBeenLastCalledWith({ type: "REQUIREMENTS", locationId: "demo", changes: [{ type: "SET_DISLIKE", ingredient: "onions", enabled: true }] });
  });
  it("keeps ambiguous nuts visible until an explicit resolution", () => {
    const onAction = vi.fn();
    render(<RequirementsPanel acceptedTotalCents={1200} locationId="demo" requirements={state({ profile: profile({ allergies: ["nuts"] }) })} lines={[]} disabled={false} onAction={onAction} />);
    expect(screen.getByRole("button", { name: "Allergy: nuts ×" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Both" }));
    expect(onAction).toHaveBeenCalledWith({ type: "REQUIREMENTS", locationId: "demo", changes: [{ type: "RESOLVE_ALLERGEN", from: "nuts", to: ["peanut", "tree nuts"] }] });
    expect(screen.getByTestId("staff-summary").textContent).toContain("No staff member has been contacted");
    expect(screen.queryByRole("button", { name: /override|send to staff/i })).toBeNull();
  });
  it("converts a decimal budget exactly and rejects fractional cents", () => {
    const onAction = vi.fn();
    const requirements = state({ meal: { locationId: "demo", budgetCents: 1200, components: ["mains", "sides", "drinks"], selections: [], lockedItemIds: [] } });
    render(<RequirementsPanel acceptedTotalCents={1200} locationId="demo" requirements={requirements} lines={[]} disabled={false} onAction={onAction} />);
    fireEvent.change(screen.getByTestId("meal-budget"), { target: { value: "12.35" } });
    fireEvent.click(screen.getByTestId("apply-budget"));
    expect(onAction).toHaveBeenLastCalledWith({ type: "REQUIREMENTS", locationId: "demo", changes: [{ type: "SET_BUDGET", budgetCents: 1235 }] });
    onAction.mockClear();
    fireEvent.change(screen.getByTestId("meal-budget"), { target: { value: "12.355" } });
    fireEvent.click(screen.getByTestId("apply-budget"));
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("two decimal places");
  });
  it("dispatches a revision-bound decision and exposes blocking cart notes", () => {
    const onAction = vi.fn();
    const requirements = state({
      profile: profile({ allergies: ["sesame"] }),
      checks: [{ lineId: "line1", status: "conflict", reasons: ["Declared sesame."], staffReview: true, source: "Fictional recipe" }],
      decision: { id: "decision1", revision: 8, kind: "budget", message: "Keep the meal or raise the budget?", proposedMeal: null, proposedLines: [{ lineId: "p1", itemId: "chicken_sandwich", qty: 1, modifiers: [] }, { lineId: "p2", itemId: "fries", qty: 1, modifiers: [] }, { lineId: "p3", itemId: "lemonade", qty: 1, modifiers: [] }], minimumCents: 1400, choices: [{ id: "keep", label: "Keep my meal" }] },
    });
    render(<RequirementsPanel acceptedTotalCents={1200} locationId="demo" requirements={requirements} lines={[{ lineId: "line1", itemId: "burger", qty: 1, modifiers: [] }]} disabled={false} onAction={onAction} />);
    fireEvent.click(screen.getByTestId("requirement-choice-keep"));
    expect(onAction).toHaveBeenCalledWith({ type: "DECIDE_REQUIREMENTS", pendingId: "decision1", revision: 8, choiceId: "keep" });
    expect(screen.getByTestId("cart-requirement-issues").textContent).toContain("Burger");
    expect(screen.getByTestId("proposed-meal").textContent).toContain("$14.00");
    expect(screen.getByTestId("proposed-meal").textContent).toContain("$2.00 more than your accepted cart ($12.00)");
    expect((screen.getByTestId("staff-summary") as HTMLDetailsElement).open).toBe(true);
  });
});

describe("evidence-based menu inspection", () => {
  it("separates vegan matches from conflicts while allowing an explicit preference choice", () => {
    const onOps = vi.fn();
    render(<MenuButtons locationId="demo" disabled={false} onOps={onOps} profile={profile({ preference: "vegan" })} />);
    expect(screen.getByTestId("compatibility-veggie_wrap").textContent).toContain("Matches recorded requirements");
    expect(screen.getByTestId("excluded-menu").contains(screen.getByTestId("menu-burger"))).toBe(true);
    fireEvent.click(screen.getByTestId("menu-burger"));
    expect(onOps).toHaveBeenCalledWith([{ type: "ADD", itemId: "burger", qty: 1, modifiers: [] }]);
  });
  it("blocks allergy conflicts and unknown preparation without hiding the evidence", () => {
    const onOps = vi.fn();
    render(<MenuButtons locationId="demo" disabled={false} onOps={onOps} profile={profile({ allergies: ["peanut"] })} />);
    for (const id of ["onion_rings", "side_salad"]) {
      const button = screen.getByTestId(`menu-${id}`) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(onOps).not.toHaveBeenCalled();
    expect(screen.getByTestId("compatibility-side_salad").textContent).toContain("Needs verification");
  });
  it("uses a meal selection callback without dispatching an ordinary ADD", () => {
    const onOps = vi.fn();
    const onMealItem = vi.fn();
    render(<MenuButtons locationId="demo" disabled={false} onOps={onOps} onMealItem={onMealItem} />);
    fireEvent.click(screen.getByTestId("menu-veggie_wrap"));
    expect(onMealItem).toHaveBeenCalledWith("veggie_wrap");
    expect(onOps).not.toHaveBeenCalled();
  });
});

describe("requirement drafts with the real controller (no microphone or provider)", () => {
  function mountStore(store: ReturnType<typeof createOrderController>) {
    function Host() { return <Kiosk controller={useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)} />; }
    return render(<Host />);
  }
  it("invalidates review on the first requirement keystroke and holds capture until discarded", () => {
    const store = createOrderController({ sessionId: () => "requirement-input-test" });
    store.getSnapshot().act({ type: "MANUAL", ops: [{ type: "ADD", itemId: "fries", qty: 1, modifiers: [] }] });
    store.getSnapshot().act({ type: "REVIEW" });
    const review = store.getSnapshot().state.review!;
    mountStore(store);
    expect(screen.getByTestId("confirm")).toBeTruthy();
    fireEvent.change(screen.getByTestId("allergy-input"), { target: { value: "se" } });
    expect(store.getSnapshot().busy).toBe(true);
    expect(store.getSnapshot().state.review).toBeNull();
    expect(screen.queryByTestId("confirm")).toBeNull();
    fireEvent.change(screen.getByTestId("allergy-input"), { target: { value: "sesame" } });
    expect((screen.getByTestId("allergy-input") as HTMLInputElement).value).toBe("sesame");
    act(() => store.getSnapshot().act({ type: "CONFIRM", reviewId: review.id, revision: review.revision }));
    expect(store.getSnapshot().state.receipt).toBeNull();
    fireEvent.click(screen.getByTestId("discard-requirements-draft"));
    expect(store.getSnapshot().busy).toBe(false);
    expect(store.getSnapshot().state.review).toBeNull();
    expect((screen.getByTestId("allergy-input") as HTMLInputElement).value).toBe("");
    store.dispose();
  });
  it("discards a budget draft when typing elsewhere, and cannot release the new input owner", () => {
    const store = createOrderController({ sessionId: () => "input-owner-test" });
    store.getSnapshot().act({ type: "REQUIREMENTS", locationId: "demo", changes: [{ type: "SET_BUDGET", budgetCents: 1200 }] });
    mountStore(store);
    fireEvent.change(screen.getByTestId("meal-budget"), { target: { value: "13" } });
    expect(store.getSnapshot().busy).toBe(true);
    expect(screen.getByTestId("requirements-draft")).toBeTruthy();
    fireEvent.change(screen.getByTestId("text-input"), { target: { value: "a burger" } });
    expect(store.getSnapshot().busy).toBe(true);
    expect(screen.queryByTestId("requirements-draft")).toBeNull();
    expect((screen.getByTestId("meal-budget") as HTMLInputElement).value).toBe("12.00");
    expect(store.getSnapshot().state.requirements?.meal?.budgetCents).toBe(1200);
    fireEvent.click(screen.getByTestId("discard"));
    expect(store.getSnapshot().busy).toBe(false);
    fireEvent.change(screen.getByTestId("meal-budget"), { target: { value: "14" } });
    fireEvent.click(screen.getByTestId("apply-budget"));
    expect(store.getSnapshot().busy).toBe(false);
    expect(store.getSnapshot().state.requirements?.meal?.budgetCents).toBe(1400);
    store.dispose();
  });
});
