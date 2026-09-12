import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LIMITS } from "@/contracts";
import { CASE_CATEGORIES, EvalCaseSchema, parseCaseFile, type CaseExpect, type EvalCase } from "../../evals/cases/schema";

type Split = EvalCase["split"];
type Category = EvalCase["category"];
type CaseLine = Extract<CaseExpect, { kind: "cart" }>["lines"][number];

const CASES_DIR = fileURLToPath(new URL("../../evals/cases/", import.meta.url));
const FILES: Record<Split, string> = { dev: "dev.jsonl", heldout: "heldout.jsonl", adversarial: "adversarial.jsonl" };
const EXPECTED_COUNTS: Record<Split, number> = { dev: 36, heldout: 24, adversarial: 24 };
const ID_PREFIX: Record<Split, string> = { dev: "dev", heldout: "ho", adversarial: "adv" };

const ACCURACY_CATEGORIES = [
  "simple", "corrections", "ambiguous", "off_menu", "invalid_modifier", "quantity_abuse", "deferral", "code_switching",
] as const satisfies readonly Category[];
const DEV_DISTRIBUTION: Record<(typeof ACCURACY_CATEGORIES)[number], number> = {
  simple: 6, corrections: 6, ambiguous: 5, off_menu: 4, invalid_modifier: 4, quantity_abuse: 5, deferral: 3, code_switching: 3,
};
const HELDOUT_DISTRIBUTION: Record<(typeof ACCURACY_CATEGORIES)[number], number> = {
  simple: 3, corrections: 3, ambiguous: 3, off_menu: 3, invalid_modifier: 3, quantity_abuse: 3, deferral: 3, code_switching: 3,
};
const ADVERSARIAL_FIXED: Partial<Record<Category, number>> = { injection: 8, nonsense: 4, asr_artifact: 4, boundary: 4 };
const ADVERSARIAL_EXTRA_CATEGORIES: readonly Category[] = ["quantity_abuse", "off_menu"];

const load = (split: Split): EvalCase[] => parseCaseFile(readFileSync(path.join(CASES_DIR, FILES[split]), "utf8"));
const SPLITS: Split[] = ["dev", "heldout", "adversarial"];
const ALL = Object.fromEntries(SPLITS.map((split) => [split, load(split)])) as Record<Split, EvalCase[]>;
const EVERY_CASE = SPLITS.flatMap((split) => ALL[split]);

const countBy = (cases: EvalCase[]): Partial<Record<Category, number>> =>
  cases.reduce<Partial<Record<Category, number>>>(
    (counts, item) => ({ ...counts, [item.category]: (counts[item.category] ?? 0) + 1 }),
    {},
  );
const units = (lines: CaseLine[]): number => lines.reduce((sum, line) => sum + line.qty, 0);
const cartsOf = (expectation: CaseExpect): CaseLine[][] => {
  if (expectation.kind === "cart") return [expectation.lines];
  if (expectation.kind === "clarify") return [expectation.linesAfter];
  return [];
};
const expectationsOf = (item: EvalCase): CaseExpect[] =>
  [item.expect, item.expectOverrides.rules, item.expectOverrides.gemini].filter((value): value is CaseExpect => value !== undefined);

describe("evaluation case files", () => {
  it("parses every line of every file with the case schema", () => {
    for (const item of EVERY_CASE) {
      expect(EvalCaseSchema.safeParse(item).success).toBe(true);
    }
  });

  it("names the failing line when a row is malformed", () => {
    expect(() => parseCaseFile("\n{\"id\":\"dev-001\"}\n")).toThrow(/line 2/);
    expect(() => parseCaseFile("not json")).toThrow(/line 1: invalid JSON/);
    expect(parseCaseFile("")).toEqual([]);
  });

  it.each(SPLITS)("has exactly the agreed number of %s cases whose split and id prefix match the file", (split) => {
    const cases = ALL[split];
    expect(cases).toHaveLength(EXPECTED_COUNTS[split]);
    for (const item of cases) {
      expect(item.split).toBe(split);
      expect(item.id.startsWith(`${ID_PREFIX[split]}-`)).toBe(true);
    }
  });

  it("uses unique ids across all files", () => {
    const ids = EVERY_CASE.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never puts UNDO or more than eight operations in a setup batch", () => {
    for (const item of EVERY_CASE) {
      for (const batch of item.setupBatches) {
        expect(batch.length).toBeLessThanOrEqual(LIMITS.operations);
        expect(batch.some((op) => op.type === "UNDO")).toBe(false);
      }
    }
  });

  it("keeps language-case transcripts non-blank and within the 500-character limit", () => {
    for (const item of EVERY_CASE.filter((candidate) => candidate.expect.kind !== "http")) {
      expect(item.transcript.trim().length).toBeGreaterThan(0);
      expect(item.transcript.length).toBeGreaterThanOrEqual(1);
      expect(item.transcript.length).toBeLessThanOrEqual(LIMITS.transcriptChars);
    }
  });

  it("labels http rows with the status the route returns for that transcript", () => {
    const httpRows = EVERY_CASE.filter((item) => item.expect.kind === "http");
    expect(httpRows.length).toBeGreaterThan(0);
    for (const item of httpRows) {
      if (item.expect.kind !== "http") continue;
      const bytes = Buffer.byteLength(item.transcript, "utf8");
      if (bytes > LIMITS.requestBytes) {
        expect(item.expect.status).toBe(413);
        continue;
      }
      const isBlank = item.transcript.trim().length === 0;
      const isOversized = item.transcript.length > LIMITS.transcriptChars;
      expect(isBlank || isOversized).toBe(true);
      expect(item.expect.status).toBe(400);
    }
  });

  it("keeps every expected cart within five lines and ten units", () => {
    for (const item of EVERY_CASE) {
      for (const lines of expectationsOf(item).flatMap(cartsOf)) {
        expect(lines.length).toBeLessThanOrEqual(LIMITS.lines);
        expect(units(lines)).toBeLessThanOrEqual(LIMITS.totalUnits);
      }
    }
  });

  it("matches the agreed per-category distribution for dev and held-out", () => {
    expect(countBy(ALL.dev)).toEqual(DEV_DISTRIBUTION);
    expect(countBy(ALL.heldout)).toEqual(HELDOUT_DISTRIBUTION);
  });

  it("keeps the fixed adversarial categories and confines the remainder to tricky quantity/off-menu rows", () => {
    const counts = countBy(ALL.adversarial);
    for (const [category, expected] of Object.entries(ADVERSARIAL_FIXED)) {
      expect(counts[category as Category]).toBe(expected);
    }
    const fixed = Object.values(ADVERSARIAL_FIXED).reduce((sum, value) => sum + value, 0);
    const extra = ALL.adversarial.filter((item) => !(item.category in ADVERSARIAL_FIXED));
    expect(extra).toHaveLength(EXPECTED_COUNTS.adversarial - fixed);
    for (const item of extra) expect(ADVERSARIAL_EXTRA_CATEGORIES).toContain(item.category);
  });

  it("keeps held-out transcripts distinct from every dev transcript", () => {
    const devTranscripts = new Set(ALL.dev.map((item) => item.transcript.toLowerCase()));
    for (const item of ALL.heldout) {
      expect(devTranscripts.has(item.transcript.toLowerCase())).toBe(false);
    }
  });

  it("keeps dev and held-out rows as language cases, not route-level http cases", () => {
    for (const item of [...ALL.dev, ...ALL.heldout]) {
      expect(item.expect.kind).not.toBe("http");
      expect(ACCURACY_CATEGORIES).toContain(item.category);
    }
  });

  it("fills intended only for voice rows and ASR-artifact rows, and asrConfidence only for voice rows", () => {
    for (const item of EVERY_CASE) {
      if (item.source !== "voice") expect(item.asrConfidence).toBeNull();
      if (item.category === "asr_artifact") expect(item.intended).not.toBeNull();
      if (item.source !== "voice" && item.category !== "asr_artifact") expect(item.intended).toBeNull();
    }
  });

  it("only uses categories from the shared list", () => {
    for (const item of EVERY_CASE) expect(CASE_CATEGORIES).toContain(item.category);
  });
});
