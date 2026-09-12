// Read-only check of the deployed catalog through the publishable-key reader:
//   node --env-file-if-exists=.env.local --import tsx scripts/verify-catalog-db.ts
// Confirms that exactly one version is active, that it is the bundled release
// version with the same row counts, and that RLS hides every order table from
// the publishable key. Prints counts only, never keys. Exit 1 on mismatch.
import { createClient } from "@supabase/supabase-js";
import { bundledCatalog } from "@/catalog/bundled";
import { CLIENT_OPTIONS, resolveSupabaseConnection } from "@/db/config";

async function main(): Promise<void> {
  const connection = resolveSupabaseConnection("reader", process.env);
  const client = createClient(connection.url, connection.key, CLIENT_OPTIONS);
  const bundled = bundledCatalog();
  const count = async (table: string, eq?: readonly [string, string | boolean]) => {
    let query = client.from(table).select("*", { count: "exact", head: true });
    if (eq) query = query.eq(eq[0], eq[1]);
    const { count: total, error } = await query;
    if (error) throw new Error(`${table}: ${error.message || JSON.stringify({ code: error.code, details: error.details, hint: error.hint })}`);
    return total ?? 0;
  };
  const active = await client.from("catalog_versions").select("id").eq("is_active", true);
  if (active.error) throw new Error(`catalog_versions: ${active.error.message}`);
  const activeIds = (active.data ?? []).map((row) => row.id);
  const versionId = activeIds[0] ?? null;
  const scoped = (table: string) => versionId === null ? Promise.resolve(0) : count(table, ["version_id", versionId]);
  const report = {
    activeVersions: activeIds.length,
    activeVersionId: versionId,
    bundledVersionId: bundled.versionId,
    locations: await scoped("locations"),
    modifiers: await scoped("modifiers"),
    items: await scoped("items"),
    previews: await scoped("menu_previews"),
    sessionsVisibleToReader: await count("sessions"),
    auditEventsVisibleToReader: await count("audit_events"),
    receiptsVisibleToReader: await count("receipts"),
  };
  console.log(JSON.stringify(report));
  const ok = report.activeVersions === 1 && report.activeVersionId === bundled.versionId
    && report.locations === bundled.locations.length && report.modifiers === bundled.modifiers.length
    && report.items === bundled.items.length && report.previews === bundled.previews.length
    && report.sessionsVisibleToReader === 0 && report.auditEventsVisibleToReader === 0 && report.receiptsVisibleToReader === 0;
  if (!ok) { console.error("catalog database check FAILED"); process.exit(1); }
  console.log("catalog database check passed");
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(2); });
