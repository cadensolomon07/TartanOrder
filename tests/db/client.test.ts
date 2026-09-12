import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { CLIENT_OPTIONS, SupabaseConfigError, resolveSupabaseConnection } from "@/db/config";
import { createReader, createWriter, type ClientFactory } from "@/db/client.server";

const URL = "https://rdjcqtpusbjxgigprpns.supabase.co";
const PUBLISHABLE = "sb_publishable_testpublishable0000000000000000";
const SECRET = "sb_secret_testsecret000000000000000000000";
const env = { SUPABASE_URL: URL, SUPABASE_PUBLISHABLE_KEYS: PUBLISHABLE, SUPABASE_SECRET_KEYS: SECRET };

function factory() {
  const calls: { url: string; key: string; options: unknown }[] = [];
  const make: ClientFactory = (url, key, options) => { calls.push({ url, key, options }); return { tag: calls.length } as never; };
  return { calls, make };
}

describe("Supabase server clients", () => {
  it("fails fast with a named error when env is missing, without echoing values", () => {
    expect(() => resolveSupabaseConnection("reader", {})).toThrow(SupabaseConfigError);
    expect(() => resolveSupabaseConnection("reader", {})).toThrow(/SUPABASE_URL/);
    const noKey = { SUPABASE_URL: URL };
    expect(() => createReader(noKey, factory().make)).toThrow(/SUPABASE_PUBLISHABLE_KEYS/);
    expect(() => createWriter(noKey, factory().make)).toThrow(/SUPABASE_SECRET_KEYS/);
    try { createWriter({ ...env, SUPABASE_SECRET_KEYS: "" }, factory().make); } catch (error) {
      expect((error as Error).name).toBe("SupabaseConfigError");
      expect((error as Error).message).not.toContain(PUBLISHABLE);
    }
  });

  it("refuses legacy anon/service_role JWT keys and non-project URLs", () => {
    const legacy = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legacy.jwt";
    expect(() => createReader({ ...env, SUPABASE_PUBLISHABLE_KEYS: legacy }, factory().make)).toThrow(/legacy anon\/service_role/);
    expect(() => createWriter({ ...env, SUPABASE_SECRET_KEYS: legacy }, factory().make)).toThrow(/legacy anon\/service_role/);
    expect(() => createReader({ ...env, SUPABASE_URL: "http://example.com" }, factory().make)).toThrow(/https API URL/);
  });

  it("builds the reader from the publishable key and the writer from the secret key with sessions disabled", () => {
    const reader = factory();
    createReader({ ...env, SUPABASE_URL: `${URL}/` }, reader.make);
    expect(reader.calls).toEqual([{ url: URL, key: PUBLISHABLE, options: CLIENT_OPTIONS }]);
    const writer = factory();
    createWriter(env, writer.make);
    expect(writer.calls).toEqual([{ url: URL, key: SECRET, options: CLIENT_OPTIONS }]);
    expect(reader.calls.some((call) => call.key === SECRET)).toBe(false);
    expect(CLIENT_OPTIONS.auth).toEqual({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
  });
});
