// Server-only: reads process.env. Import from route handlers and server components only.
export type OrderPersistenceMode = "supabase" | "off";
export type EnvLike = Readonly<Record<string, string | undefined>>;

/** ORDER_PERSISTENCE=off disables the write-behind persist port; anything else means Supabase. */
export function resolveOrderPersistence(env: EnvLike = process.env): OrderPersistenceMode {
  return (env.ORDER_PERSISTENCE ?? "").trim() === "off" ? "off" : "supabase";
}
