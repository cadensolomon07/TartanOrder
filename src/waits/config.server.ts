// Server page bootstrap only. Environment mode is never read in a client module.
import { WaitEngineConfigSchema, type WaitEngineConfig } from "@/contracts/waits";
import equivalents from "../../config/equivalents.json";
import { DiningApiWaitTimes, SeededWaitTimes, unavailableSnapshot } from "./providers";

type ConfigurationOptions = { mode?: string; now?: () => Date; fetchImpl?: typeof fetch; timeoutMs?: number };

export async function loadWaitConfiguration(options: ConfigurationOptions = {}): Promise<WaitEngineConfig> {
  const mode = options.mode ?? process.env.WAIT_TIME_MODE ?? "seeded";
  const now = options.now ?? (() => new Date());
  const provider = mode === "seeded" ? new SeededWaitTimes() : new DiningApiWaitTimes({ ...options, now });
  const supported = mode === "seeded" || mode === "api";
  const snapshot = supported ? await provider.getSnapshot() : unavailableSnapshot(now().toISOString(), "invalid-wait-mode");
  return WaitEngineConfigSchema.parse({
    snapshot,
    available: mode === "seeded",
    unavailableReason: supported ? provider.unavailableReason : "The wait-time mode is not configured correctly. Wait times are unavailable.",
    evaluatedAt: now().toISOString(),
    groups: equivalents.groups,
    nearbyPairs: equivalents.nearbyPairs,
    swapThresholdMinutes: 5,
    priceToleranceCents: 100,
  });
}
