import { LIMITS, type ItemId, type Line, type ModifierId, type Op, type ParseRequest, type ParseResult, type Ref } from "@/contracts";
import { MENU } from "@/contracts/menu";
import { guardCampusQuantities, normalizeCampusName } from "./campus.rules";
import { guardTranscript } from "./rules/guards";

type Rejection = Extract<ParseResult, { kind: "reject" }>;
type NoteIntent = { target: string; note: string; mode: "add" | "append" | "replace" | "remove" | "clear" };
const reject = (code: Rejection["code"], message: string): Rejection => ({ kind: "reject", code, message });
const clean = (text: string) => text.normalize("NFKC").trim().replace(/[.!?]+$/, "").trim();
const clauses = (text: string) => text.split(/\s*(?:;|,|\band\b)\s*/i).map(clean).filter(Boolean);
const key = (text: string) => normalizeCampusName(text);
const common = "extra (?:ice|salt)";

/** Narrow offline syntax; the rest of the utterance still uses the ordinary parser. */
function noteIntent(raw: string): NoteIntent | null {
  const text = clean(raw).replace(/^please\s+/i, "");
  let match = text.match(/^(?:clear|remove|delete) (?:the )?(?:notes?|special requests?) (?:on|from|for) (.+)$/i);
  if (match) return { target: match[1], note: "", mode: "clear" };
  match = text.match(/^(?:set|change|replace) (?:the )?note (?:on|for) (.+?)\s*(?:to |:)(.+)$/i);
  if (match) return { target: match[1], note: clean(match[2]), mode: "replace" };
  match = text.match(/^(?:add|append)(?: a)? note (?:to|on|for) (.+?):\s*(.+)$/i);
  if (match) return { target: match[1], note: clean(match[2]), mode: "append" };
  match = text.match(new RegExp(`^(?:put|add|request)(?: some)? (${common}) (?:on|in|for) (.+)$`, "i"));
  if (match) return { target: match[2], note: clean(match[1]), mode: "append" };
  match = text.match(new RegExp(`^(?:remove|take off) (${common}) (?:from|on) (.+)$`, "i"));
  if (match) return { target: match[2], note: clean(match[1]), mode: "remove" };
  match = text.match(/^(.+?)[,;]\s*(?:special request|note)\s*:\s*(.+)$/i)
    ?? text.match(/^(.+?)\s+with (?:a )?note\s*:\s*(.+)$/i)
    ?? text.match(new RegExp(`^(.+?) with (${common})$`, "i"));
  if (!match) return null;
  return { target: match[1], note: clean(match[2]), mode: /^(?:the|my)\s/i.test(match[1]) ? "append" : "add" };
}

const modifierNames: [RegExp, ModifierId][] = [
  [/^(?:no|without) onions?$/i, "no_onions"], [/^(?:no|without) lettuce$/i, "no_lettuce"],
  [/^(?:no|without) mayo(?:nnaise)?$/i, "no_mayo"], [/^(?:no|without) ice$/i, "no_ice"],
  [/^double(?: (?:meat|burger|patty))?$/i, "double"], [/^extra cheese$/i, "extra_cheese"],
  [/^dressing on (?:the )?side$/i, "dressing_on_side"],
];

/** Notes stay plain, bounded text; the engine never executes or prices them. */
export function noteTextError(note: string): string | null {
  return note.length > LIMITS.noteChars ? `Keep a special request within ${LIMITS.noteChars} characters.` : null;
}

function configuration(note: string, itemId: ItemId): { note: string; modifiers: ModifierId[] } | Rejection {
  const modifiers: ModifierId[] = [];
  const notes: string[] = [];
  for (const clause of clauses(note)) {
    const modifier = modifierNames.find(([pattern]) => pattern.test(clause))?.[1];
    if (modifier) {
      if (MENU[itemId].allowedModifiers.includes(modifier)) {
        modifiers.push(modifier);
        continue;
      }
      if (modifier === "double" || modifier === "extra_cheese") return reject("INVALID_MODIFIER", "That item does not support this priced menu option. Choose a listed option instead.");
    }
    const invalid = noteTextError(clause);
    if (invalid) return reject("UNSUPPORTED", invalid);
    notes.push(clause);
  }
  return { note: notes.join("; "), modifiers: [...new Set(modifiers)] };
}

function targetLines(target: string, req: ParseRequest): Line[] {
  const cart = req.context?.lines ?? [];
  const name = key(target.replace(/^(?:the|my)\s+/i, ""));
  if (["it", "that", "that one", "last", "last one", "last item"].includes(name)) return cart.filter(line => line.lineId === req.context?.lastLineId);
  const exact = cart.filter(line => [MENU[line.itemId].label, ...MENU[line.itemId].aliases].some(alias => key(alias) === name));
  return exact.length ? exact : cart.filter(line => [MENU[line.itemId].label, ...MENU[line.itemId].aliases].some(alias => ` ${key(alias)} `.includes(` ${name} `)));
}

function editOps(intent: NoteIntent, line: Line): Op[] | Rejection {
  const ref: Ref = { by: "line", lineId: line.lineId };
  if (intent.mode === "clear") return [{ type: "SET_NOTE", ref, note: "" }];
  const parsed = configuration(intent.note, line.itemId);
  if ("kind" in parsed) return parsed;
  const old = clauses(line.note ?? "");
  const incoming = clauses(parsed.note);
  const retained = intent.mode === "replace" ? [] : old.filter(clause => intent.mode !== "remove" || !incoming.some(value => key(value) === key(clause)));
  const note = [...retained, ...(intent.mode === "remove" ? [] : incoming.filter(clause => !retained.some(value => key(value) === key(clause))))].join("; ");
  if (note.length > LIMITS.noteChars) return reject("UNSUPPORTED", `The combined note is too long. Explicitly replace or shorten it to ${LIMITS.noteChars} characters.`);
  const ops: Op[] = parsed.modifiers.map(modifier => ({ type: "MOD", ref, modifier, enabled: intent.mode !== "remove" }));
  // A modifier-only request leaves any unrelated note untouched.
  if (incoming.length || intent.mode === "replace" || !ops.length) ops.push({ type: "SET_NOTE", ref, note });
  return ops;
}

/** Returns null for wording outside this narrow note grammar; never partially applies it. */
export function parseNoteText(req: ParseRequest, parseBase: (req: ParseRequest) => ParseResult | null): ParseResult | null {
  const intent = noteIntent(req.text);
  if (!intent) return null;
  if (/\b(?:only if|otherwise|guarantee\w*)\b/i.test(req.text)) return { kind: "clarify", question: "Special requests are unverified. Would you still like the item if the counter cannot fulfill the request?", choices: [] };
  const guarded = (req.locationId ?? "demo") === "demo" ? guardTranscript(req.text) : guardCampusQuantities(req);
  if (guarded) return guarded;
  if (intent.note.length > LIMITS.noteChars) return reject("UNSUPPORTED", `Keep a special request within ${LIMITS.noteChars} characters.`);
  if (intent.mode === "add") {
    const result = parseBase({ ...req, text: intent.target });
    if (!result) return null;
    const attach = (ops: Op[]): Op[] | Rejection => {
      const index = ops.map(op => op.type).lastIndexOf("ADD");
      const op = ops[index];
      if (!op || op.type !== "ADD" || index !== ops.length - 1) return reject("UNSUPPORTED", "Name the item and its special request together.");
      const parsed = configuration(intent.note, op.itemId);
      if ("kind" in parsed) return parsed;
      return ops.map((value, position) => position === index ? { ...op, modifiers: [...new Set([...op.modifiers, ...parsed.modifiers])], ...(parsed.note ? { note: parsed.note } : {}) } : value);
    };
    if (result.kind === "proposal") {
      const ops = attach(result.ops);
      return Array.isArray(ops) ? { ...result, ops } : ops;
    }
    if (result.kind === "clarify") {
      const choices = [];
      for (const choice of result.choices) {
        const ops = attach(choice.ops);
        if (!Array.isArray(ops)) return ops;
        choices.push({ ...choice, ops });
      }
      return { ...result, choices };
    }
    return result;
  }
  const lines = targetLines(intent.target, req);
  if (!lines.length) return reject("UNKNOWN_REFERENCE", "That item is not in your cart. Choose its cart row for the special request.");
  if (lines.length > LIMITS.choices) return reject("AMBIGUOUS_REFERENCE", "Several cart rows match. Choose one row before adding the special request.");
  const choices = [];
  for (const [index, line] of lines.entries()) {
    const ops = editOps(intent, line);
    if (!Array.isArray(ops)) return ops;
    choices.push({ id: `note-line-${index + 1}`, label: `${MENU[line.itemId].label} (cart row ${(req.context?.lines.indexOf(line) ?? 0) + 1})`.slice(0, LIMITS.labelChars), ops });
  }
  return choices.length === 1 ? { kind: "proposal", ops: choices[0].ops } : { kind: "clarify", question: "Which cart row should receive this special request?", choices };
}

/** Semantic validation for newly emitted model notes, after the shared strict schema. */
export function modelNoteError(op: Op, req: ParseRequest): string | null {
  if (op.type !== "SET_NOTE" && !(op.type === "ADD" && op.note !== undefined)) return null;
  const note = op.note!;
  const invalid = noteTextError(note);
  if (invalid) return invalid;
  const lines = op.type === "SET_NOTE" ? (req.context?.lines ?? []).filter(line => op.ref.by === "line" ? line.lineId === op.ref.lineId : op.ref.by === "item" ? line.itemId === op.ref.itemId : line.lineId === req.context?.lastLineId) : [];
  const items = op.type === "ADD" ? [op.itemId] : lines.map(line => line.itemId);
  // Exact known options have real configuration semantics. Other text is an
  // unverified staff request; natural paraphrases are interpreted by Gemini,
  // not vetoed by the deliberately narrow offline note grammar.
  const modifier = modifierNames.find(([pattern]) => pattern.test(note))?.[1];
  if (modifier && items.some(itemId => MENU[itemId].allowedModifiers.includes(modifier))) {
    return "A listed menu modifier must be represented as a modifier, not a note.";
  }
  return null;
}
