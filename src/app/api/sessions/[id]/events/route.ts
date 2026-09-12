import { appendEvents, defaultDeps, errorResponse, sessionIdFromParams } from "@/persistence/routes.server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
/** POST /api/sessions/[id]/events — append audit entries; duplicates are idempotent, gaps are 409. */
export async function POST(request: Request, context: Context): Promise<Response> {
  const sessionId = sessionIdFromParams((await context.params).id);
  if (sessionId === null) return errorResponse(400, "INVALID_REQUEST", null);
  return appendEvents(request, sessionId, defaultDeps());
}
