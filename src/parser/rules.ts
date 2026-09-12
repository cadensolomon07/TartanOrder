// BOOTSTRAP STUB — handed to C with the starter. Replace/extend in work/c-parser.
// This performs a deliberately small real rules grammar; it never claims fixture success.
import { ParseRequestSchema, ParseResponseSchema, type Op, type ParseRequest, type ParseResponse, type ItemId } from "@/contracts";
import { MENU } from "@/contracts/menu";
const item = (value: string): ItemId | undefined => Object.values(MENU).find(entry=>entry.aliases.includes(value))?.id;
export function parseRules(req: ParseRequest): ParseResponse {
  ParseRequestSchema.parse(req);
  const text = req.text.trim().toLowerCase().replace(/[.!?]+$/, "");
  const envelope = {v:1 as const, requestId:req.requestId, baseRevision:req.baseRevision, menuVersion:req.menuVersion, parser:"rules" as const, fallbackReason:null};
  const reject = (code:string,message:string):ParseResponse => ParseResponseSchema.parse({...envelope,result:{kind:"reject",code,message}});
  let ops:Op[] = [];
  if (text === "undo") ops = [{type:"UNDO"}];
  else if (/^make (?:the )?burger (?:a )?double$/.test(text)) ops = [{type:"MOD",ref:{by:"item",itemId:"burger"},modifier:"double",enabled:true}];
  else if (/^remove (?:the )?(burger|fries|lemonade)$/.test(text)) {
    const id = item(text.replace(/^remove (?:the )?/, ""))!;
    ops = [{type:"REMOVE",ref:{by:"item",itemId:id}}];
  } else {
    const chunks = text.replace(/^(?:add|get|order) /, "").split(/,\s*|\s+and\s+/).filter(Boolean);
    for (const chunk of chunks) {
      const match = chunk.trim().match(/^(?:(a|an|one|two|three|four|five|\d+) )?(burger|cheeseburger|fries|french fries|lemonade|lemon drink)s?$/);
      if (!match) return reject("UNSUPPORTED", "Try: a burger, fries and lemonade; make the burger a double; remove burger; or undo.");
      const qty = ({a:1,an:1,one:1,two:2,three:3,four:4,five:5} as Record<string,number>)[match[1]] ?? Number(match[1] || 1);
      if (!Number.isInteger(qty) || qty < 1 || qty > 5) return reject("QUANTITY_LIMIT", "Choose a quantity from 1 to 5. Quantities are never clamped.");
      ops.push({type:"ADD",itemId:item(match[2])!,qty,modifiers:[]});
    }
  }
  if (!ops.length || ops.length>8) return reject("UNSUPPORTED", "Use between one and eight edits at a time.");
  return ParseResponseSchema.parse({...envelope,result:{kind:"proposal",ops}});
}
