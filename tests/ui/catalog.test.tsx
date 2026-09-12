// @vitest-environment jsdom
// UI-only preview fixtures. They do not represent parser or live menu evidence.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DiningLocation } from "@/ui/DiningLocation";
import { MenuButtons } from "@/ui/MenuButtons";

vi.mock("@/contracts/campus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contracts/campus")>();
  return { ...actual,
    ACTIVE_DINING_LOCATIONS: actual.ACTIVE_DINING_LOCATIONS.map(location => location.id === "110" ? { ...location, sourceNote: "Supplied CMU-hosted snapshot; current pricing unverified." } : location),
    UNPRICED_MENU_ITEMS: [
      { locationId: "188", label: "Unresolved bowl", description: "Includes a side; choices need confirmation.", priceCents: 1095 },
      { locationId: "188", label: "Rotating side", description: "Current price is not verified." },
      { locationId: "188", label: "Missing price placeholder", description: "Do not display an invented free item.", priceCents: 0 },
      { locationId: "113", label: "The Good Egg", description: "Item name only; price unverified." },
    ],
  };
});

afterEach(cleanup);

describe("consolidated public catalog", () => {
  it("shows exactly the eleven requested locations in order, without Demo or archive entries", () => {
    const onChange = vi.fn();
    render(<DiningLocation locationId="110" onChange={onChange} />);
    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    expect(options.map(option => option.value)).toEqual(["110", "92", "174", "82", "188", "179", "113", "114", "155", "109", "108"]);
    expect(screen.queryByRole("option", { name: /Demo Counter|La Prima|El Gallo/ })).toBeNull();
    fireEvent.change(screen.getByTestId("dining-location"), { target: { value: "82" } });
    expect(onChange).toHaveBeenCalledWith("82");
  });

  it("shows the supplied-snapshot source note without claiming current menu linkage", () => {
    render(<DiningLocation locationId="110" onChange={vi.fn()} />);
    expect(screen.getByTestId("menu-source-note").textContent).toContain("Supplied CMU-hosted snapshot");
    expect(screen.getByTestId("price-source").textContent).not.toContain("current prices");
  });

  it("shows known and unknown preview prices without Add handlers or zero-price ordering", () => {
    const onOps = vi.fn();
    render(<MenuButtons locationId="188" disabled={false} onOps={onOps} />);
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
    render(<MenuButtons locationId="188" disabled={false} onOps={vi.fn()} />);
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
    render(<MenuButtons locationId="113" disabled={false} onOps={onOps} />);
    expect(screen.getByRole("searchbox")).toBeTruthy();
    const egg = screen.getByRole("button", { name: /The Good Egg/ }) as HTMLButtonElement;
    expect(egg.disabled).toBe(true);
    expect(egg.textContent).toContain("Price unavailable");
    fireEvent.click(egg);
    expect(onOps).not.toHaveBeenCalled();
  });

  it("retains actual priced ADD actions and the internal no-argument Demo fixture", () => {
    const onOps = vi.fn();
    const { rerender } = render(<MenuButtons locationId="188" disabled={false} onOps={onOps} />);
    fireEvent.click(screen.getByTestId("menu-cmu_188_smash_d_burger"));
    expect(onOps).toHaveBeenLastCalledWith([{ type: "ADD", itemId: "cmu_188_smash_d_burger", qty: 1, modifiers: [] }]);
    rerender(<MenuButtons disabled={false} onOps={onOps} />);
    fireEvent.click(screen.getByTestId("menu-burger"));
    expect(onOps).toHaveBeenLastCalledWith([{ type: "ADD", itemId: "burger", qty: 1, modifiers: [] }]);
  });
});
