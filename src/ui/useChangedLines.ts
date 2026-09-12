"use client";
// Returns the set of lineIds that changed since the previous cart so the cart
// can flash them briefly. Pure display concern. Uses the "derive from previous
// render" pattern (setState during render) rather than a setState-in-effect.
import { useEffect, useState } from "react";
import type { Line } from "@/contracts";

function sig(l: Line): string {
  return `${l.qty}|${[...l.modifiers].sort().join(",")}`;
}

export function useChangedLines(lines: Line[], holdMs = 1500): Set<string> {
  const [prevLines, setPrevLines] = useState(lines);
  const [changed, setChanged] = useState<Set<string>>(() => new Set());

  if (lines !== prevLines) {
    const before = new Map(prevLines.map((l) => [l.lineId, sig(l)]));
    const diff = new Set<string>();
    for (const l of lines) if (before.get(l.lineId) !== sig(l)) diff.add(l.lineId);
    setPrevLines(lines);
    if (diff.size > 0) setChanged(diff);
  }

  useEffect(() => {
    if (changed.size === 0) return;
    const t = setTimeout(() => setChanged(new Set()), holdMs);
    return () => clearTimeout(t);
  }, [changed, holdMs]);

  return changed;
}
