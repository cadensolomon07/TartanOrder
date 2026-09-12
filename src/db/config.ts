// Pure Supabase connection settings shared by the server clients and the seed
// script. Reads nothing itself; callers pass an env record. Never logs values.
export type DbEnv = Readonly<Record<string, string | undefined>>;
export type DbRole = "reader" | "writer";

export const SUPABASE_ENV = {
  url: "SUPABASE_URL",
  reader: "SUPABASE_PUBLISHABLE_KEYS",
  writer: "SUPABASE_SECRET_KEYS",
} as const;

/** Only Supabase's current key formats are accepted; the legacy anon/service_role JWTs are refused. */
export const KEY_PREFIX = { reader: "sb_publishable_", writer: "sb_secret_" } as const;

/** Server processes hold no user session: no persistence, refresh or URL detection. */
export const CLIENT_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

export type SupabaseConnection = { readonly url: string; readonly key: string; readonly role: DbRole };

function read(env: DbEnv, name: string): string {
  const value = (env[name] ?? "").trim();
  if (value.length === 0) throw new SupabaseConfigError(`Missing ${name}. Set it in .env.local or the deployment environment.`);
  return value;
}

/** Validates presence and key format; the returned key is the only place the value travels. */
export function resolveSupabaseConnection(role: DbRole, env: DbEnv): SupabaseConnection {
  const url = read(env, SUPABASE_ENV.url);
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url)) {
    throw new SupabaseConfigError(`${SUPABASE_ENV.url} must be the project's https API URL.`);
  }
  const name = SUPABASE_ENV[role];
  const key = read(env, name);
  if (!key.startsWith(KEY_PREFIX[role])) {
    throw new SupabaseConfigError(`${name} must be a Supabase ${role === "reader" ? "publishable" : "secret"} key (${KEY_PREFIX[role]}…); legacy anon/service_role JWT keys are not accepted.`);
  }
  return { url: url.replace(/\/$/, ""), key, role };
}
