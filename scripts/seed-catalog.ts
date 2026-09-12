// Seed the released catalog into the TartanHacks Supabase project.
//   node --env-file-if-exists=.env.local --import tsx scripts/seed-catalog.ts --sql supabase/seed.sql
//   node --env-file-if-exists=.env.local --import tsx scripts/seed-catalog.ts --apply
// --sql writes idempotent SQL for the record; --apply inserts through the secret-key
// writer with ON CONFLICT DO NOTHING semantics (safe to re-run; the immutability
// trigger is never hit), then activates the version. Prints counts only, never keys.
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { bundledCatalog } from "@/catalog/bundled";
import { CLIENT_OPTIONS, resolveSupabaseConnection } from "@/db/config";
import { seedRows, seedSql } from "@/db/seed-rows";

const BATCH = 200;

async function apply(): Promise<void> {
  const connection = resolveSupabaseConnection("writer", process.env);
  const client = createClient(connection.url, connection.key, CLIENT_OPTIONS);
  const rows = seedRows(bundledCatalog());
  const fail = (table: string, error: { message: string } | null) => { if (error) throw new Error(`${table}: ${error.message}`); };
  fail("catalog_versions", (await client.from("catalog_versions").upsert([rows.version], { ignoreDuplicates: true })).error);
  const tables: [string, readonly Record<string, unknown>[]][] = [
    ["locations", rows.locations], ["modifiers", rows.modifiers], ["items", rows.items], ["menu_previews", rows.previews],
  ];
  for (const [table, all] of tables) {
    for (let start = 0; start < all.length; start += BATCH) {
      fail(table, (await client.from(table).upsert(all.slice(start, start + BATCH), { ignoreDuplicates: true })).error);
    }
    console.log(`${table}: ${all.length} rows submitted`);
  }
  fail("catalog_versions", (await client.from("catalog_versions").update({ is_active: false }).eq("is_active", true).neq("id", rows.version.id)).error);
  fail("catalog_versions", (await client.from("catalog_versions").update({ is_active: true }).eq("id", rows.version.id)).error);
  console.log(`catalog version ${rows.version.id} is active`);
}

const args = process.argv.slice(2);
const sqlIndex = args.indexOf("--sql");
if (sqlIndex >= 0) {
  const target = args[sqlIndex + 1] ?? "supabase/seed.sql";
  writeFileSync(target, seedSql(bundledCatalog()));
  console.log(`wrote ${target}`);
}
if (args.includes("--apply")) {
  apply().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(2); });
}
if (sqlIndex < 0 && !args.includes("--apply")) {
  console.error("usage: seed-catalog.ts [--sql <file>] [--apply]");
  process.exit(1);
}
