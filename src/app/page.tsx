"use client";
import { useOrderController } from "@/controller/useOrderController";
import { Kiosk } from "@/ui/Kiosk";
export default function Home() {
  const controller = useOrderController("188");
  return <Kiosk controller={controller} />;
}
