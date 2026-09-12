"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { type OrderController, type LocationId } from "@/contracts";
import { createOrderController } from "./controller";
export function useOrderController(locationId: LocationId = "demo"):OrderController {
  const [store]=useState(()=>createOrderController({locationId}));
  useEffect(()=>()=>store.dispose(),[store]);
  return useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
}
