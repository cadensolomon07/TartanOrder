// BOOTSTRAP STUB — C owns this route after starter handoff.
import { ParseRequestSchema } from "@/contracts";
import { parseRules } from "@/parser/rules";
export async function POST(request:Request) {
  const error = (status:number,code:string) => Response.json({v:1,requestId:null,error:{code,message:code,retryable:false}},{status});
  if (Number(request.headers.get("content-length")) > 4096) return error(413,"INPUT_TOO_LARGE");
  const reader = request.body?.getReader();
  let bytes = new Uint8Array(0);
  if (reader) for (;;) {
    const {done,value} = await reader.read();
    if (done) break;
    if (bytes.length + value.length > 4096) { await reader.cancel(); return error(413,"INPUT_TOO_LARGE"); }
    const next = new Uint8Array(bytes.length + value.length); next.set(bytes); next.set(value,bytes.length); bytes=next;
  }
  let body:unknown;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return error(400,"INVALID_REQUEST"); }
  if (typeof body === "object" && body !== null && "menuVersion" in body && body.menuVersion !== "demo-v1") return error(409,"MENU_VERSION_MISMATCH");
  const parsed = ParseRequestSchema.safeParse(body);
  if (!parsed.success) return error(400,"INVALID_REQUEST");
  return Response.json(parseRules(parsed.data));
}
