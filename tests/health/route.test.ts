import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { HealthResponseSchema } from "@/contracts";
import { GET } from "@/app/api/health/route";
import { CATALOG } from "../helpers/catalog";

describe("/api/health", () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it("reports the bundled catalog, its version, the effective parser and persistence mode", async () => {
    vi.stubEnv("CATALOG_SOURCE", "bundled");
    vi.stubEnv("PARSER_MODE", "rules");
    vi.stubEnv("ORDER_PERSISTENCE", "off");
    const body = HealthResponseSchema.parse(await (await GET()).json());
    expect(body).toEqual({ v: 3, menuVersion: CATALOG.versionId, parser: "rules", catalog: { source: "bundled", versionId: CATALOG.versionId }, orderPersistence: "off" });
  });

  it("defaults persistence to supabase", async () => {
    vi.stubEnv("CATALOG_SOURCE", "bundled");
    vi.stubEnv("ORDER_PERSISTENCE", "");
    const body = HealthResponseSchema.parse(await (await GET()).json());
    expect(body.orderPersistence).toBe("supabase");
  });
});
