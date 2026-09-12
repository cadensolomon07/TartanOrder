import { z } from "zod";
import { LocationIdSchema } from "@/contracts";
import { WaitTimeSnapshotSchema, type WaitTimeSnapshot } from "@/contracts/waits";
import seed from "../../config/wait-times.seed.json";

export interface WaitTimeProvider {
  getSnapshot(): Promise<WaitTimeSnapshot>;
}

export class SeededWaitTimes implements WaitTimeProvider {
  readonly unavailableReason = null;
  private readonly snapshot: WaitTimeSnapshot;

  constructor(value: unknown = seed) {
    this.snapshot = WaitTimeSnapshotSchema.parse(value);
  }

  async getSnapshot(): Promise<WaitTimeSnapshot> {
    return structuredClone(this.snapshot);
  }
}

export const DINING_LOCATIONS_URL = "https://api.cmueats.com/v2/locations";
export const NO_API_WAIT_DATA = "The dining API does not publish wait times. No wait-time suggestions are available.";
const DirectorySchema = z.array(z.object({ conceptId: z.string().min(1), name: z.string().min(1) })).min(1).max(500);
const MAX_DIRECTORY_BYTES = 256 * 1024;

export function unavailableSnapshot(asOf: string, id = "dining-api-waits-unavailable"): WaitTimeSnapshot {
  return WaitTimeSnapshotSchema.parse({ id, source: "api", asOf,
    waits: Object.fromEntries(LocationIdSchema.options.map((vendorId) => [vendorId, null])),
  });
}

type DiningApiOptions = { fetchImpl?: typeof fetch; now?: () => Date; timeoutMs?: number };

/** Directory availability never implies measured queue data. No undocumented endpoint. */
export class DiningApiWaitTimes implements WaitTimeProvider {
  unavailableReason: string = NO_API_WAIT_DATA;
  private readonly options: DiningApiOptions;

  constructor(options: DiningApiOptions = {}) { this.options = options; }

  async getSnapshot(): Promise<WaitTimeSnapshot> {
    const asOf = (this.options.now?.() ?? new Date()).toISOString();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("DIRECTORY_TIMEOUT"));
      }, this.options.timeoutMs ?? 2000);
    });
    try {
      await Promise.race([this.readDirectory(controller.signal), deadline]);
      this.unavailableReason = NO_API_WAIT_DATA;
    } catch {
      this.unavailableReason = "The dining API could not be checked or validated. Wait times are unavailable.";
    } finally {
      clearTimeout(timer);
    }
    // asOf records this directory check, not a queue observation. Unknown stays null.
    return unavailableSnapshot(asOf);
  }

  private async readDirectory(signal: AbortSignal): Promise<void> {
    const response = await (this.options.fetchImpl ?? fetch)(DINING_LOCATIONS_URL, { signal, cache: "no-store" });
    if (!response.ok || !response.body) throw new Error("DIRECTORY_UNAVAILABLE");
    const reader = response.body.getReader();
    const cancel = () => { void reader.cancel().catch(() => undefined); };
    signal.addEventListener("abort", cancel, { once: true });
    const decoder = new TextDecoder();
    let size = 0;
    let text = "";
    try {
      while (true) {
        if (signal.aborted) throw new Error("DIRECTORY_TIMEOUT");
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > MAX_DIRECTORY_BYTES) throw new Error("DIRECTORY_TOO_LARGE");
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
      DirectorySchema.parse(JSON.parse(text));
    } finally {
      signal.removeEventListener("abort", cancel);
      cancel();
    }
  }
}
