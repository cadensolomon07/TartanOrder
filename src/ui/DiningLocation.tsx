"use client";
import type { LocationId } from "@/contracts";
import { DINING_LOCATIONS, DINING_SNAPSHOT } from "@/contracts/campus";
import { itemsForLocation } from "@/contracts/menu";
import styles from "./Kiosk.module.css";

export function DiningLocation({ locationId, onChange }: { locationId: LocationId; onChange: (id: LocationId) => void }) {
  const selected = DINING_LOCATIONS.find(location => location.id === locationId);
  const count = itemsForLocation(locationId).length;
  return <section className={styles.locationPanel} aria-label="Dining location">
    <label htmlFor="dining-location" className={styles.categoryTitle}>Order from</label>
    <select id="dining-location" data-testid="dining-location" value={locationId} onChange={event => onChange(event.target.value as LocationId)}>
      <optgroup label="CMU dining locations">
        {DINING_LOCATIONS.map(location => <option key={location.id} value={location.id}>{location.name}{itemsForLocation(location.id).length ? "" : " — prices unavailable"}</option>)}
      </optgroup>
      <option value="demo">Demo Counter — sample prices</option>
    </select>
    {selected ? <>
      <p className={styles.muted}>{selected.location}</p>
      <p data-testid="price-source">{count ? `${count} choices from CMU’s published menu.` : "Verified item prices are not available for this location."} Checked {DINING_SNAPSHOT.checkedAt}.</p>
      <p className={styles.muted}>Published prices may differ at the counter. Stock, hours, tax and meal-plan pricing are not verified. Standard listed configurations only.</p>
      <div className={styles.sourceLinks}>
        {selected.menuUrl && <a href={selected.menuUrl} target="_blank" rel="noreferrer">View source menu</a>}
        <a href={selected.detailUrl} target="_blank" rel="noreferrer">CMU location details</a>
        <a href={DINING_SNAPSHOT.sourceRepository} target="_blank" rel="noreferrer">Directory by ScottyLabs</a>
      </div>
    </> : <p className={styles.muted}>Original practice menu with illustrative prices. Campus menus are available in the location list.</p>}
  </section>;
}
