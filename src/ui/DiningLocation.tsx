"use client";
import { T } from "./Language";
import type { LocationId } from "@/contracts";
import styles from "./Kiosk.module.css";
import { useCatalog } from "./CatalogContext";

export function DiningLocation({ locationId, onChange }: { locationId: LocationId; onChange: (id: LocationId) => void }) {
  const { menu } = useCatalog();
  const snapshot = menu.catalog.snapshot;
  const selected = menu.activeLocations.find((location) => location.id === locationId);
  const count = menu.itemsForLocation(locationId).length;
  return <section className={styles.locationPanel} aria-label="Dining location">
    <label htmlFor="dining-location" className={styles.categoryTitle}><T>Order from</T></label>
    <select id="dining-location" data-testid="dining-location" value={locationId} onChange={(event) => onChange(event.target.value as LocationId)}>
      <optgroup label="CMU dining locations">
        <T>{menu.activeLocations.map((location) => <option key={location.id} value={location.id}><T>{location.name}{menu.itemsForLocation(location.id).length ? "" : " — ordering unavailable"}</T></option>)}</T>
      </optgroup>
      <T>{menu.publicLocationIds.includes("demo") && <optgroup label="Fictional meal demo"><option value="demo"><T>Demo Counter · fictional recipes</T></option></optgroup>}</T>
    </select>
    {selected ? <>
      <p className={styles.muted}><T>{selected.location}</T></p>
      <p data-testid="price-source"><T>{count ? `${count} priced choices from CMU-hosted menu snapshots.` : "No complete priced configurations are available to order here."} Checked {snapshot.checkedAt}</T>.</p>
      {selected.sourceNote && <p className={styles.muted} data-testid="menu-source-note">{selected.sourceNote}</p>}
      <p className={styles.muted}><T>Published prices may differ at the counter. Stock, hours, tax and meal-plan pricing are not verified. Standard listed configurations only.</T></p>
      <div className={styles.sourceLinks}>
        <T>{selected.menuUrl && <a href={selected.menuUrl} target="_blank" rel="noreferrer"><T>View source menu</T></a>}</T>
        <T>{selected.detailUrl && <a href={selected.detailUrl} target="_blank" rel="noreferrer"><T>CMU location details</T></a>}</T>
        <a href={snapshot.sourceRepository} target="_blank" rel="noreferrer"><T>Directory by ScottyLabs</T></a>
      </div>
    </> : locationId === "demo" ? <p className={styles.muted} data-testid="price-source"><T>Fictional recipes and illustrative prices for trying meal and dietary requirements. These do not describe any real kitchen. Defined September 12, 2026.</T></p> : <p className={styles.muted}><T>Choose a campus dining location from the list.</T></p>}
  </section>;
}
