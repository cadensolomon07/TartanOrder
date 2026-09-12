"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { type OrderController } from "@/contracts";
import { createOrderController } from "./controller";
export function useOrderController():OrderController {
  const [store]=useState(()=>createOrderController());
  useEffect(()=>()=>store.dispose(),[store]);
  return useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
}
