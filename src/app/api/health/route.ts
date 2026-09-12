import { API_VERSION, HealthResponseSchema } from "@/contracts";
import { loadCatalogConfig } from "@/catalog/config.server";
import { resolveOrderPersistence } from "@/db/mode.server";
import { resolveParserMode } from "@/parser/mode.server";
export const dynamic = "force-dynamic";
/** Reports what a request will actually reach: effective parser, catalog source and version, persistence mode. */
export async function GET() {
  const config = await loadCatalogConfig();
  const body = HealthResponseSchema.parse({
    v: API_VERSION,
    menuVersion: config.versionId,
    parser: resolveParserMode().effective,
    catalog: { source: config.source, versionId: config.versionId },
    orderPersistence: resolveOrderPersistence(),
  });
  return Response.json(body);
}
