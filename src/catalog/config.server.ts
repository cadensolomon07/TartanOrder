// Server page bootstrap and route handlers only. Reads CATALOG_SOURCE here and
// nowhere else. Mirrors src/waits/config.server.ts: an explicit, labelled source
// and an honest unavailable state; bundled data never silently replaces a
// failed database load.
import { CatalogSourceSchema, type Catalog, type CatalogSource } from "@/contracts";
import { bundledCatalog } from "./bundled";

export type CatalogConfig = {
  readonly catalog: Catalog | null;
  readonly source: CatalogSource;
  readonly versionId: string | null;
  readonly unavailableReason: string | null;
};

export type EnvLike = Readonly<Record<string, string | undefined>>;

export function resolveCatalogSource(env: EnvLike = process.env): CatalogSource {
  const configured = (env.CATALOG_SOURCE ?? "supabase").trim();
  const parsed = CatalogSourceSchema.safeParse(configured);
  return parsed.success && parsed.data !== "unavailable" ? parsed.data : "unavailable";
}

function unavailable(reason: string): CatalogConfig {
  return { catalog: null, source: "unavailable", versionId: null, unavailableReason: reason };
}

export type CatalogLoader = () => Promise<Catalog>;

/** Messages may reach logs and the health route: no key material, no stack, bounded length. */
function safeReason(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown error";
  return message.replace(/sb_[a-z]+_[A-Za-z0-9_-]+/g, "[key]").slice(0, 160);
}

/** Pure given `env`; `loader` defaults to the publishable-key reader in src/db/catalog.server.ts. */
export async function loadCatalogConfig(env: EnvLike = process.env, loader?: CatalogLoader): Promise<CatalogConfig> {
  const source = resolveCatalogSource(env);
  if (source === "bundled") {
    const catalog = bundledCatalog();
    return { catalog, source: "bundled", versionId: catalog.versionId, unavailableReason: null };
  }
  if (source === "supabase") {
    try {
      const load = loader ?? (await import("@/db/catalog.server")).loadActiveCatalog;
      const catalog = await load();
      return { catalog, source: "supabase", versionId: catalog.versionId, unavailableReason: null };
    } catch (error) {
      return unavailable(`The Supabase catalog could not be loaded (${safeReason(error)}). The menu is unavailable.`);
    }
  }
  return unavailable("CATALOG_SOURCE is not configured correctly. The menu is unavailable.");
}
