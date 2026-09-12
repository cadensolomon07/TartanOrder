import { describe, expect, it } from "vitest";
import { API_VERSION, type AuditEntry, type Receipt } from "@/contracts";
import { createPersistClient } from "@/persistence/client";
import { CATALOG } from "../helpers/catalog";

const entry: AuditEntry = { seq: 1, event: { type: "INPUT_STARTED" }, outcome: "applied", code: null };
const receipt: Receipt = { id: "r1", reviewId: "rev1", lines: [{ lineId: "l1", itemId: "burger", qty: 1, modifiers: [] }], totalCents: 800, simulated: true };

function fetchStub(status: number, body: unknown) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return { calls, fetchImpl };
}

describe("persist client", () => {
  it("posts validated V3 bodies to the session routes and reads acknowledgements", async () => {
    const stub = fetchStub(200, { v: API_VERSION, sessionId: "s1", savedSeq: 7 });
    const client = createPersistClient({ fetchImpl: stub.fetchImpl, timeoutMs: 1000 });
    expect(await client.createSession({ sessionId: "s1", menuVersion: CATALOG.versionId })).toEqual({ ok: true, savedSeq: 7 });
    expect(await client.appendEvents("s1", [entry])).toEqual({ ok: true, savedSeq: 7 });
    expect(await client.saveReceipt("s 1", receipt)).toEqual({ ok: true, savedSeq: 7 });
    expect(stub.calls.map((call) => call.url)).toEqual(["/api/sessions", "/api/sessions/s1/events", "/api/sessions/s%201/receipt"]);
    expect(stub.calls[0].body).toEqual({ v: API_VERSION, sessionId: "s1", menuVersion: CATALOG.versionId });
    expect(stub.calls[1].body).toEqual({ v: API_VERSION, entries: [entry] });
  });

  it("surfaces structured server errors, malformed acks, and network failures without throwing", async () => {
    const gap = fetchStub(409, { v: API_VERSION, sessionId: "s1", error: { code: "AUDIT_SEQUENCE_GAP", message: "gap", retryable: false } });
    expect(await createPersistClient({ fetchImpl: gap.fetchImpl, timeoutMs: 1000 }).appendEvents("s1", [entry])).toMatchObject({ ok: false, code: "AUDIT_SEQUENCE_GAP", retryable: false });
    const junk = fetchStub(200, { nope: true });
    expect(await createPersistClient({ fetchImpl: junk.fetchImpl, timeoutMs: 1000 }).appendEvents("s1", [entry])).toMatchObject({ ok: false, code: "INVALID_RESPONSE", retryable: true });
    const html = fetchStub(502, "<html>");
    expect(await createPersistClient({ fetchImpl: html.fetchImpl, timeoutMs: 1000 }).appendEvents("s1", [entry])).toMatchObject({ ok: false, code: "HTTP_502", retryable: true });
    const down: typeof fetch = async () => { throw new TypeError("offline"); };
    expect(await createPersistClient({ fetchImpl: down, timeoutMs: 1000 }).saveReceipt("s1", receipt)).toMatchObject({ ok: false, code: "NETWORK", retryable: true });
    expect(await createPersistClient({ fetchImpl: down, timeoutMs: 1000 }).createSession({ sessionId: "", menuVersion: CATALOG.versionId })).toMatchObject({ ok: false, code: "INVALID_REQUEST", retryable: false });
  });
});
