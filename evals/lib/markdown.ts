import type { CaseExpect } from "../cases/schema";
import type { ActualOutcome, CaseLine, GroupSummary, LatencyStats, Ratio } from "../types";

const TRANSCRIPT_PREVIEW_CHARS = 72;
const EMPTY = "–";

/** Escapes what would break a GitHub-flavoured Markdown table cell. */
export function cell(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]): string => `| ${cells.join(" | ")} |`;
  return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
}

/** `numerator/denominator (pct)`; an empty denominator is shown as such, never as 0% or 100%. */
export function pct(value: Ratio): string {
  if (value.denominator === 0) return "0/0 (n/a)";
  return `${value.numerator}/${value.denominator} (${((100 * value.numerator) / value.denominator).toFixed(1)}%)`;
}

const ms = (value: number): string => value.toFixed(2);

export function latencyCell(stats: LatencyStats): string {
  if (stats === null) return EMPTY;
  return `${ms(stats.p50Ms)} / ${ms(stats.p95Ms)} / ${ms(stats.maxMs)} (n=${stats.n})`;
}

export const GROUP_HEADERS = [
  "Group", "n", "Exact cart", "Appropriate response", "Completion after clarification",
  "Leaked proposals", "Harness errors", "Latency p50 / p95 / max ms",
] as const;

export function groupRow(name: string, group: GroupSummary): string[] {
  return [
    cell(name),
    String(group.n),
    pct(group.exactCart),
    pct(group.appropriateResponse),
    pct(group.completionAfterClarification),
    String(group.leakedProposals),
    String(group.harnessErrors),
    latencyCell(group.latency),
  ];
}

const lineText = (line: CaseLine): string =>
  `${line.itemId}×${line.qty}${line.modifiers.length > 0 ? `[${[...line.modifiers].sort().join(",")}]` : ""}`;

const cartText = (lines: readonly CaseLine[]): string => (lines.length === 0 ? "(empty)" : lines.map(lineText).join("; "));

export function compactExpect(expected: CaseExpect): string {
  switch (expected.kind) {
    case "cart":
      return `cart ${cartText(expected.lines)}`;
    case "clarify":
      return `clarify choose#${expected.choiceIndex} → ${cartText(expected.linesAfter)}`;
    case "reject":
      return `reject ${expected.code}`;
    case "http":
      return `http ${expected.status}`;
  }
}

export function compactActual(actual: ActualOutcome): string {
  switch (actual.kind) {
    case "cart":
      return `cart ${cartText(actual.lines)}`;
    case "clarify": {
      const chosen = actual.chosenIndex === null ? EMPTY : String(actual.chosenIndex);
      const after = actual.linesAfter === null ? "" : `: ${cartText(actual.linesAfter)}`;
      return `clarify "${actual.question}" choices=${actual.choiceCount} chose=${chosen} → ${actual.chooseOutcome ?? "not chosen"}${after}`;
    }
    case "reject":
      return `reject ${actual.code}`;
    case "http":
      return `http ${actual.status}${actual.code ? ` ${actual.code}` : ""}`;
    case "harness-error":
      return `harness-error: ${actual.message}`;
  }
}

/** Long boundary transcripts are previewed; the run file keeps them whole. */
export function transcriptPreview(transcript: string): string {
  if (transcript.trim().length === 0) return `(whitespace, ${transcript.length} chars)`;
  if (transcript.length <= TRANSCRIPT_PREVIEW_CHARS) return transcript;
  return `${transcript.slice(0, TRANSCRIPT_PREVIEW_CHARS)}… (${transcript.length} chars)`;
}
