import { API_VERSION, MENU_VERSION } from "@/contracts";
import { resolveParserMode } from "@/parser/mode.server";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ v: API_VERSION, menuVersion: MENU_VERSION, parser: resolveParserMode().effective });
}
