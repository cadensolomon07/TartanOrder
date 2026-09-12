import { expect, it } from "vitest";
import { API_VERSION, type ParseRequest } from "@/contracts";
import { CATALOG, MENU_VERSION } from "../helpers/catalog";
import { parseGemini } from "@/parser/gemini.server";

// Explicit opt-in only: real provider evidence, not part of normal tests.
it.skipIf(process.env.RUN_CONTEXT_LIVE !== "1")("real contextual provider interpretation", async () => {
  const key = process.env.GEMINI_API_KEY ?? "";
  expect(key.length).toBeGreaterThan(0);
  const request: ParseRequest = {
    v: API_VERSION, menuVersion: MENU_VERSION, requestId: "live-context-1", baseRevision: 1,
    text: "I would love a burger and a glass of lemonade, please.", source: "text", asrConfidence: null,
    context: { lines: [], lastLineId: null, pending: null, recent: [] },
  };
  const fetchImpl: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    if (!response.ok) {
      const body = await response.clone().json().catch(() => null) as { error?: { code?: number; status?: string; message?: string } } | null;
      console.info(JSON.stringify({ providerStatus: response.status, code: body?.error?.code, status: body?.error?.status, message: body?.error?.message?.split(key).join("[REDACTED]") }));
    }
    return response;
  };
  const outcome = await parseGemini(request, { apiKey: key, model: process.env.GEMINI_MODEL || "gemini-3.6-flash", timeoutMs: 14000, fetchImpl }, CATALOG);
  console.info(JSON.stringify({ model: process.env.GEMINI_MODEL || "gemini-3.6-flash", result: outcome.result, usage: outcome.usage, latencyMs: outcome.latencyMs }));
  expect(outcome.result).toMatchObject({ kind: "proposal", ops: [
    { type: "ADD", itemId: "burger", qty: 1, modifiers: [] },
    { type: "ADD", itemId: "lemonade", qty: 1, modifiers: [] },
  ] });
  expect(outcome.usage?.totalTokens).toBeGreaterThan(0);
}, 17000);
