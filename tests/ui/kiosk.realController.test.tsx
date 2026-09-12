// @vitest-environment jsdom
// Kiosk driven by A's REAL useOrderController (engine + request lifecycle).
// Only the parser transport is mocked, the way A's own hook test mocks it, so
// every assertion here is about the agreed draft/capture busy boundary — not
// about parsing. Regressions for A's first-intake correction on PR #2.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useOrderController } from "@/controller/useOrderController";
import { Kiosk } from "@/ui/Kiosk";
import { FIXTURE_RESPONSE } from "@/contracts/fixtures";
import type { InterpretOptions, ParseRequest, ParseResponse } from "@/contracts";
import { interpret } from "@/parser/client";
import { CATALOG } from "../helpers/catalog";
import { withCatalog } from "./withCatalog";

vi.mock("@/parser/client", () => ({ interpret: vi.fn() }));

type PendingCall = { request: ParseRequest; options: InterpretOptions; resolve(r: ParseResponse): void };
const calls: PendingCall[] = [];
const interpretMock = vi.mocked(interpret);

function proposalFor(call: PendingCall, itemId: "burger" | "fries" | "lemonade"): ParseResponse {
  return {
    ...FIXTURE_RESPONSE,
    requestId: call.request.requestId,
    baseRevision: call.request.baseRevision,
    menuVersion: call.request.menuVersion,
    parser: "rules",
    result: { kind: "proposal", ops: [{ type: "ADD", itemId, qty: 1, modifiers: [] }] },
  };
}

function Host() {
  const controller = useOrderController(CATALOG);
  return withCatalog(<Kiosk controller={controller} />);
}

beforeEach(() => {
  calls.length = 0;
  interpretMock.mockReset();
  interpretMock.mockImplementation((request, options) => new Promise<ParseResponse>((resolve) => {
    calls.push({ request, options, resolve });
  }));
  // Browser voice/TTS stubs so the Kiosk mounts as in Chrome; no recognition is started here.
  (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = class { start() {} stop() {} abort() {} };
  (window as unknown as { speechSynthesis: unknown }).speechSynthesis = { cancel: vi.fn(), speak: vi.fn() };
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class { constructor(public text: string) {} lang = ""; rate = 1; };
});

afterEach(cleanup);

const review = () => screen.getByTestId("review") as HTMLButtonElement;
const input = () => screen.getByTestId("text-input") as HTMLInputElement;

describe("Kiosk + real controller: typed-draft lifecycle", () => {
  it("an unsent draft during editing holds busy: Review is blocked until the draft is submitted, discarded or erased", async () => {
    render(<Host />);
    fireEvent.click(screen.getByTestId("menu-fries")); // MANUAL ADD through the real engine
    expect(screen.getByTestId("total").textContent).toBe("$3.00");
    expect(review().disabled).toBe(false);

    fireEvent.change(input(), { target: { value: "lemonade" } }); // draft begun, not submitted
    expect(review().disabled).toBe(true);
    expect(screen.getByTestId("badge-busy").textContent).toBe("typing");
    // The real controller refuses REVIEW while capture is open even if forced.
    // (The button is disabled; this documents the controller-side guard too.)

    fireEvent.click(screen.getByTestId("discard"));
    expect(review().disabled).toBe(false);

    fireEvent.change(input(), { target: { value: "l" } });
    expect(review().disabled).toBe(true);
    fireEvent.change(input(), { target: { value: "" } }); // erased
    expect(review().disabled).toBe(false);

    fireEvent.change(input(), { target: { value: "lemonade" } });
    fireEvent.click(screen.getByTestId("submit")); // submitted: capture ends, parse in flight
    expect(review().disabled).toBe(true); // busy: parsing
    await act(async () => { calls.at(-1)!.resolve(proposalFor(calls.at(-1)!, "lemonade")); });
    expect(screen.getByTestId("total").textContent).toBe("$5.50");
    expect(review().disabled).toBe(false);
  });

  it("an unsent draft cannot be confirmed: review is invalidated on the first keystroke and Confirm disappears", async () => {
    render(<Host />);
    fireEvent.click(screen.getByTestId("menu-fries"));
    fireEvent.click(review());
    expect(screen.getByTestId("confirm")).toBeTruthy();
    fireEvent.change(input(), { target: { value: "lemonade" } });
    expect(screen.queryByTestId("confirm")).toBeNull();
    expect(review().disabled).toBe(true);
    // Discard, review again, confirm: exactly one receipt with the reviewed fries only.
    fireEvent.click(screen.getByTestId("discard"));
    fireEvent.click(review());
    fireEvent.click(screen.getByTestId("confirm"));
    expect(screen.getByTestId("ticket").textContent).toContain("Fries");
    expect(screen.getByTestId("ticket").textContent).not.toContain("Lemonade");
  });

  it("a replacement draft cancels the older in-flight request; its late response never applies", async () => {
    render(<Host />);
    fireEvent.change(input(), { target: { value: "fries" } });
    fireEvent.click(screen.getByTestId("submit"));
    expect(calls).toHaveLength(1);
    const older = calls[0];
    expect(older.options.signal?.aborted).toBe(false);

    fireEvent.change(input(), { target: { value: "lemonade" } }); // replacement draft while parsing
    expect(older.options.signal?.aborted).toBe(true); // startInput() cancelled the request
    expect(review().disabled).toBe(true); // draft holds busy

    await act(async () => { older.resolve(proposalFor(older, "fries")); }); // late response arrives anyway
    expect(screen.getByTestId("cart-empty")).toBeTruthy(); // nothing applied
    expect(screen.getByTestId("total").textContent).toBe("$0.00");

    fireEvent.click(screen.getByTestId("submit")); // the replacement goes through normally
    expect(calls).toHaveLength(2);
    await act(async () => { calls[1].resolve(proposalFor(calls[1], "lemonade")); });
    expect(screen.getByTestId("total").textContent).toBe("$2.50");
    expect(screen.getByTestId("cart").querySelectorAll("li")).toHaveLength(1);
  });
});
