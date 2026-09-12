import { afterEach, describe, expect, it, vi } from "vitest";
import { LocationIdSchema } from "@/contracts";
import { MENU } from "@/contracts/menu";
import { WaitEngineConfigSchema, WaitTimeSnapshotSchema } from "@/contracts/waits";
import { loadWaitConfiguration } from "@/waits/config.server";
import { DINING_LOCATIONS_URL, DiningApiWaitTimes, NO_API_WAIT_DATA, SeededWaitTimes } from "@/waits/providers";

const NOW = new Date("2026-09-12T14:20:00.000Z");
const now = () => new Date(NOW);
const directory = [{ conceptId: "188", name: "Stack'd Underground", queue: 0, waitMinutes: 2 }];

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("wait providers (mocked HTTP; no queue observations)", () => {
  it("returns the fixed, explicitly seeded snapshot without network and isolates callers", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => { throw new Error("Network is forbidden"); });
    vi.stubGlobal("fetch", fetchImpl);
    const provider = new SeededWaitTimes();
    const first = await provider.getSnapshot();
    const original = structuredClone(first);
    first.waits["188"] = 999;
    expect(await provider.getSnapshot()).toEqual(original);
    expect(original).toMatchObject({ id: "seeded-waits-shortlist-v1", source: "seeded", waits: { "188": 14, "109": 4, "115": null, "94": null } });
    expect(Object.keys(original.waits).sort()).toEqual([...LocationIdSchema.options].sort());
    expect(WaitTimeSnapshotSchema.safeParse(original).success).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects malformed or invented seeded values at the provider boundary", () => {
    expect(() => new SeededWaitTimes({ source: "seeded", waits: { "188": -1 } })).toThrow();
  });

  it("probes only the documented directory once and never interprets unknown queue fields", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(directory));
    const provider = new DiningApiWaitTimes({ fetchImpl, now });
    const snapshot = await provider.getSnapshot();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(DINING_LOCATIONS_URL);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    expect(snapshot).toMatchObject({ source: "api", asOf: NOW.toISOString() });
    expect(Object.values(snapshot.waits).every((value) => value === null)).toBe(true);
    expect(provider.unavailableReason).toBe(NO_API_WAIT_DATA);
  });

  it.each(["HTTP error", "malformed JSON", "invalid directory", "oversized response"])("fails closed for %s without retry or seeded substitution", async (kind) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => kind === "HTTP error" ? new Response("unavailable", { status: 503 })
      : kind === "malformed JSON" ? new Response("{") : kind === "invalid directory" ? Response.json({ waits: { "188": 2 } })
        : new Response(" ".repeat(256 * 1024 + 1)));
    const provider = new DiningApiWaitTimes({ fetchImpl, now });
    const snapshot = await provider.getSnapshot();
    expect(snapshot.source).toBe("api");
    expect(Object.values(snapshot.waits).every((value) => value === null)).toBe(true);
    expect(provider.unavailableReason).toContain("could not be checked or validated");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("bounds a stalled request and aborts it", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise(() => undefined));
    const provider = new DiningApiWaitTimes({ fetchImpl, now, timeoutMs: 20 });
    const pending = provider.getSnapshot();
    await vi.advanceTimersByTimeAsync(20);
    expect((await pending).waits["188"]).toBeNull();
    expect(fetchImpl.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("bounds a stalled body, not just the initial HTTP headers", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(new ReadableStream({ start() { /* intentionally no chunks or close */ } })));
    const pending = new DiningApiWaitTimes({ fetchImpl, now, timeoutMs: 20 }).getSnapshot();
    await vi.advanceTimersByTimeAsync(20);
    expect((await pending).source).toBe("api");
    expect(fetchImpl.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});

describe("server wait configuration", () => {
  it("validates curated real items, vendors, price tolerance and disclosed differences", async () => {
    const config = await loadWaitConfiguration({ mode: "seeded", now });
    expect(WaitEngineConfigSchema.safeParse(config).success).toBe(true);
    expect(config).toMatchObject({ available: true, unavailableReason: null, evaluatedAt: NOW.toISOString(), swapThresholdMinutes: 5, priceToleranceCents: 100 });
    expect(config.groups).toHaveLength(1);
    for (const group of config.groups) {
      const [left, right] = group.itemIds.map((id) => MENU[id]);
      expect(left.locationId).not.toBe(right.locationId);
      expect(Math.abs(left.priceCents - right.priceCents)).toBeLessThanOrEqual(config.priceToleranceCents);
      for (const id of group.itemIds) expect(group.differences[id]).toBeTruthy();
      expect(config.nearbyPairs.some((pair) => pair.vendors.includes(left.locationId as typeof pair.vendors[number]) && pair.vendors.includes(right.locationId as typeof pair.vendors[number]))).toBe(true);
    }
    expect(config.nearbyPairs.every((pair) => pair.sourceUrl === DINING_LOCATIONS_URL)).toBe(true);
  });

  it("API mode remains unavailable even when directory retrieval succeeds", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(directory));
    const config = await loadWaitConfiguration({ mode: "api", now, fetchImpl });
    expect(config).toMatchObject({ available: false, unavailableReason: NO_API_WAIT_DATA, snapshot: { source: "api" } });
    expect(Object.values(config.snapshot.waits).every((value) => value === null)).toBe(true);
  });

  it("unknown mode does not silently enable seeded waits or perform a request", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => { throw new Error("Network is forbidden"); });
    const config = await loadWaitConfiguration({ mode: "typo", now, fetchImpl });
    expect(config.available).toBe(false);
    expect(config.unavailableReason).toContain("not configured correctly");
    expect(Object.values(config.snapshot.waits).every((value) => value === null)).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
