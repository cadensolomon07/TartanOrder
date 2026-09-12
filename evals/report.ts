import { MENU_VERSION } from "@/contracts";
import type { EvalCase } from "./cases/schema";
import { cell, compactActual, compactExpect, GROUP_HEADERS, groupRow, latencyCell, table, transcriptPreview } from "./lib/markdown";
import { countBy, groupBy, parserLabelKey, summarizeGroup } from "./lib/metrics";
import type { CaseRecord, EvalTransport, GroupSummary, RunFile, RunSummary } from "./types";

/**
 * Folds `CaseRecord`s into a `RunSummary` and renders it. Every ratio carries its denominator;
 * adversarial rows never enter an accuracy denominator outside their own group.
 */

const ADVERSARIAL: EvalCase["split"] = "adversarial";
const DISCLAIMER =
  "Labels: parser column is the envelope's `parser` field; adversarial rows are excluded from accuracy denominators; " +
  'Gemini rows appear only if the server actually answered with `parser:"gemini"`.';

const isAdversarial = (record: CaseRecord): boolean => record.split === ADVERSARIAL;

/** Adversarial rows are keyed apart so `quantity_abuse` (dev) never shares a denominator with `quantity_abuse` (adversarial). */
const categoryKey = (record: CaseRecord): string => (isAdversarial(record) ? `${ADVERSARIAL}/${record.category}` : record.category);

function mapGroups(groups: Record<string, CaseRecord[]>): Record<string, GroupSummary> {
  return Object.fromEntries(Object.entries(groups).map(([key, records]) => [key, summarizeGroup(records)]));
}

export function summarize(records: CaseRecord[]): RunSummary {
  const accuracyRecords = records.filter((record) => !isAdversarial(record));
  return {
    overall: summarizeGroup(records, accuracyRecords),
    bySplit: mapGroups(groupBy(records, (record) => record.split)),
    byCategory: mapGroups(groupBy(records, categoryKey)),
    byParserLabel: countBy(records, parserLabelKey),
    failures: records
      .filter((record) => !record.pass)
      .map(({ id, category, transcript, expected, actual, parser }) => ({ id, category, transcript, expected, actual, parser })),
  };
}

export function buildRunFile(input: {
  records: CaseRecord[];
  transport: EvalTransport;
  label: string;
  splits: EvalCase["split"][];
  sha: string;
  startedAt: string;
  finishedAt: string;
}): RunFile {
  return {
    v: 1,
    sha: input.sha,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    transport: input.transport,
    label: input.label,
    menuVersion: MENU_VERSION,
    splits: input.splits,
    records: input.records,
    summary: summarize(input.records),
  };
}

/** e.g. "2026-09-12T05-10-00Z-in-process-dev+adversarial-abc1234" (sha may carry "-dirty"). */
export function runFileStem(run: RunFile): string {
  const stamp = run.startedAt.replace(/\.\d{1,3}Z$/, "Z").replace(/:/g, "-");
  return `${stamp}-${run.transport.kind}-${run.splits.join("+")}-${run.sha}`;
}

function header(run: RunFile): string {
  const transport = run.transport.kind === "http" ? `http (${run.transport.baseUrl})` : run.transport.kind;
  return [
    `# Eval run ${run.sha}`,
    "",
    `- **Label:** ${run.label}`,
    `- **Transport:** ${transport}`,
    `- **Splits:** ${run.splits.join(", ")}`,
    `- **Menu version:** ${run.menuVersion}`,
    `- **Started:** ${run.startedAt} · **Finished:** ${run.finishedAt}`,
    `- **Cases:** ${run.records.length} · **Failures:** ${run.summary.failures.length}`,
  ].join("\n");
}

function parserLabelSection(summary: RunSummary): string {
  const rows = Object.entries(summary.byParserLabel)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, count]) => [cell(label), String(count)]);
  return ["## Parser labels", "", table(["Parser label", "Rows"], rows)].join("\n");
}

function splitSection(summary: RunSummary): string {
  const rows = [
    groupRow("overall (accuracy: non-adversarial rows; leaks/errors/latency: all rows)", summary.overall),
    ...Object.entries(summary.bySplit).map(([split, group]) => groupRow(split, group)),
  ];
  return ["## Results by split", "", table(GROUP_HEADERS, rows)].join("\n");
}

function categorySection(summary: RunSummary): string {
  const rows = Object.entries(summary.byCategory)
    .sort(([left], [right]) => Number(left.startsWith(`${ADVERSARIAL}/`)) - Number(right.startsWith(`${ADVERSARIAL}/`)) || left.localeCompare(right))
    .map(([category, group]) => groupRow(category, group));
  return [
    "## Results by category",
    "",
    `Adversarial rows are keyed \`${ADVERSARIAL}/<category>\` so they never share a denominator with dev/held-out rows.`,
    "",
    table(GROUP_HEADERS, rows),
  ].join("\n");
}

function latencySection(summary: RunSummary): string {
  return [
    "## Latency",
    "",
    `Per-record \`latencyMs.total\` (parser call + engine apply, wall clock) over rows a parser answered; nearest-rank percentiles. p50 / p95 / max: ${latencyCell(summary.overall.latency)}.`,
  ].join("\n");
}

function failuresSection(summary: RunSummary): string {
  const heading = `## Failures (${summary.failures.length})`;
  if (summary.failures.length === 0) return [heading, "", "None."].join("\n");
  const rows = summary.failures.map((failure) => [
    failure.id,
    cell(failure.category),
    cell(failure.parser),
    cell(transcriptPreview(failure.transcript)),
    cell(compactExpect(failure.expected)),
    cell(compactActual(failure.actual)),
  ]);
  return [heading, "", table(["Id", "Category", "Parser", "Transcript", "Expected", "Actual"], rows)].join("\n");
}

export function renderMarkdown(run: RunFile): string {
  return [
    header(run),
    parserLabelSection(run.summary),
    splitSection(run.summary),
    categorySection(run.summary),
    latencySection(run.summary),
    failuresSection(run.summary),
    DISCLAIMER,
  ].join("\n\n") + "\n";
}
