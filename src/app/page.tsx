import { OrderApp } from "@/controller/OrderApp";
import { loadWaitConfiguration } from "@/waits/config.server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const waitConfig = await loadWaitConfiguration();
  return <OrderApp waitConfig={waitConfig} />;
}
