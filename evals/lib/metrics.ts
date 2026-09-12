import type { CaseRecord, GroupSummary, LatencyStats, Ratio } from "../types";
import { isAppropriate } from "./compare";

const ratio = (numerator: number, denominator: number): Ratio => ({ numerator, denominator });

/** Nearest-rank percentile on an ascending sample: rank = ceil(q * n), 1-based. */
function nearestRank(sorted: readonly number[], q: number): number {
  const rank = Math.max(1, Math.ceil(q * sorted.length));
  return sorted[rank - 1];
}

/** Over records a parser actually answered (`parser !== "n/a"`), using `latencyMs.total`. */
export function latencyStats(records: readonly CaseRecord[]): LatencyStats {
  const samples = records
    .filter((record) => record.parser !== "n/a")
    .map((record) => record.latencyMs.total)
    .sort((left, right) => left - right);
  if (samples.length === 0) return null;
  return { n: samples.length, p50Ms: nearestRank(samples, 0.5), p95Ms: nearestRank(samples, 0.95), maxMs: samples[samples.length - 1] };
}

/**
 * Folds records into one group. Accuracy ratios are computed over `accuracyRecords`
 * (by default the same set); leaks, harness errors, latency and `n` always cover `records`.
 */
export function summarizeGroup(records: readonly CaseRecord[], accuracyRecords: readonly CaseRecord[] = records): GroupSummary {
  const cartCases = accuracyRecords.filter((record) => record.expected.kind === "cart");
  const responseCases = accuracyRecords.filter((record) => record.expected.kind !== "cart");
  const clarified = accuracyRecords.filter((record) => record.expected.kind === "clarify" && record.actual.kind === "clarify");
  return {
    n: records.length,
    exactCart: ratio(cartCases.filter((record) => record.pass).length, cartCases.length),
    appropriateResponse: ratio(responseCases.filter((record) => isAppropriate(record.expected, record.actual)).length, responseCases.length),
    completionAfterClarification: ratio(clarified.filter((record) => record.pass).length, clarified.length),
    leakedProposals: records.filter((record) => record.expected.kind !== "cart" && record.actual.kind === "cart").length,
    harnessErrors: records.filter((record) => record.actual.kind === "harness-error").length,
    latency: latencyStats(records),
  };
}

/** "rules", "rules/PARSE_TIMEOUT", "gemini", "n/a" — straight from the envelope fields. */
export function parserLabelKey(record: CaseRecord): string {
  return record.fallbackReason ? `${record.parser}/${record.fallbackReason}` : record.parser;
}

export function groupBy(records: readonly CaseRecord[], keyOf: (record: CaseRecord) => string): Record<string, CaseRecord[]> {
  return records.reduce<Record<string, CaseRecord[]>>((groups, record) => {
    const key = keyOf(record);
    return { ...groups, [key]: [...(groups[key] ?? []), record] };
  }, {});
}

export function countBy(records: readonly CaseRecord[], keyOf: (record: CaseRecord) => string): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    const key = keyOf(record);
    return { ...counts, [key]: (counts[key] ?? 0) + 1 };
  }, {});
}
