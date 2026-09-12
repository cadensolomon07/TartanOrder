// Fails when Supabase key material or the project URL appears in client-served
// build output. Run after `next build`; never prints matching content.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = ".next/static";
const PATTERNS = [/sb_secret_/, /sb_publishable_/, /SUPABASE_SECRET/, /SUPABASE_PUBLISHABLE/, /supabase\.co/];
const envUrl = (process.env.SUPABASE_URL ?? "").trim();
if (envUrl) PATTERNS.push(new RegExp(envUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

let checked = 0;
const hits = [];
try {
  for (const path of files(ROOT)) {
    checked += 1;
    const text = readFileSync(path, "utf8");
    for (const pattern of PATTERNS) if (pattern.test(text)) hits.push(`${path} matches ${pattern.source.slice(0, 24)}`);
  }
} catch (error) {
  console.error(`check-build-secrets: cannot read ${ROOT} (${error.code ?? error.name}); run next build first.`);
  process.exit(2);
}
if (hits.length) {
  console.error(`check-build-secrets: ${hits.length} client asset(s) contain Supabase key material or the project URL:`);
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log(`check-build-secrets: ${checked} client asset(s) under ${ROOT} contain no Supabase key material or project URL.`);
