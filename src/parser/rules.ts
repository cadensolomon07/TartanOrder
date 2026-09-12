import {
  API_VERSION,
  ParseRequestSchema,
  ParseResponseSchema,
  type ParseRequest,
  type ParseResponse,
  type ParseResult,
} from "@/contracts";
import { MENU } from "@/contracts/menu";
import { buildBatch } from "./rules/batch";
import { guardTranscript } from "./rules/guards";
import { MESSAGES, reject, type Rejection } from "./rules/messages";
import { normalizeText, splitClauses } from "./rules/normalize";
import { findNearMisses, joinNearMissPhrases } from "./rules/phonetic";
import { parseCampusText } from "./campus.rules";

export type RulesOptions = { phonetic: boolean };
export const DEFAULT_RULES_OPTIONS: RulesOptions = { phonetic: true };
export type { Rejection };
export { guardTranscript };

/** A single near-miss becomes a clarification with the whole batch substituted; never an auto-apply (D11). */
function recoverPhonetically(clauses: readonly string[], original: Rejection): ParseResult {
  const near = findNearMisses(clauses);
  if (near.count === 0 || near.itemId === null) return original;
  if (near.count > 1) return reject("UNSUPPORTED", MESSAGES.phoneticMany);
  const retry = buildBatch(near.clauses);
  if (!Array.isArray(retry)) return retry;
  const label = MENU[near.itemId].label;
  return { kind: "clarify", question: `Did you mean ${label.toLowerCase()}?`, choices: [{ id: "option-1", label, ops: retry }] };
}

/** normalize → guards (whole string) → clause split → left-to-right batch with corrections → fail closed. */
function interpretText(text: string, options: RulesOptions): ParseResult {
  const normalized = normalizeText(text);
  if (normalized.length === 0) return reject("UNSUPPORTED", MESSAGES.blank);
  const guarded = guardTranscript(normalized);
  if (guarded) return guarded;
  const clauses = splitClauses(joinNearMissPhrases(normalized));
  const batch = buildBatch(clauses);
  if (Array.isArray(batch)) return { kind: "proposal", ops: batch };
  return options.phonetic ? recoverPhonetically(clauses, batch) : batch;
}

/**
 * Pure rules parser: no network, clock, randomness or prices. Campus references
 * use only supplied cart context. Throws on an invalid request.
 */
export function parseRulesWith(req: ParseRequest, options: RulesOptions): ParseResponse {
  const request = ParseRequestSchema.parse(req);
  const envelope = {
    v: API_VERSION,
    requestId: request.requestId,
    baseRevision: request.baseRevision,
    menuVersion: request.menuVersion,
    parser: "rules" as const,
    fallbackReason: null,
  };
  const result = (request.locationId ?? "demo") === "demo" ? interpretText(request.text, options) : parseCampusText(request);
  const checked = ParseResponseSchema.safeParse({ ...envelope, result });
  if (checked.success) return checked.data;
  return { ...envelope, result: reject("INVALID_SCHEMA", MESSAGES.invalidSchema) };
}

export function parseRules(req: ParseRequest): ParseResponse {
  return parseRulesWith(req, DEFAULT_RULES_OPTIONS);
}
