import type { Line } from "@/contracts";
import type { CaseExpect } from "../cases/schema";
import type { ActualOutcome, CaseLine } from "../types";

/** Projects engine lines onto the case shape: line ids dropped, modifiers sorted. */
export function toCaseLines(lines: readonly Pick<Line, "itemId" | "qty" | "modifiers">[]): CaseLine[] {
  return lines.map((line) => ({ itemId: line.itemId, qty: line.qty, modifiers: [...line.modifiers].sort() }));
}

function modifiersEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((modifier, index) => modifier === sortedRight[index]);
}

/** Ordered line comparison; line ids are never part of a case and modifier order is irrelevant. */
export function linesEqual(left: readonly CaseLine[], right: readonly CaseLine[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((line, index) => {
    const other = right[index];
    return line.itemId === other.itemId && line.qty === other.qty && modifiersEqual(line.modifiers, other.modifiers);
  });
}

/**
 * Did the expected *kind* of response occur? For reject and http the code/status must also
 * match. A clarify counts even when the follow-up choice did not yield the expected cart.
 */
export function isAppropriate(expected: CaseExpect, actual: ActualOutcome): boolean {
  switch (expected.kind) {
    case "cart":
      return actual.kind === "cart";
    case "clarify":
      return actual.kind === "clarify";
    case "reject":
      return actual.kind === "reject" && actual.code === expected.code;
    case "http":
      return actual.kind === "http" && actual.status === expected.status;
  }
}

/** Full pass rule: carts deep-equal, clarifications resolve to `linesAfter`, reject/http match exactly. */
export function judge(expected: CaseExpect, actual: ActualOutcome): boolean {
  if (expected.kind === "cart") return actual.kind === "cart" && linesEqual(actual.lines, expected.lines);
  if (expected.kind === "clarify") {
    return actual.kind === "clarify" && actual.linesAfter !== null && linesEqual(actual.linesAfter, expected.linesAfter);
  }
  return isAppropriate(expected, actual);
}
