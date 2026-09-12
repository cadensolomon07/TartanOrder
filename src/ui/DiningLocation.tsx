"use client";
import type { LocationId } from "@/contracts";
import { ACTIVE_DINING_LOCATIONS, DINING_SNAPSHOT } from "@/contracts/campus";
import { itemsForLocation } from "@/contracts/menu";
import styles from "./Kiosk.module.css";

export function DiningLocation({ locationId, onChange }: { locationId: LocationId; onChange: (id: LocationId) => void }) {
  const selected = ACTIVE_DINING_LOCATIONS.find(location => location.id === locationId);
  const count = itemsForLocation(locationId).length;
  return <section className={styles.locationPanel} aria-label="Dining location">
    <label htmlFor="dining-location" className={styles.categoryTitle}>Order from</label>
    <select id="dining-location" data-testid="dining-location" value={locationId} onChange={event => onChange(event.target.value as LocationId)}>
      <optgroup label="CMU dining locations">
        {ACTIVE_DINING_LOCATIONS.map(location => <option key={location.id} value={location.id}>{location.name}{itemsForLocation(location.id).length ? "" : " — ordering unavailable"}</option>)}
      </optgroup>
    </select>
    {selected ? <>
      <p className={styles.muted}>{selected.location}</p>
      <p data-testid="price-source">{count ? `${count} priced choices from CMU-hosted menu snapshots.` : "No complete priced configurations are available to order here."} Checked {DINING_SNAPSHOT.checkedAt}.</p>
      {"sourceNote" in selected && typeof selected.sourceNote === "string" && <p className={styles.muted} data-testid="menu-source-note">{selected.sourceNote}</p>}
      <p className={styles.muted}>Published prices may differ at the counter. Stock, hours, tax and meal-plan pricing are not verified. Standard listed configurations only.</p>
      <div className={styles.sourceLinks}>
        {selected.menuUrl && <a href={selected.menuUrl} target="_blank" rel="noreferrer">View source menu</a>}
        <a href={selected.detailUrl} target="_blank" rel="noreferrer">CMU location details</a>
        <a href={DINING_SNAPSHOT.sourceRepository} target="_blank" rel="noreferrer">Directory by ScottyLabs</a>
      </div>
    </> : <p className={styles.muted}>Choose a campus dining location from the list.</p>}
  </section>;
}
