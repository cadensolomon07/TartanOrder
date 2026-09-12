import { describe, expect, it } from "vitest";
import { resolveParserMode } from "@/parser/mode.server";

describe("resolveParserMode", () => {
  it("defaults to rules when PARSER_MODE is unset or unknown", () => {
    expect(resolveParserMode({})).toEqual({ configured: "rules", keyPresent: false, effective: "rules" });
    expect(resolveParserMode({ PARSER_MODE: "fixture" }).effective).toBe("rules");
  });

  it("reports gemini as configured but not effective without a key", () => {
    const report = resolveParserMode({ PARSER_MODE: "gemini", GEMINI_API_KEY: "   " });
    expect(report).toEqual({ configured: "gemini", keyPresent: false, effective: "rules" });
  });

  it("is effective gemini only when configured and keyed", () => {
    const report = resolveParserMode({ PARSER_MODE: "gemini", GEMINI_API_KEY: "k" });
    expect(report).toEqual({ configured: "gemini", keyPresent: true, effective: "gemini" });
  });

  it("defaults online to Gemini when a key is configured, while honoring explicit local rules", () => {
    expect(resolveParserMode({ GEMINI_API_KEY: "k" }).effective).toBe("gemini");
    expect(resolveParserMode({ PARSER_MODE: "rules", GEMINI_API_KEY: "k" }).effective).toBe("rules");
  });

  it("never exposes the key value", () => {
    const serialized = JSON.stringify(resolveParserMode({ PARSER_MODE: "gemini", GEMINI_API_KEY: "super-secret" }));
    expect(serialized).not.toContain("super-secret");
  });
});
