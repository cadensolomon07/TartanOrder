import { CATALOG, MENU } from "../helpers/catalog";
import { describe, it, expect } from "vitest";
import { LanguageSchema, ParseRequestSchema, ParseResponseSchema } from "@/contracts";
import { FIXTURE_REQUEST } from "@/contracts/fixtures";
import { parseRules } from "@/parser/rules";
import { reviewToSpeech } from "@/ui/reviewSpeech";

describe("language support", () => {
  it("accepts only the three supported languages without changing existing requests", () => {
    expect(ParseRequestSchema.parse(FIXTURE_REQUEST)).not.toHaveProperty("language");
    expect(LanguageSchema.safeParse("fr-FR").success).toBe(false);
    for (const language of ["es-ES", "zh-CN"] as const) {
      const request = ParseRequestSchema.parse({ ...FIXTURE_REQUEST, language });
      const response = ParseResponseSchema.parse(parseRules(request,CATALOG));
      expect(response.parser).toBe("rules");
      expect(response.result).toMatchObject({ kind: "reject", code: "UNSUPPORTED" });
      if (response.result.kind === "reject") expect(response.result.message).toMatch(language === "es-ES" ? /inglés/ : /英语/);
    }
  });
  it("reads each selected language from the same immutable priced review", () => {
    const review = { id: "r", revision: 2, lines: [{ lineId: "water", itemId: "water" as const, qty: 1, modifiers: [], note: "extra ice" }], totalCents: 150 };
    expect(reviewToSpeech(review, MENU, "es-ES")).toContain("1 Agua");
    expect(reviewToSpeech(review, MENU, "zh-CN")).toContain("1 水");
    for (const language of ["es-ES", "zh-CN"] as const) {
      expect(reviewToSpeech(review, MENU, language)).toContain("1.50");
      expect(reviewToSpeech(review, MENU, language)).toContain("extra ice");
    }
  });
});
