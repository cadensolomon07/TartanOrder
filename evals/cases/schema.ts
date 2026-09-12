import { z } from "zod";
import { CoreCodeSchema, ItemIdSchema, ModifiersSchema, OpsSchema, QuantitySchema } from "@/contracts";

export const CASE_CATEGORIES = [
  "simple",
  "corrections",
  "ambiguous",
  "off_menu",
  "invalid_modifier",
  "quantity_abuse",
  "deferral",
  "code_switching",
  "injection",
  "nonsense",
  "asr_artifact",
  "boundary",
] as const;

export const CaseLineSchema = z.strictObject({ itemId: ItemIdSchema, qty: QuantitySchema, modifiers: ModifiersSchema });

export const CaseExpectSchema = z.discriminatedUnion("kind", [
  // Exact ordered cart AFTER the utterance is applied.
  z.strictObject({ kind: z.literal("cart"), lines: z.array(CaseLineSchema) }),
  // Engine or parser asks; choosing choices[choiceIndex] yields linesAfter.
  z.strictObject({ kind: z.literal("clarify"), choiceIndex: z.number().int().nonnegative(), linesAfter: z.array(CaseLineSchema) }),
  // Cart unchanged; code from the parser OR the engine.
  z.strictObject({ kind: z.literal("reject"), code: CoreCodeSchema }),
  // Route-level rejection; transcript may be blank/oversized.
  z.strictObject({ kind: z.literal("http"), status: z.union([z.literal(400), z.literal(409), z.literal(413)]) }),
]);

export const EvalCaseSchema = z.strictObject({
  id: z.string().regex(/^(dev|ho|adv)-\d{3}$/),
  split: z.enum(["dev", "heldout", "adversarial"]),
  category: z.enum(CASE_CATEGORIES),
  source: z.enum(["typed", "fixture", "voice"]),
  setupBatches: z.array(OpsSchema), // applied via MANUAL UI actions before the transcript; NO UNDO ops here
  transcript: z.string(), // may be blank or >500 chars ONLY when expect.kind === "http"
  intended: z.string().nullable(), // voice rows only: what the speaker meant
  asrConfidence: z.number().min(0).max(1).nullable(),
  expect: CaseExpectSchema,
  expectOverrides: z.strictObject({ rules: CaseExpectSchema.optional(), gemini: CaseExpectSchema.optional() }),
  note: z.string().nullable(),
});

export type EvalCase = z.infer<typeof EvalCaseSchema>;
export type CaseExpect = z.infer<typeof CaseExpectSchema>;

function parseCaseLine(raw: string, lineNumber: number): EvalCase {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Case file line ${lineNumber}: invalid JSON (${reason}).`);
  }
  const parsed = EvalCaseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Case file line ${lineNumber}: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

/** Parses a JSONL case file: one case per line, blank lines skipped, failures name the line. */
export function parseCaseFile(text: string): EvalCase[] {
  return text.split(/\r?\n/).flatMap((raw, index) => (raw.trim().length === 0 ? [] : [parseCaseLine(raw, index + 1)]));
}
