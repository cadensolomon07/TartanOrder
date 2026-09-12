import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API_VERSION, MENU_VERSION, type ParseRequest, type ParseResponse } from "@/contracts";
import { createEngine, getView, reduceEngine, type EngineState } from "@/core/engine";
import { parseCaseFile, type CaseExpect, type EvalCase } from "./cases/schema";
import { judge, toCaseLines } from "./lib/compare";
import { callRoute, errorCode, parserCallFor } from "./lib/parser-call";
import type { ActualOutcome, CaseRecord, EvalTransport, ParserLabel } from "./types";

export type { ParserCall } from "./lib/parser-call";

/**
 * Replays labelled cases through the parser under test AND A's pure engine, recording what
 * actually happened. Nothing here is shared between cases: every case gets a fresh engine.
 */

type Split = EvalCase["split"];
type Env = Readonly<Record<string, string | undefined>>;
type Clock = () => number;
type Draft = Pick<CaseRecord, "id" | "split" | "category" | "source" | "transcript" | "transport">;
type Latency = CaseRecord["latencyMs"];
type HarnessError = Extract<ActualOutcome, { kind: "harness-error" }>;
type Setup = { ok: true; state: EngineState } | { ok: false; error: HarnessError };
type Timed<T> = { ok: true; value: T; ms: number } | { ok: false; error: HarnessError; ms: number };

const CASES_DIR = fileURLToPath(new URL("./cases/", import.meta.url));
const CASE_FILES: Record<Split, string> = { dev: "dev.jsonl", heldout: "heldout.jsonl", adversarial: "adversarial.jsonl" };
const KNOWN_SPLITS: readonly Split[] = ["dev", "heldout", "adversarial"];
/** Held-out is frozen until H8: it is never part of the default run. */
const DEFAULT_SPLITS: readonly Split[] = ["dev", "adversarial"];
const SOURCE: Record<EvalCase["source"], ParseRequest["source"]> = { typed: "text", voice: "voice", fixture: "fixture" };

const isSplit = (value: string): value is Split => (KNOWN_SPLITS as readonly string[]).includes(value);

/** Reads `evals/cases/<split>.jsonl` for each split, in the order given; malformed lines throw. */
export function loadCases(splits: Split[]): EvalCase[] {
  return splits.flatMap((split) => parseCaseFile(readFileSync(path.join(CASES_DIR, CASE_FILES[split]), "utf8")));
}

/** `EVAL_BASE_URL` selects real HTTP against a deployment; otherwise everything runs in-process. */
export function resolveTransport(env: Env): EvalTransport {
  const baseUrl = (env.EVAL_BASE_URL ?? "").trim().replace(/\/+$/, "");
  return baseUrl.length > 0 ? { kind: "http", baseUrl } : { kind: "in-process" };
}

/** `EVAL_SPLITS` as a CSV; default dev + adversarial. `heldout` runs ONLY when listed explicitly. */
export function resolveSplits(env: Env): Split[] {
  const requested = (env.EVAL_SPLITS ?? "").split(",").map((value) => value.trim()).filter((value) => value.length > 0);
  if (requested.length === 0) return [...DEFAULT_SPLITS];
  const unknown = requested.filter((value) => !isSplit(value));
  if (unknown.length > 0) {
    throw new Error(`EVAL_SPLITS names unknown split(s): ${unknown.join(", ")}. Known splits: ${KNOWN_SPLITS.join(", ")}.`);
  }
  return [...new Set(requested.filter(isSplit))];
}

const harnessError = (message: string): HarnessError => ({ kind: "harness-error", message });

function describeError(error: unknown): HarnessError {
  return harnessError(error instanceof Error ? error.message : String(error));
}

async function timeAsync<T>(now: Clock, run: () => Promise<T>): Promise<Timed<T>> {
  const start = now();
  try {
    const value = await run();
    return { ok: true, value, ms: now() - start };
  } catch (error: unknown) {
    return { ok: false, error: describeError(error), ms: now() - start };
  }
}

/** Setup is explicit ops (D8), so it never depends on the parser under test; then the utterance begins. */
function applySetup(evalCase: EvalCase): Setup {
  const initial = createEngine(`eval-${evalCase.id}`);
  const result = evalCase.setupBatches.reduce<Setup>((setup, ops, index) => {
    if (!setup.ok) return setup;
    const state = reduceEngine(setup.state, { type: "UI", action: { type: "MANUAL", ops } });
    if (state.lastOutcome === "applied") return { ok: true, state };
    return { ok: false, error: harnessError(`setup batch ${index + 1} was ${state.lastOutcome} (${state.lastCode ?? "no code"})`) };
  }, { ok: true, state: initial });
  if (!result.ok) return result;
  return { ok: true, state: reduceEngine(result.state, { type: "INPUT_STARTED" }) };
}

/** Built from the live view so `baseRevision` is exactly what the engine will demand. */
function buildRequest(evalCase: EvalCase, state: EngineState): ParseRequest {
  return {
    v: API_VERSION,
    requestId: `${evalCase.id}:r`,
    baseRevision: state.view.revision,
    menuVersion: MENU_VERSION,
    text: evalCase.transcript,
    source: SOURCE[evalCase.source],
    asrConfidence: evalCase.asrConfidence,
  };
}

/** The override for the parser that really answered, when the case has one; otherwise `expect`. */
function resolveExpected(evalCase: EvalCase, parser: ParserLabel): CaseExpect {
  if (parser === "rules" || parser === "gemini") return evalCase.expectOverrides[parser] ?? evalCase.expect;
  return evalCase.expect;
}

/** Applies the labelled choice to a pending clarification and records what the engine did with it. */
function clarifyOutcome(state: EngineState, expected: CaseExpect): ActualOutcome {
  const pending = state.view.pending;
  if (!pending) return harnessError("engine reported clarify without a pending question");
  const asked = {
    kind: "clarify" as const,
    question: pending.question,
    choiceCount: pending.choices.length,
    chosenIndex: null,
    chooseOutcome: null,
    linesAfter: null,
  };
  if (expected.kind !== "clarify") return asked;
  const choice = pending.choices[expected.choiceIndex];
  if (!choice) return { ...asked, chooseOutcome: "rejected" };
  const chosen = reduceEngine(state, { type: "UI", action: { type: "CHOOSE", pendingId: pending.id, choiceId: choice.id } });
  return {
    ...asked,
    chosenIndex: expected.choiceIndex,
    chooseOutcome: chosen.lastOutcome,
    linesAfter: chosen.lastOutcome === "applied" ? toCaseLines(chosen.view.lines) : null,
  };
}

/** What the engine did with the parser output, read from its own outcome fields. */
function outcomeOf(state: EngineState, expected: CaseExpect): ActualOutcome {
  switch (state.lastOutcome) {
    case "applied":
      return { kind: "cart", lines: toCaseLines(getView(state).lines) };
    case "rejected":
      return state.lastCode === null ? harnessError("engine rejected without a code") : { kind: "reject", code: state.lastCode };
    case "clarify":
      return clarifyOutcome(state, expected);
    case "ignored":
      return harnessError(`engine ignored the response (${state.lastCode ?? "no code"}): stale/duplicate response`);
  }
}

function recordOf(draft: Draft, expected: CaseExpect, response: ParseResponse | null, actual: ActualOutcome, latencyMs: Latency): CaseRecord {
  return {
    ...draft,
    parser: response?.parser ?? "n/a",
    fallbackReason: response?.fallbackReason ?? null,
    expected,
    actual,
    pass: judge(expected, actual),
    rawResponse: response,
    latencyMs,
  };
}

/** Route-level cases (blank, oversize): only the status matters and no parser is credited. */
async function runHttpCase(draft: Draft, evalCase: EvalCase, request: ParseRequest, transport: EvalTransport, now: Clock): Promise<CaseRecord> {
  const reply = await timeAsync(now, () => callRoute(transport, request));
  const latency: Latency = { parse: reply.ms, engine: 0, total: reply.ms };
  if (!reply.ok) return recordOf(draft, evalCase.expect, null, reply.error, latency);
  return recordOf(draft, evalCase.expect, null, { kind: "http", status: reply.value.status, code: errorCode(reply.value.body) }, latency);
}

async function runParserCase(
  draft: Draft,
  evalCase: EvalCase,
  state: EngineState,
  request: ParseRequest,
  transport: EvalTransport,
  now: Clock,
): Promise<CaseRecord> {
  const start = now();
  const parse = await timeAsync(now, () => parserCallFor(transport)(request));
  if (!parse.ok) return recordOf(draft, evalCase.expect, null, parse.error, { parse: parse.ms, engine: 0, total: now() - start });
  const response = parse.value;
  const expected = resolveExpected(evalCase, response.parser);
  const engineStart = now();
  const next = reduceEngine(state, { type: "PARSE_RECEIVED", response });
  const engineMs = now() - engineStart;
  const actual = outcomeOf(next, expected);
  return recordOf(draft, expected, response, actual, { parse: parse.ms, engine: engineMs, total: now() - start });
}

export async function runCase(evalCase: EvalCase, transport: EvalTransport, deps: { now?: Clock } = {}): Promise<CaseRecord> {
  const now = deps.now ?? (() => performance.now());
  const draft: Draft = {
    id: evalCase.id,
    split: evalCase.split,
    category: evalCase.category,
    source: evalCase.source,
    transcript: evalCase.transcript,
    transport: transport.kind,
  };
  const setup = applySetup(evalCase);
  if (!setup.ok) return recordOf(draft, evalCase.expect, null, setup.error, { parse: 0, engine: 0, total: 0 });
  const request = buildRequest(evalCase, setup.state);
  if (evalCase.expect.kind === "http") return runHttpCase(draft, evalCase, request, transport, now);
  return runParserCase(draft, evalCase, setup.state, request, transport, now);
}

/** Sequential on purpose: latency samples stay clean and a deployment is never hammered. */
export function runCases(cases: EvalCase[], transport: EvalTransport): Promise<CaseRecord[]> {
  return cases.reduce<Promise<CaseRecord[]>>(
    async (previous, evalCase) => [...(await previous), await runCase(evalCase, transport)],
    Promise.resolve([]),
  );
}
