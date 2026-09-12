import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { z } from "zod";
import { API_VERSION, ParseResponseSchema, type ParseRequest, type ParseResult } from "@/contracts";
import { CATALOG, MENU, MENU_VERSION } from "../helpers/catalog";
import { parseRules } from "@/parser/rules";
import canonical from "./fixtures/canonical.json";

// Reproduce a run with: npm test -- tests/parser/rules.property.test.ts
const NUM_RUNS = 300;
const ALIASES = MENU.itemsForLocation("demo").flatMap((item) => [...item.aliases]);
const INJECTION_PATTERNS = [
  "ignore", "instructions", "system", "prompt", "free", "discount", "price", "$", "refund", "admin", "override",
  "developer", "jailbreak", "{", "}", "\"kind\"",
];
const FILLERS = ["please", "can i get", "can i have", "could i get", "i'd like", "i would like", "i want", "give me", "gimme", "let me get", "um", "uh"];

const RowSchema = z.object({ name: z.string(), text: z.string(), stretch: z.boolean().optional(), expect: z.object({ kind: z.string() }) });
type Row = z.infer<typeof RowSchema>;
const PROPOSAL_ROWS = z.array(RowSchema).parse(canonical).filter((row) => row.expect.kind === "proposal" && row.stretch !== true);

/** Browser ASR stutters: a function word or an item noun repeated in place. Aliases longest first so "french fries" wins over "fries". */
const FUNCTION_WORD = /\b(?:the|a|and)\b/g;
const ITEM_NOUN = new RegExp(`\\b(?:${[...ALIASES].sort((a, b) => b.length - a.length).map((alias) => `${alias}s?`).join("|")})\\b`, "g");

type Duplication = { readonly row: Row; readonly index: number; readonly length: number };

/** Every (row, span) pair where `pattern` matches a canonical proposal utterance. */
function duplications(pattern: RegExp): Duplication[] {
  return PROPOSAL_ROWS.flatMap((row) => [...row.text.matchAll(pattern)].map((match) => ({ row, index: match.index, length: match[0].length })));
}

function duplicateAt(text: string, index: number, length: number): string {
  return `${text.slice(0, index)}${text.slice(index, index + length)} ${text.slice(index)}`;
}

/** Total units a proposal would add to the cart; zero for anything that is not a proposal. */
function addedUnits(result: ParseResult): number {
  if (result.kind !== "proposal") return 0;
  return result.ops.reduce((total, op) => (op.type === "ADD" ? total + op.qty : total), 0);
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const restWords = rest < 20 ? ONES[rest] : [TENS[Math.floor(rest / 10)], ONES[rest % 10]].filter(Boolean).join(" ");
  return [hundreds ? `${ONES[hundreds]} hundred` : "", restWords].filter(Boolean).join(" ");
}

/** Renders 1..999,999 as English words without "and". */
function toWords(n: number): string {
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  return [thousands ? `${belowThousand(thousands)} thousand` : "", rest ? belowThousand(rest) : ""].filter(Boolean).join(" ");
}

const validRequest = fc.record({
  v: fc.constant(API_VERSION),
  requestId: fc.string({ minLength: 1, maxLength: 100 }).filter((id) => id.trim().length > 0),
  baseRevision: fc.nat({ max: 1_000_000 }),
  menuVersion: fc.constant(MENU_VERSION),
  text: fc.string({ minLength: 1, maxLength: 500 }),
  source: fc.constantFrom("voice" as const, "text" as const, "fixture" as const),
  asrConfidence: fc.oneof(fc.constant(null), fc.double({ min: 0, max: 1, noNaN: true })),
});

function requestWith(text: string): ParseRequest {
  return { v: API_VERSION, requestId: "p", baseRevision: 0, menuVersion: MENU_VERSION, text, source: "text", asrConfidence: null };
}

describe("rules parser properties", () => {
  it("P1: never throws and always returns a schema-valid response for printable ASCII text", () => {
    fc.assert(fc.property(validRequest, (req) => {
      const out = parseRules(req, CATALOG);
      expect(ParseResponseSchema.safeParse(out).success).toBe(true);
    }), { numRuns: NUM_RUNS });
  });

  it("P1b: never throws on arbitrary unicode text within the length limit", () => {
    const unicodeText = fc.string({ unit: "grapheme", minLength: 1, maxLength: 120 }).filter((text) => text.length <= 500);
    fc.assert(fc.property(unicodeText, (text) => {
      const out = parseRules(requestWith(text), CATALOG);
      expect(ParseResponseSchema.safeParse(out).success).toBe(true);
    }), { numRuns: NUM_RUNS });
  });

  it("P2: any quantity above five, in digits, thousands-separated digits or words, is QUANTITY_LIMIT", () => {
    const rendering = fc.tuple(fc.integer({ min: 6, max: 10_000_000 }), fc.constantFrom("digits", "commas", "words"), fc.constantFrom(...ALIASES))
      .map(([n, form, alias]) => {
        const rendered = form === "commas" ? n.toLocaleString("en-US") : form === "words" && n <= 999_999 ? toWords(n) : String(n);
        return `${rendered} ${alias}`;
      });
    fc.assert(fc.property(rendering, (text) => {
      const out = parseRules(requestWith(text), CATALOG);
      expect(out.result.kind).toBe("reject");
      expect(out.result.kind === "reject" ? out.result.code : "").toBe("QUANTITY_LIMIT");
    }), { numRuns: NUM_RUNS });
  });

  it("P2b: any negative quantity, as signed digits or spoken 'negative' words, is QUANTITY_LIMIT and never a proposal", () => {
    const rendering = fc.tuple(fc.integer({ min: 1, max: 1_000_000 }), fc.constantFrom("digits", "words"), fc.constantFrom(...ALIASES))
      .map(([n, form, alias]) => {
        const rendered = form === "words" && n <= 999_999 ? `negative ${toWords(n)}` : `-${n}`;
        return `${rendered} ${alias}`;
      });
    fc.assert(fc.property(rendering, (text) => {
      const out = parseRules(requestWith(text), CATALOG);
      expect(out.result.kind).toBe("reject");
      expect(out.result.kind === "reject" ? out.result.code : "").toBe("QUANTITY_LIMIT");
    }), { numRuns: NUM_RUNS });
  });

  it("P3: the envelope always echoes requestId, baseRevision and menuVersion", () => {
    fc.assert(fc.property(validRequest, (req) => {
      const out = parseRules(req, CATALOG);
      expect(out.requestId).toBe(req.requestId);
      expect(out.baseRevision).toBe(req.baseRevision);
      expect(out.menuVersion).toBe(req.menuVersion);
      expect(out.parser).toBe("rules");
      expect(out.fallbackReason).toBeNull();
    }), { numRuns: NUM_RUNS });
  });

  it("P4: any proposal containing UNDO has exactly one operation", () => {
    const clause = fc.constantFrom("undo", "undo that", "go back", "a burger", "fries", "two lemonades", "remove the fries", "make that two", "no onions");
    const utterance = fc.array(clause, { minLength: 1, maxLength: 4 }).map((clauses) => clauses.join(", "));
    fc.assert(fc.property(utterance, (text) => {
      const out = parseRules(requestWith(text), CATALOG);
      if (out.result.kind !== "proposal") return;
      if (out.result.ops.some((op) => op.type === "UNDO")) expect(out.result.ops).toHaveLength(1);
    }), { numRuns: NUM_RUNS });
  });

  it("P5: fillers, separator swaps, pluralization and casing never change the operations", () => {
    const baseline = new Map(PROPOSAL_ROWS.map((row) => [row.name, parseRules(requestWith(row.text), CATALOG).result]));
    const transform = fc.record({
      row: fc.constantFrom(...PROPOSAL_ROWS),
      leadingFiller: fc.option(fc.constantFrom(...FILLERS, "like"), { nil: null }),
      trailingFiller: fc.option(fc.constantFrom("please", "um", "uh"), { nil: null }),
      separator: fc.constantFrom("keep", "and", "comma"),
      pluralize: fc.boolean(),
      casing: fc.constantFrom("keep", "upper", "title"),
    });
    fc.assert(fc.property(transform, ({ row, leadingFiller, trailingFiller, separator, pluralize, casing }) => {
      let text = row.text;
      if (separator === "and") text = text.replace(/, /g, " and ");
      if (separator === "comma") text = text.replace(/ and /g, ", ");
      if (pluralize) text = text.replace(/\b(burger|cheeseburger|lemonade|lemon drink)\b(?!s)/g, "$1s");
      if (leadingFiller) text = `${leadingFiller} ${text}`;
      if (trailingFiller) text = `${text} ${trailingFiller}`;
      if (casing === "upper") text = text.toUpperCase();
      if (casing === "title") text = text.replace(/\b\w/g, (char) => char.toUpperCase());
      expect(parseRules(requestWith(text), CATALOG).result).toEqual(baseline.get(row.name));
    }), { numRuns: NUM_RUNS });
  });

  it("P6: any text containing an injection pattern never yields a proposal", () => {
    const around = fc.string({ maxLength: 60 });
    const injected = fc.tuple(around, fc.constantFrom(...INJECTION_PATTERNS), around)
      .map(([before, pattern, after]) => `${before} ${pattern} ${after}`.slice(0, 500));
    fc.assert(fc.property(injected, (text) => {
      const out = parseRules(requestWith(text), CATALOG);
      expect(out.result.kind).not.toBe("proposal");
    }), { numRuns: NUM_RUNS });
  });

  it("P7: duplicating a function word in place never changes the operations", () => {
    const stutters = duplications(FUNCTION_WORD);
    fc.assert(fc.property(fc.constantFrom(...stutters), ({ row, index, length }) => {
      const stuttered = parseRules(requestWith(duplicateAt(row.text, index, length)), CATALOG).result;
      expect(stuttered).toEqual(parseRules(requestWith(row.text), CATALOG).result);
    }), { numRuns: NUM_RUNS });
  });

  it("P8: duplicating an item noun in place never yields a proposal with more units than the original", () => {
    const stutters = duplications(ITEM_NOUN);
    fc.assert(fc.property(fc.constantFrom(...stutters), ({ row, index, length }) => {
      const stuttered = parseRules(requestWith(duplicateAt(row.text, index, length)), CATALOG).result;
      if (stuttered.kind !== "proposal") return;
      expect(addedUnits(stuttered)).toBeLessThanOrEqual(addedUnits(parseRules(requestWith(row.text), CATALOG).result));
    }), { numRuns: NUM_RUNS });
  });
});
