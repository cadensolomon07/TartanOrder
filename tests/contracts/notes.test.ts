import { describe, expect, it } from "vitest";
import { LIMITS, LineSchema, ModelOpSchema, NoteSchema, OpSchema, OpsSchema } from "@/contracts";

const add = { type: "ADD", itemId: "burger", qty: 1, modifiers: [] };
const line = { lineId: "first", itemId: "burger", qty: 1, modifiers: [] };
const set = { type: "SET_NOTE", ref: { by: "last" }, note: "Serve sauce separately" };

describe("compatible strict item note contract", () => {
  it("trims notes, accepts the exact bound, and reserves empty text for clearing", () => {
    expect(LIMITS.noteChars).toBe(160);
    expect(NoteSchema.parse("  Please cut in half  ")).toBe("Please cut in half");
    expect(NoteSchema.parse("   ")).toBe("");
    expect(NoteSchema.safeParse("n".repeat(160)).success).toBe(true);
    expect(NoteSchema.safeParse("n".repeat(161)).success).toBe(false);
    for (const note of ["", "  ", "n".repeat(161), null, 12]) {
      expect(OpSchema.safeParse({ ...add, note }).success).toBe(false);
      expect(LineSchema.safeParse({ ...line, note }).success).toBe(false);
    }
    expect(OpSchema.parse({ ...add, note: "  Cut in half  " })).toMatchObject({ note: "Cut in half" });
    expect(LineSchema.parse({ ...line, note: "  Cut in half  " })).toMatchObject({ note: "Cut in half" });
    expect(OpSchema.parse({ ...set, note: "  " })).toMatchObject({ note: "" });
  });

  it("keeps existing payloads unchanged and rejects note-related extra keys", () => {
    expect(OpSchema.parse(add)).toEqual(add); expect(LineSchema.parse(line)).toEqual(line);
    for (const schema of [OpSchema, ModelOpSchema]) {
      expect(schema.parse(set)).toEqual(set);
      expect(schema.safeParse({ ...set, priceCents: 0 }).success).toBe(false);
      expect(schema.safeParse({ ...set, verified: true }).success).toBe(false);
      expect(schema.safeParse({ ...set, ref: { by: "last", lineId: "first" } }).success).toBe(false);
    }
    expect(OpsSchema.safeParse([set, { type: "UNDO" }]).success).toBe(false);
  });
});
