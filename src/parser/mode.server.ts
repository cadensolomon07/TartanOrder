// Server-only: reads process.env. Import from route handlers, never from client code.

export type ParserMode = "rules" | "gemini";

export type ParserModeReport = {
  /** What `PARSER_MODE` asks for. Anything other than "gemini" means rules. */
  readonly configured: ParserMode;
  /** Whether a non-empty `GEMINI_API_KEY` is present. Never the key itself. */
  readonly keyPresent: boolean;
  /**
   * The parser a well-formed request will actually reach. Gemini is only effective when it is
   * both configured and has a key; otherwise the route returns 503 and the client falls back
   * to rules, so the honest answer for `/api/health` is "rules".
   */
  readonly effective: ParserMode;
};

export type EnvLike = Readonly<Record<string, string | undefined>>;

/** Pure given `env`; the health route can call `resolveParserMode().effective`. */
export function resolveParserMode(env: EnvLike = process.env): ParserModeReport {
  const configured: ParserMode = env.PARSER_MODE === "gemini" ? "gemini" : "rules";
  const keyPresent = (env.GEMINI_API_KEY ?? "").trim().length > 0;
  return { configured, keyPresent, effective: configured === "gemini" && keyPresent ? "gemini" : "rules" };
}
