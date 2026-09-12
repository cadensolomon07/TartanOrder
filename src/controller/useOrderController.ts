"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { type Catalog, type OrderController, type LocationId, type WaitEngineConfig } from "@/contracts";
import { createPersistClient } from "@/persistence/client";
import type { PersistPort } from "@/persistence/port";
import { createOrderController } from "./controller";

/** mode "supabase" without a port builds the same-origin fetch client once; anything else keeps saving off. */
export type PersistenceOptions = { mode?: "supabase" | "off"; port?: PersistPort };

export function useOrderController(catalog: Catalog, locationId: LocationId = "demo", waitConfig?: WaitEngineConfig, allowedLocationIds?: readonly LocationId[], persistence: PersistenceOptions = {}): OrderController {
  const [store] = useState(() => {
    const mode = persistence.mode ?? "off";
    const persist = mode === "supabase" ? persistence.port ?? createPersistClient() : undefined;
    return createOrderController({ catalog, locationId, waitConfig, allowedLocationIds, persist, persistenceMode: mode });
  });
  useEffect(() => () => store.dispose(), [store]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
