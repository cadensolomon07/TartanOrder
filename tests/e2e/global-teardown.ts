// Deletes every server session the run created (ids recorded by fixtures.ts)
// through the secret key, then proves none remain. Runs only when the keys are
// in this process (npm run test:e2e:live); keyless runs create no sessions.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SESSION_LOG } from "./fixtures";

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(SESSION_LOG)) return;
  const ids = [...new Set(readFileSync(SESSION_LOG, "utf8").split("\n").map((line) => line.trim()).filter(Boolean))];
  rmSync(SESSION_LOG, { force: true });
  if (ids.length === 0) return;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEYS;
  if (!url || !key) throw new Error(`${ids.length} server session(s) were created but SUPABASE_URL / SUPABASE_SECRET_KEYS are not in this process; cannot clean up.`);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const deleted = await client.from("sessions").delete().in("id", chunk);
    if (deleted.error) throw new Error(`Could not delete e2e sessions: ${deleted.error.message}`);
  }
  const remaining = await client.from("sessions").select("id").in("id", ids);
  if (remaining.error) throw new Error(`Could not verify e2e cleanup: ${remaining.error.message}`);
  if ((remaining.data ?? []).length > 0) throw new Error(`${remaining.data!.length} e2e session(s) still exist after cleanup.`);
  console.log(`e2e teardown: deleted ${ids.length} server session(s) created by this run.`);
}
