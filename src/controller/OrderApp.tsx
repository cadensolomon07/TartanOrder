"use client";
import type { WaitEngineConfig } from "@/contracts";
import { Kiosk } from "@/ui/Kiosk";
import { useOrderController } from "./useOrderController";

export function OrderApp({ waitConfig }: { waitConfig: WaitEngineConfig }) {
  const controller = useOrderController("188", waitConfig);
  return <Kiosk controller={controller} />;
}
