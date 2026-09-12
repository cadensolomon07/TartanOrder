import { API_VERSION, MENU_VERSION } from "@/contracts";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ v: API_VERSION, menuVersion: MENU_VERSION, parser: "rules" });
}
