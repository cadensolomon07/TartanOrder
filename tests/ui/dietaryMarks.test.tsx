// @vitest-environment jsdom
// Marks derive only from stored evidence; the catalog here is hand-built so the
// test does not depend on the bundled inference lexicon.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CatalogSchema, type FoodEvidence } from "@/contracts";
import { CatalogProvider } from "@/ui/CatalogContext";
import { Cart } from "@/ui/Cart";
import { DietaryMarks, dietaryMarks } from "@/ui/DietaryMarks";

const ingredient = (id: string, allergens: string[] = [], vegetarian: boolean | null = true, vegan: boolean | null = true) =>
  ({ id, label: id[0].toUpperCase() + id.slice(1), aliases: [], allergens, vegetarian, vegan });
const evidence = (partial: Partial<FoodEvidence> & { kind?: FoodEvidence["provenance"]["kind"] }): FoodEvidence => ({
  completeness: partial.completeness ?? "partial",
  ingredients: partial.ingredients ?? [],
  allergenCoverage: [],
  dietaryClaims: partial.dietaryClaims ?? [],
  preparation: { status: "unknown", allergens: [], explanation: "Preparation unknown." },
  provenance: { kind: partial.kind ?? "inferred_campus", explanation: "Inferred from the published name.", sourceUrl: null, verifiedAt: null },
});

afterEach(cleanup);

describe("dietaryMarks", () => {
  it("reports meat, fish, allergens, claims and unknown evidence separately", () => {
    const meat = dietaryMarks(evidence({ ingredients: [ingredient("beef", [], false, false), ingredient("cheese", ["milk"], true, false), ingredient("bun", ["wheat", "sesame"])] }));
    expect(meat).toMatchObject({ meat: true, fish: false, contains: ["milk", "sesame", "wheat"], claims: [], inferred: true, unknown: false });
    const fish = dietaryMarks(evidence({ ingredients: [ingredient("shrimp", ["shellfish"], false, false)] }));
    expect(fish).toMatchObject({ meat: false, fish: true, contains: ["shellfish"] });
    const vegan = dietaryMarks(evidence({ dietaryClaims: ["vegetarian", "vegan"], kind: "fictional_demo" }));
    expect(vegan).toMatchObject({ claims: ["vegan"], inferred: false });
    expect(dietaryMarks(evidence({ completeness: "unknown", kind: "unverified_campus" }))).toMatchObject({ unknown: true, contains: [], meat: false, fish: false });
  });

  it("renders pills in order with the inferred suffix only for inferred campus evidence", () => {
    render(<DietaryMarks evidence={evidence({ dietaryClaims: ["vegetarian"], ingredients: [ingredient("cheese", ["milk"], true, false)] })} />);
    let marks = screen.getAllByTestId("dietary-mark");
    expect(marks.map((mark) => mark.getAttribute("data-kind"))).toEqual(["claim-vegetarian", "contains"]);
    expect(marks[0].textContent).toBe("Vegetarian · from menu wording");
    expect(marks[1].textContent).toBe("Contains: milk");
    cleanup();
    render(<DietaryMarks evidence={evidence({ ingredients: [ingredient("beef", [], false, false), ingredient("shrimp", ["shellfish"], false, false), ingredient("mayo", ["egg"], true, false)], kind: "fictional_demo" })} />);
    marks = screen.getAllByTestId("dietary-mark");
    expect(marks.map((mark) => mark.getAttribute("data-kind"))).toEqual(["meat", "fish", "contains"]);
    expect(marks.map((mark) => mark.textContent)).toEqual(["Contains meat", "Contains fish or shellfish", "Contains: egg"]);
    cleanup();
    render(<DietaryMarks evidence={evidence({ completeness: "unknown", kind: "unverified_campus" })} />);
    expect(screen.getByTestId("dietary-mark").textContent).toBe("Ingredients not listed");
  });
});

const catalog = CatalogSchema.parse({
  versionId: "test-marks",
  snapshot: { checkedAt: "2026-09-12", directoryUrl: "https://api.cmueats.com/v2/locations", sourceRepository: "https://github.com/ScottyLabs/dining-api" },
  locations: [{ id: "188", name: "Stack'd Underground", location: "Morewood", menuUrl: null, directoryMenuUrl: null, detailUrl: null, sourceSha256: null, sourceNote: null, activeRank: 1 }],
  modifiers: [
    { id: "no_cheese", label: "No cheese", priceCents: 0, effect: { remove: ["cheese"], add: [] } },
    { id: "no_bacon", label: "No bacon", priceCents: 0, effect: { remove: ["bacon"], add: [] } },
  ],
  items: [{
    id: "cmu_188_bacon_cheeseburger", locationId: "188", label: "Bacon Cheeseburger", category: "mains", description: "Beef patty with bacon and cheddar on a bun.",
    priceCents: 1050, aliases: ["bacon cheeseburger"], allowedModifiers: ["no_cheese", "no_bacon"], sourcePage: 1,
    foodEvidence: evidence({ ingredients: [ingredient("beef", [], false, false), ingredient("bacon", [], false, false), ingredient("cheese", ["milk"], true, false), ingredient("bun", ["wheat"])] }),
  }],
  previews: [],
});

describe("cart marks follow ingredient modifications", () => {
  it("offers the generated removal toggles and recomputes the marks for the configured line", () => {
    const onOps = vi.fn();
    const line = { lineId: "l1", itemId: "cmu_188_bacon_cheeseburger", qty: 1, modifiers: [] as string[] };
    const { rerender } = render(<CatalogProvider catalog={catalog} source="bundled"><Cart lines={[line]} lastLineId={null} changed={new Set()} editable onOps={onOps} /></CatalogProvider>);
    const row = within(screen.getByTestId("line-l1"));
    expect(row.getByRole("button", { name: "No cheese" })).toBeTruthy();
    expect(row.getByRole("button", { name: "No bacon" })).toBeTruthy();
    expect(within(row.getByTestId("line-marks")).getAllByTestId("dietary-mark").map((mark) => mark.textContent)).toEqual(["Contains meat", "Contains: milk, wheat"]);
    fireEvent.click(row.getByRole("button", { name: "No cheese" }));
    expect(onOps).toHaveBeenLastCalledWith([{ type: "MOD", ref: { by: "line", lineId: "l1" }, modifier: "no_cheese", enabled: true }]);
    rerender(<CatalogProvider catalog={catalog} source="bundled"><Cart lines={[{ ...line, modifiers: ["no_cheese"] }]} lastLineId={null} changed={new Set()} editable onOps={onOps} /></CatalogProvider>);
    expect(within(screen.getByTestId("line-marks")).getAllByTestId("dietary-mark").map((mark) => mark.textContent)).toEqual(["Contains meat", "Contains: wheat"]);
  });
});
