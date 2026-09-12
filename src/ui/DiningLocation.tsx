"use client";
import type { LocationId } from "@/contracts";
import styles from "./Kiosk.module.css";
import { useCatalog } from "./CatalogContext";

export function DiningLocation({ locationId, onChange }: { locationId: LocationId; onChange: (id: LocationId) => void }) {
  const { menu } = useCatalog();
  const snapshot = menu.catalog.snapshot;
  const selected = menu.activeLocations.find((location) => location.id === locationId);
  const count = menu.itemsForLocation(locationId).length;
  return <section className={styles.locationPanel} aria-label="Dining location">
    <label htmlFor="dining-location" className={styles.categoryTitle}>Order from</label>
    <select id="dining-location" data-testid="dining-location" value={locationId} onChange={(event) => onChange(event.target.value as LocationId)}>
      <optgroup label="CMU dining locations">
        {menu.activeLocations.map((location) => <option key={location.id} value={location.id}>{location.name}{menu.itemsForLocation(location.id).length ? "" : " — ordering unavailable"}</option>)}
      </optgroup>
      {menu.publicLocationIds.includes("demo") && <optgroup label="Fictional meal demo"><option value="demo">Demo Counter · fictional recipes</option></optgroup>}
    </select>
    {selected ? <>
      <p className={styles.muted}>{selected.location}</p>
      <p data-testid="price-source">{count ? `${count} priced choices from CMU-hosted menu snapshots.` : "No complete priced configurations are available to order here."} Checked {snapshot.checkedAt}.</p>
      {selected.sourceNote && <p className={styles.muted} data-testid="menu-source-note">{selected.sourceNote}</p>}
      <p className={styles.muted}>Published prices may differ at the counter. Stock, hours, tax and meal-plan pricing are not verified. Standard listed configurations only.</p>
      <div className={styles.sourceLinks}>
        {selected.menuUrl && <a href={selected.menuUrl} target="_blank" rel="noreferrer">View source menu</a>}
        {selected.detailUrl && <a href={selected.detailUrl} target="_blank" rel="noreferrer">CMU location details</a>}
        <a href={snapshot.sourceRepository} target="_blank" rel="noreferrer">Directory by ScottyLabs</a>
      </div>
    </> : locationId === "demo" ? <p className={styles.muted} data-testid="price-source">Fictional recipes and illustrative prices for trying meal and dietary requirements. These do not describe any real kitchen. Defined September 12, 2026.</p> : <p className={styles.muted}>Choose a campus dining location from the list.</p>}
  </section>;
}
