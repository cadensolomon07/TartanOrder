import { defaultDeps, errorResponse, exportSession, sessionIdFromParams } from "@/persistence/routes.server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
/** GET /api/sessions/[id]/export — the stored session as a replayable ExportLog. */
export async function GET(_request: Request, context: Context): Promise<Response> {
  const sessionId = sessionIdFromParams((await context.params).id);
  if (sessionId === null) return errorResponse(400, "INVALID_REQUEST", null);
  return exportSession(sessionId, defaultDeps());
}
