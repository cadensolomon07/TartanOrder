// @vitest-environment jsdom
// UI-only preview fixtures over a modified Catalog value. They do not represent
// parser or live menu evidence; the catalog is data, so the test builds its own.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CatalogSchema } from "@/contracts";
import { DiningLocation } from "@/ui/DiningLocation";
import { MenuButtons } from "@/ui/MenuButtons";
import { CATALOG } from "../helpers/catalog";
import { withCatalog } from "./withCatalog";

const preview = (locationId: string, label: string, description: string, priceCents: number | null = null) => ({
  locationId, label, description, priceCents, sourceUrl: null, sourcePage: null, sourceSha256: null,
});
const catalog = CatalogSchema.parse({
  ...CATALOG,
  locations: CATALOG.locations.map((location) => location.id === "110" ? { ...location, sourceNote: "Supplied CMU-hosted snapshot; current pricing unverified." } : location),
  previews: [
    preview("188", "Unresolved bowl", "Includes a side; choices need confirmation.", 1095),
    preview("188", "Rotating side", "Current price is not verified."),
    preview("188", "Missing price placeholder", "Do not display an invented free item.", 0),
    preview("113", "The Good Egg", "Item name only; price unverified."),
  ],
});
const mount = (node: React.ReactNode) => render(withCatalog(node, "bundled", catalog));

afterEach(cleanup);

describe("consolidated public catalog", () => {
  it("preserves the eleven requested locations and separates the explicit fictional demo", () => {
    const onChange = vi.fn();
    mount(<DiningLocation locationId="110" onChange={onChange} />);
    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    expect(options.map(option => option.value)).toEqual(["110", "92", "174", "82", "188", "179", "113", "114", "155", "109", "108", "demo"]);
    expect(screen.queryByRole("option", { name: /La Prima|El Gallo/ })).toBeNull();
    expect(screen.getByRole("group", { name: "Fictional meal demo" })).toBeTruthy();
    fireEvent.change(screen.getByTestId("dining-location"), { target: { value: "82" } });
    expect(onChange).toHaveBeenCalledWith("82");
  });

  it("shows the supplied-snapshot source note without claiming current menu linkage", () => {
    mount(<DiningLocation locationId="110" onChange={vi.fn()} />);
    expect(screen.getByTestId("menu-source-note").textContent).toContain("Supplied CMU-hosted snapshot");
    expect(screen.getByTestId("price-source").textContent).not.toContain("current prices");
    expect(screen.getByTestId("price-source").textContent).toContain(`Checked ${catalog.snapshot.checkedAt}`);
  });

  it("shows known and unknown preview prices without Add handlers or zero-price ordering", () => {
    const onOps = vi.fn();
    mount(<MenuButtons locationId="188" disabled={false} onOps={onOps} />);
    const previews = within(screen.getByRole("group", { name: "Menu preview" }));
    const known = previews.getByRole("button", { name: /Unresolved bowl/ }) as HTMLButtonElement;
    expect(known.disabled).toBe(true);
    expect(known.textContent).toContain("Published menu price: $10.95 · Ordering unavailable");
    const unknown = previews.getByRole("button", { name: /Rotating side/ }) as HTMLButtonElement;
    expect(unknown.disabled).toBe(true);
    expect(unknown.textContent).toContain("Price unavailable");
    expect(previews.getByRole("button", { name: /Missing price placeholder/ }).textContent).toContain("Price unavailable");
    expect(screen.queryByText("$0.00")).toBeNull();
    fireEvent.click(known);
    fireEvent.click(unknown);
    expect(onOps).not.toHaveBeenCalled();
  });

  it("searches priced aliases and unavailable preview names", () => {
    mount(<MenuButtons locationId="188" disabled={false} onOps={vi.fn()} />);
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "smashd burger" } });
    expect(screen.getByTestId("menu-cmu_188_smash_d_burger")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Menu preview" })).toBeNull();
    fireEvent.change(search, { target: { value: "unresolved" } });
    expect(screen.getByRole("button", { name: /Unresolved bowl/ })).toBeTruthy();
    expect(screen.queryByTestId("menu-cmu_188_smash_d_burger")).toBeNull();
    fireEvent.change(search, { target: { value: "no matching item zzz" } });
    expect(screen.getByText("No matching menu items. Try another name.")).toBeTruthy();
  });

  it("keeps preview-only menus searchable and disables every listed item", () => {
    const onOps = vi.fn();
    mount(<MenuButtons locationId="113" disabled={false} onOps={onOps} />);
    expect(screen.getByRole("searchbox")).toBeTruthy();
    const egg = screen.getByRole("button", { name: /The Good Egg/ }) as HTMLButtonElement;
    expect(egg.disabled).toBe(true);
    expect(egg.textContent).toContain("Price unavailable");
    fireEvent.click(egg);
    expect(onOps).not.toHaveBeenCalled();
  });

  it("scopes dietary matches and exclusions to the chosen menu category", () => {
    mount(<MenuButtons locationId="demo" filter="sides" disabled={false} onOps={vi.fn()} profile={{ preference: "vegan", allergies: [], dislikes: [], exceptions: [] }} />);
    expect(screen.getByTestId("menu-match-count").textContent).toContain("2 choices match");
    expect(screen.getByTestId("excluded-menu").textContent).toContain("Inspect 1 conflicting");
    expect(screen.getByTestId("compatibility-onion_rings").textContent).toContain("milk");
    expect(screen.queryByTestId("menu-burger")).toBeNull();
    expect(screen.queryByTestId("menu-water")).toBeNull();
  });

  it("retains actual priced ADD actions and the internal no-argument Demo fixture", () => {
    const onOps = vi.fn();
    const { rerender } = mount(<MenuButtons locationId="188" disabled={false} onOps={onOps} />);
    fireEvent.click(screen.getByTestId("menu-cmu_188_smash_d_burger"));
    expect(onOps).toHaveBeenLastCalledWith([{ type: "ADD", itemId: "cmu_188_smash_d_burger", qty: 1, modifiers: [] }]);
    rerender(withCatalog(<MenuButtons disabled={false} onOps={onOps} />, "bundled", catalog));
    fireEvent.click(screen.getByTestId("menu-burger"));
    expect(onOps).toHaveBeenLastCalledWith([{ type: "ADD", itemId: "burger", qty: 1, modifiers: [] }]);
  });
});
