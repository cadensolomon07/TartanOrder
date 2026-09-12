// Server-only Supabase clients. The reader (publishable key) is subject to Row
// Level Security and reads the public catalog; the writer (secret key) bypasses
// RLS and is used only for session, audit and receipt writes and exports.
// Route handlers and server components only; never imported by client code.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CLIENT_OPTIONS, resolveSupabaseConnection, type DbEnv, type DbRole } from "./config";
import type { Database } from "./types";

export type DbClient = SupabaseClient<Database>;
export type ClientFactory = (url: string, key: string, options: typeof CLIENT_OPTIONS) => DbClient;

const defaultFactory: ClientFactory = (url, key, options) => createClient<Database>(url, key, options);

function build(role: DbRole, env: DbEnv, factory: ClientFactory): DbClient {
  const connection = resolveSupabaseConnection(role, env);
  return factory(connection.url, connection.key, CLIENT_OPTIONS);
}

/** Publishable-key client; RLS applies. Validates env at first use and never logs values. */
export function createReader(env: DbEnv = process.env, factory: ClientFactory = defaultFactory): DbClient {
  return build("reader", env, factory);
}

/** Secret-key client; bypasses RLS. Order tables have no policies, so this is the only way to reach them. */
export function createWriter(env: DbEnv = process.env, factory: ClientFactory = defaultFactory): DbClient {
  return build("writer", env, factory);
}

let reader: DbClient | null = null;
let writer: DbClient | null = null;

export function readerClient(): DbClient {
  reader ??= createReader();
  return reader;
}

export function writerClient(): DbClient {
  writer ??= createWriter();
  return writer;
}
