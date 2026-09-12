"use client";
import type { WaitEngineConfig } from "@/contracts";
import { Kiosk } from "@/ui/Kiosk";
import { useOrderController } from "./useOrderController";
import { ACTIVE_LOCATION_IDS } from "@/contracts/campus";

export function OrderApp({ waitConfig }: { waitConfig: WaitEngineConfig }) {
  const controller = useOrderController("188", waitConfig, ACTIVE_LOCATION_IDS);
  return <Kiosk controller={controller} />;
}
