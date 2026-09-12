// BOOTSTRAP STUB — C owns this file after starter handoff.
import { type InterpretOptions, type ParseRequest, type ParseResponse } from "@/contracts";
import { parseRules } from "./rules";
export async function interpret(req:ParseRequest, options:InterpretOptions):Promise<ParseResponse> {
  if (options.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  // Until C's HTTP client arrives, this always uses the small local rules grammar.
  return parseRules(req);
}
