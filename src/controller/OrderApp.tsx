"use client";
import type { WaitEngineConfig } from "@/contracts";
import { Kiosk } from "@/ui/Kiosk";
import { useOrderController } from "./useOrderController";
import { PUBLIC_LOCATION_IDS } from "@/contracts";

export function OrderApp({ waitConfig }: { waitConfig: WaitEngineConfig }) {
  const controller = useOrderController("188", waitConfig, PUBLIC_LOCATION_IDS);
  return <Kiosk controller={controller} />;
}
