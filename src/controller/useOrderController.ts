"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { type OrderController, type LocationId, type WaitEngineConfig } from "@/contracts";
import { createOrderController } from "./controller";
export function useOrderController(locationId: LocationId = "demo", waitConfig?: WaitEngineConfig):OrderController {
  const [store]=useState(()=>createOrderController({locationId, waitConfig}));
  useEffect(()=>()=>store.dispose(),[store]);
  return useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
}
