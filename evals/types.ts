import type { ItemId, ModifierId, ParseResponse } from "@/contracts";
import type { CaseExpect, EvalCase } from "./cases/schema";

/**
 * Shared shapes for evaluation runs. `evals/harness.ts` produces `CaseRecord`s,
 * `evals/report.ts` folds them into a `RunSummary` and renders Markdown, and
 * `evals/runs/*.json` files are `RunFile`s. Every number carries its denominator.
 */

/** How the parser was reached. In-process calls `parseRules` directly (route `POST` for http cases). */
export type EvalTransport = { kind: "in-process" } | { kind: "http"; baseUrl: string };

export type CaseLine = { itemId: ItemId; qty: number; modifiers: ModifierId[] };

/** What A's engine actually did with the parser output. */
export type ActualOutcome =
  | { kind: "cart"; lines: CaseLine[] }
  | {
      kind: "clarify";
      question: string;
      choiceCount: number;
      chosenIndex: number | null;
      chooseOutcome: "applied" | "rejected" | "clarify" | "ignored" | null;
      linesAfter: CaseLine[] | null;
    }
  | { kind: "reject"; code: string }
  | { kind: "http"; status: number; code: string | null }
  | { kind: "harness-error"; message: string };

/** The label every row carries. `parser` comes from the response envelope, never assumed. */
export type ParserLabel = ParseResponse["parser"] | "n/a";

export type CaseRecord = {
  id: EvalCase["id"];
  split: EvalCase["split"];
  category: EvalCase["category"];
  source: EvalCase["source"];
  transcript: string;
  transport: EvalTransport["kind"];
  parser: ParserLabel;
  fallbackReason: ParseResponse["fallbackReason"];
  expected: CaseExpect;
  actual: ActualOutcome;
  pass: boolean;
  /** Raw proposed operations alongside the engine outcome (null for http-kind cases). */
  rawResponse: ParseResponse | null;
  latencyMs: { parse: number; engine: number; total: number };
};

export type Ratio = { numerator: number; denominator: number };

export type LatencyStats = { n: number; p50Ms: number; p95Ms: number; maxMs: number } | null;

export type GroupSummary = {
  n: number;
  /** Among cases whose expected outcome is an exact cart. */
  exactCart: Ratio;
  /** Among cases expected to clarify, reject, or fail at HTTP: did the same kind (and code/status) occur? */
  appropriateResponse: Ratio;
  /** Among cases that clarified as expected: did the labelled choice yield the expected cart? */
  completionAfterClarification: Ratio;
  /** Expected anything but a cart, but a cart was applied. Must be 0 on adversarial input. */
  leakedProposals: number;
  harnessErrors: number;
  latency: LatencyStats;
};

export type RunSummary = {
  overall: GroupSummary;
  bySplit: Record<string, GroupSummary>;
  byCategory: Record<string, GroupSummary>;
  /** Counts of rows per parser label and fallback reason, e.g. "rules", "rules/PARSE_TIMEOUT", "gemini". */
  byParserLabel: Record<string, number>;
  failures: Array<{ id: string; category: string; transcript: string; expected: CaseExpect; actual: ActualOutcome; parser: ParserLabel }>;
};

export type RunFile = {
  v: 1;
  /** Git SHA of the working tree the run was produced from (plus "-dirty" when uncommitted changes exist). */
  sha: string;
  startedAt: string; // ISO-8601
  finishedAt: string; // ISO-8601
  transport: EvalTransport;
  /** Human label for the run, e.g. "rules (in-process)" or "http → parser per row". */
  label: string;
  menuVersion: string;
  splits: EvalCase["split"][];
  records: CaseRecord[];
  summary: RunSummary;
};
