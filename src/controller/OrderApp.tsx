"use client";
import type { Catalog, CatalogSource, WaitEngineConfig } from "@/contracts";
import { defaultLocationFor, indexCatalog } from "@/catalog/lookup";
import { CatalogProvider } from "@/ui/CatalogContext";
import { Kiosk } from "@/ui/Kiosk";
import styles from "@/ui/Kiosk.module.css";
import { useOrderController } from "./useOrderController";

/** Structural copy of CatalogConfig so this client module never imports a server-only file. */
export type CatalogConfigProps = {
  readonly catalog: Catalog | null;
  readonly source: CatalogSource;
  readonly versionId: string | null;
  readonly unavailableReason: string | null;
};

export type OrderPersistenceMode = "supabase" | "off";

export function OrderApp({ catalogConfig, waitConfig, orderPersistence = "off" }: { catalogConfig: CatalogConfigProps; waitConfig: WaitEngineConfig; orderPersistence?: OrderPersistenceMode }) {
  if (!catalogConfig.catalog) {
    return <div className={styles.kiosk} data-testid="catalog-unavailable" role="alert">
      <header className={styles.header}>
        <div className={styles.brandBlock}><span className={styles.logoMark} aria-hidden="true">T</span><span className={styles.brand}>TartanOrder</span></div>
        <div className={styles.venue}><div className={styles.venueName}>Menu unavailable</div><div className={styles.venueMeta}>No real purchase.</div></div>
      </header>
      <main className={styles.main}>
        <section className={styles.notice}>
          <p><strong>The menu could not be loaded, so ordering is unavailable.</strong></p>
          <p>{catalogConfig.unavailableReason ?? "No catalog source answered."}</p>
          <p className={styles.muted}>Nothing was substituted: the bundled menu is only shown when it is explicitly selected and labelled.</p>
        </section>
      </main>
    </div>;
  }
  return <LoadedApp catalog={catalogConfig.catalog} source={catalogConfig.source} waitConfig={waitConfig} orderPersistence={orderPersistence} />;
}

function LoadedApp({ catalog, source, waitConfig, orderPersistence }: { catalog: Catalog; source: CatalogSource; waitConfig: WaitEngineConfig; orderPersistence: OrderPersistenceMode }) {
  const menu = indexCatalog(catalog);
  // The public counters: the ranked campus shortlist plus the fictional Demo Counter for the meal demonstration.
  const allowed = menu.publicLocationIds.length > 0 ? menu.publicLocationIds : undefined;
  const controller = useOrderController(catalog, defaultLocationFor(menu), waitConfig, allowed, { mode: orderPersistence });
  return <CatalogProvider catalog={catalog} source={source}><Kiosk controller={controller} /></CatalogProvider>;
}
