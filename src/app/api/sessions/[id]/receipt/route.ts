import { defaultDeps, errorResponse, saveReceipt, sessionIdFromParams } from "@/persistence/routes.server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
/** POST /api/sessions/[id]/receipt — idempotent receipt save for a stored session. */
export async function POST(request: Request, context: Context): Promise<Response> {
  const sessionId = sessionIdFromParams((await context.params).id);
  if (sessionId === null) return errorResponse(400, "INVALID_REQUEST", null);
  return saveReceipt(request, sessionId, defaultDeps());
}
