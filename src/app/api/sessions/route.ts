import { createSession, defaultDeps } from "@/persistence/routes.server";
export const dynamic = "force-dynamic";
/** POST /api/sessions — idempotent session creation bound to the active catalog version. */
export async function POST(request: Request): Promise<Response> {
  return createSession(request, defaultDeps());
}
