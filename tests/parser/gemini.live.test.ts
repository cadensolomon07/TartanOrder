// LIVE provider probe (H0.5) and structured-output check (H2). Makes REAL Gemini calls.
//
// Gated: runs only when GEMINI_LIVE=1 and GEMINI_API_KEY is non-empty in the process
// environment (read from process.env only; this file never reads .env files).
// Every run records {text, rawText, result, usage, latencyMs} per input to
// evals/runs/gemini-live-<timestamp>.json. The key is never written anywhere.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { API_VERSION, ModelParseResultSchema, type ParseRequest } from "@/contracts";
import { CATALOG, MENU_VERSION } from "../helpers/catalog";
import { GeminiError, parseGemini, type GeminiConfig, type GeminiOutcome } from "@/parser/gemini.server";

const apiKey = process.env.GEMINI_API_KEY ?? "";
const isEnabled = process.env.GEMINI_LIVE === "1" && apiKey.length > 0;
const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const TIMEOUT_MS = 15_000;
const RATE_LIMIT_BACKOFF_MS = 20_000;
const RUNS_DIR = join(process.cwd(), "evals", "runs");

const H2_INPUTS = [
  "a burger, fries and lemonade",
  "two burgers",
  "make the burger a double",
  "remove the fries",
  "make that two",
  "no onions",
  "undo",
  "a burger, no wait, fries",
  "a pizza",
  "una hamburguesa y papas fritas",
] as const;

type LiveRecord = {
  text: string;
  rawText: string | null;
  result: GeminiOutcome["result"] | null;
  usage: GeminiOutcome["usage"];
  latencyMs: number | null;
  error: { code: string; message: string } | null;
  retriedAfterRateLimit: boolean;
};

function liveConfig(): GeminiConfig {
  return { apiKey, model, timeoutMs: TIMEOUT_MS };
}

function requestFor(text: string, index: number): ParseRequest {
  return { v: API_VERSION, requestId: `live-${index}`, baseRevision: 0, menuVersion: MENU_VERSION, text, source: "fixture", asrConfidence: null };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function callOnce(text: string, index: number): Promise<LiveRecord> {
  try {
    const outcome = await parseGemini(requestFor(text, index), liveConfig(), CATALOG);
    return { text, ...outcome, error: null, retriedAfterRateLimit: false };
  } catch (error) {
    if (!(error instanceof GeminiError)) throw error;
    return { text, rawText: null, result: null, usage: null, latencyMs: null, error: { code: error.code, message: error.message }, retriedAfterRateLimit: false };
  }
}

// The adapter never retries; this harness waits out one free-tier 429 so a burst of
// eleven sequential calls does not masquerade as a parsing failure.
async function callWithOneRetry(text: string, index: number): Promise<LiveRecord> {
  const first = await callOnce(text, index);
  if (first.error?.code !== "RATE_LIMITED") return first;
  await sleep(RATE_LIMIT_BACKOFF_MS);
  return { ...(await callOnce(text, index)), retriedAfterRateLimit: true };
}

async function writeRun(name: string, payload: Record<string, unknown>): Promise<string> {
  await mkdir(RUNS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(RUNS_DIR, `${name}-${stamp}.json`);
  const serialized = JSON.stringify(payload, null, 2);
  if (serialized.includes(apiKey)) throw new Error("Refusing to write a run file that contains the API key.");
  await writeFile(file, serialized, "utf8");
  return file;
}

describe.skipIf(!isEnabled)("Gemini live (GEMINI_LIVE=1 and GEMINI_API_KEY set)", () => {
  it("H0.5 probe: one tiny authenticated call returns a valid ParseResult", async () => {
    const record = await callWithOneRetry("a burger", 0);
    console.info(`[gemini live probe] model=${model} latencyMs=${record.latencyMs ?? "n/a"} usage=${JSON.stringify(record.usage)} error=${record.error?.code ?? "none"}`);
    expect(record.error).toBeNull();
    expect(ModelParseResultSchema.safeParse(record.result).success).toBe(true);
  }, TIMEOUT_MS + RATE_LIMIT_BACKOFF_MS + 5_000);

  it("H2 structured-output check: ten inputs validate and are recorded to evals/runs", async () => {
    const records: LiveRecord[] = [];
    for (const [index, text] of H2_INPUTS.entries()) {
      records.push(await callWithOneRetry(text, index + 1));
    }
    const latencies = records.flatMap((record) => (record.latencyMs === null ? [] : [record.latencyMs]));
    const file = await writeRun("gemini-live", {
      recordedAt: new Date().toISOString(),
      model,
      source: "fixture",
      parser: "gemini",
      note: "Raw model proposals before any engine validation; no cart or prices were sent.",
      latencyMs: { n: latencies.length, min: Math.min(...latencies), max: Math.max(...latencies) },
      cases: records,
    });
    console.info(`[gemini live H2] wrote ${file}`);

    for (const record of records) {
      expect(record.error, `${record.text}: ${record.error?.code ?? ""}`).toBeNull();
      expect(ModelParseResultSchema.safeParse(record.result).success, record.text).toBe(true);
    }
    const pizza = records.find((record) => record.text === "a pizza");
    expect(pizza?.result?.kind).not.toBe("proposal");
  }, H2_INPUTS.length * (TIMEOUT_MS + RATE_LIMIT_BACKOFF_MS) + 10_000);
});
