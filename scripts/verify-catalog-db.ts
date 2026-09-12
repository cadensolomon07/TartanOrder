// Read-only check of the deployed catalog through the publishable-key reader:
//   node --env-file-if-exists=.env.local --import tsx scripts/verify-catalog-db.ts
// Confirms the active version and counts, and that RLS hides every order table
// from the publishable key. Prints counts only, never keys. Exit 1 on mismatch.
import { createClient } from "@supabase/supabase-js";
import { CLIENT_OPTIONS, resolveSupabaseConnection } from "@/db/config";

async function main(): Promise<void> {
  const connection = resolveSupabaseConnection("reader", process.env);
  const client = createClient(connection.url, connection.key, CLIENT_OPTIONS);
  const count = async (table: string, eq?: readonly [string, boolean]) => {
    let query = client.from(table).select("*", { count: "exact", head: true });
    if (eq) query = query.eq(eq[0], eq[1]);
    const { count: total, error } = await query;
    if (error) throw new Error(`${table}: ${error.message || JSON.stringify({ code: error.code, details: error.details, hint: error.hint })}`);
    return total ?? 0;
  };
  const report = {
    activeVersions: await count("catalog_versions", ["is_active", true]),
    locations: await count("locations"),
    modifiers: await count("modifiers"),
    items: await count("items"),
    previews: await count("menu_previews"),
    sessionsVisibleToReader: await count("sessions"),
    auditEventsVisibleToReader: await count("audit_events"),
    receiptsVisibleToReader: await count("receipts"),
  };
  console.log(JSON.stringify(report));
  const ok = report.activeVersions === 1 && report.locations === 46 && report.modifiers === 7 && report.items === 506 && report.previews === 50
    && report.sessionsVisibleToReader === 0 && report.auditEventsVisibleToReader === 0 && report.receiptsVisibleToReader === 0;
  if (!ok) { console.error("catalog database check FAILED"); process.exit(1); }
  console.log("catalog database check passed");
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(2); });
