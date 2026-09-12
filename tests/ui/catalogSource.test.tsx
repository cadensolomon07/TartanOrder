// @vitest-environment jsdom
// The kiosk must always say where its menu came from, and must show no menu at
// all when no catalog loaded. Voice is mocked; nothing here is parser evidence.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WAIT_FIXTURE_CONFIG } from "@/contracts/fixtures";
import { OrderApp } from "@/controller/OrderApp";
import { Kiosk } from "@/ui/Kiosk";
import { catalogSourceLabel } from "@/ui/CatalogContext";
import { CATALOG } from "../helpers/catalog";
import { makeFake } from "./fakeController";
import { withCatalog } from "./withCatalog";

vi.mock("@/parser/client", () => ({ interpret: vi.fn(() => new Promise(() => {})) }));

beforeEach(() => {
  (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = class { start() {} stop() {} abort() {} };
  (window as unknown as { speechSynthesis: unknown }).speechSynthesis = { cancel: vi.fn(), speak: vi.fn() };
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class { constructor(public text: string) {} lang = ""; rate = 1; };
});
afterEach(cleanup);

describe("catalog source labelling", () => {
  it("labels the bundled fallback in the header and the engineering panel", () => {
    render(withCatalog(<Kiosk controller={makeFake()} />, "bundled"));
    expect(screen.getByTestId("catalog-source").textContent).toBe(`Menu: bundled fallback · ${CATALOG.versionId}`);
    fireEvent.click(screen.getByTestId("eng-toggle"));
    expect(screen.getByTestId("eng-catalog").textContent).toBe(`Menu: bundled fallback · ${CATALOG.versionId}`);
    expect(screen.getByTestId("eng-persistence").textContent).toBe("off");
  });

  it("labels a Supabase-loaded catalog with its version", () => {
    render(withCatalog(<Kiosk controller={makeFake()} />, "supabase"));
    expect(screen.getByTestId("catalog-source").textContent).toBe(`Menu: Supabase · ${CATALOG.versionId}`);
    expect(catalogSourceLabel("unavailable", null)).toBe("Menu: unavailable");
  });

  it("renders the loaded app at the kiosk default counter with the active shortlist", () => {
    render(<OrderApp catalogConfig={{ catalog: CATALOG, source: "supabase", versionId: CATALOG.versionId, unavailableReason: null }} waitConfig={WAIT_FIXTURE_CONFIG} />);
    expect(screen.getByTestId("catalog-source").textContent).toContain("Supabase");
    expect((screen.getByTestId("dining-location") as HTMLSelectElement).value).toBe("188");
    expect(screen.getByTestId("menu-cmu_188_smash_d_burger")).toBeTruthy();
    expect(screen.queryByTestId("catalog-unavailable")).toBeNull();
  });

  it("shows a labelled unavailable panel with no menu when no catalog loaded", () => {
    render(<OrderApp catalogConfig={{ catalog: null, source: "unavailable", versionId: null, unavailableReason: "The Supabase catalog loader returned no rows." }} waitConfig={WAIT_FIXTURE_CONFIG} />);
    const panel = screen.getByTestId("catalog-unavailable");
    expect(panel.textContent).toContain("ordering is unavailable");
    expect(panel.textContent).toContain("The Supabase catalog loader returned no rows.");
    expect(screen.queryAllByTestId(/^menu-/)).toHaveLength(0);
    expect(screen.queryByTestId("kiosk")).toBeNull();
    expect(screen.queryByTestId("text-input")).toBeNull();
  });
});
