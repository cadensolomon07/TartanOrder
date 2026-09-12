// @vitest-environment jsdom
// The customer badge and engineering controls for server saving. The fake
// controller supplies each state; no network and no real persistence here.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PersistenceStatus } from "@/contracts";
import { Kiosk, PERSISTENCE_TEXT } from "@/ui/Kiosk";
import { makeFake } from "./fakeController";
import { withCatalog } from "./withCatalog";

vi.mock("@/parser/client", () => ({ interpret: vi.fn(() => new Promise(() => {})) }));

beforeEach(() => {
  (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = class { start() {} stop() {} abort() {} };
  (window as unknown as { speechSynthesis: unknown }).speechSynthesis = { cancel: vi.fn(), speak: vi.fn() };
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class { constructor(public text: string) {} lang = ""; rate = 1; };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const status = (state: PersistenceStatus["state"], message: string | null = null): PersistenceStatus => ({ state, savedSeq: 2, pendingCount: state === "saved" ? 0 : 1, message });

describe("persistence badge", () => {
  it.each([
    ["saved", "Saved to server"],
    ["saving", "Saving to server…"],
    ["off", "Server saving off"],
  ] as const)("shows %s as %s without a retry button", (state, text) => {
    render(withCatalog(<Kiosk controller={makeFake({}, undefined, { persistence: status(state) })} />));
    const badge = screen.getByTestId("persistence");
    expect(badge.textContent).toBe(text);
    expect(badge.getAttribute("data-state")).toBe(state);
    expect(screen.queryByTestId("persistence-retry")).toBeNull();
    expect(PERSISTENCE_TEXT[state]).toBe(text);
  });

  it("shows a failure with its message and a retry button that calls the controller", () => {
    const retryPersistence = vi.fn();
    render(withCatalog(<Kiosk controller={makeFake({}, undefined, { persistence: status("failed", "Saving to the server failed (503)."), retryPersistence })} />));
    const badge = screen.getByTestId("persistence");
    expect(badge.textContent).toContain("Not saved to server");
    expect(badge.getAttribute("title")).toBe("Saving to the server failed (503).");
    fireEvent.click(screen.getByTestId("persistence-retry"));
    expect(retryPersistence).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("eng-toggle"));
    expect(screen.getByTestId("eng-persistence").textContent).toBe("failed · Saving to the server failed (503).");
  });
});

describe("engineering panel server copy", () => {
  it("disables the fetch when saving is off", () => {
    render(withCatalog(<Kiosk controller={makeFake({}, undefined, { persistence: status("off") })} />));
    fireEvent.click(screen.getByTestId("eng-toggle"));
    expect((screen.getByTestId("fetch-server-log") as HTMLButtonElement).disabled).toBe(true);
  });

  it("reports a missing or failed server copy without touching the local log", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const fake = makeFake({ sessionId: "sess 1" }, undefined, { persistence: status("saved") });
    render(withCatalog(<Kiosk controller={fake} />));
    fireEvent.click(screen.getByTestId("eng-toggle"));
    fireEvent.click(screen.getByTestId("fetch-server-log"));
    expect(fetchMock).toHaveBeenCalledWith("/api/sessions/sess%201/export", expect.anything());
    expect((await screen.findByTestId("server-log-notice")).textContent).toBe("The server has no copy of this session yet.");
    expect(fake.calls.some((call) => call.fn === "exportLog")).toBe(false);
    fetchMock.mockImplementation(async () => { throw new TypeError("offline"); });
    fireEvent.click(screen.getByTestId("fetch-server-log"));
    await vi.waitFor(() => expect(screen.getByTestId("server-log-notice").textContent).toContain("could not be reached"));
  });

  it("downloads the server copy when the export succeeds", async () => {
    const body = JSON.stringify({ v: 3, sessionId: "s1", audit: [] });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200, headers: { "content-type": "application/json" } })));
    const createObjectURL = vi.fn(() => "blob:tartanorder");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(withCatalog(<Kiosk controller={makeFake({}, undefined, { persistence: status("saved") })} />));
    fireEvent.click(screen.getByTestId("eng-toggle"));
    fireEvent.click(screen.getByTestId("fetch-server-log"));
    expect((await screen.findByTestId("server-log-notice")).textContent).toBe("Server copy downloaded.");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
  });
});
