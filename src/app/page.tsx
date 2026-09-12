import { OrderApp } from "@/controller/OrderApp";
import { loadCatalogConfig } from "@/catalog/config.server";
import { resolveOrderPersistence } from "@/db/mode.server";
import { loadWaitConfiguration } from "@/waits/config.server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [catalogConfig, waitConfig] = await Promise.all([loadCatalogConfig(), loadWaitConfiguration()]);
  return <OrderApp catalogConfig={catalogConfig} waitConfig={waitConfig} orderPersistence={resolveOrderPersistence()} />;
}
