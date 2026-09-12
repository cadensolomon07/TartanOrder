"use client";
import { T } from "./Language";
import type { LocationId } from "@/contracts";
import { ACTIVE_DINING_LOCATIONS, DINING_SNAPSHOT } from "@/contracts/campus";
import { itemsForLocation } from "@/contracts/menu";
import styles from "./Kiosk.module.css";

export function DiningLocation({ locationId, onChange }: { locationId: LocationId; onChange: (id: LocationId) => void }) {
  const selected = ACTIVE_DINING_LOCATIONS.find(location => location.id === locationId);
  const count = itemsForLocation(locationId).length;
  return <section className={styles.locationPanel} aria-label="Dining location">
    <label htmlFor="dining-location" className={styles.categoryTitle}><T>Order from</T></label>
    <select id="dining-location" data-testid="dining-location" value={locationId} onChange={event => onChange(event.target.value as LocationId)}>
      <optgroup label="CMU dining locations">
        <T>{ACTIVE_DINING_LOCATIONS.map(location => <option key={location.id} value={location.id}><T>{location.name}{itemsForLocation(location.id).length ? "" : " — ordering unavailable"}</T></option>)}</T>
      </optgroup>
      <optgroup label="Fictional meal demo"><option value="demo"><T>Demo Counter · fictional recipes</T></option></optgroup>
    </select>
    {selected ? <>
      <p className={styles.muted}><T>{selected.location}</T></p>
      <p data-testid="price-source"><T>{count ? `${count} priced choices from CMU-hosted menu snapshots.` : "No complete priced configurations are available to order here."} Checked {DINING_SNAPSHOT.checkedAt}</T>.</p>
      {"sourceNote" in selected && typeof selected.sourceNote === "string" && <p className={styles.muted} data-testid="menu-source-note">{selected.sourceNote}</p>}
      <p className={styles.muted}><T>Published prices may differ at the counter. Stock, hours, tax and meal-plan pricing are not verified. Standard listed configurations only.</T></p>
      <div className={styles.sourceLinks}>
        <T>{selected.menuUrl && <a href={selected.menuUrl} target="_blank" rel="noreferrer"><T>View source menu</T></a>}</T>
        <a href={selected.detailUrl} target="_blank" rel="noreferrer"><T>CMU location details</T></a>
        <a href={DINING_SNAPSHOT.sourceRepository} target="_blank" rel="noreferrer"><T>Directory by ScottyLabs</T></a>
      </div>
    </> : locationId === "demo" ? <p className={styles.muted} data-testid="price-source"><T>Fictional recipes and illustrative prices for trying meal and dietary requirements. These do not describe any real kitchen. Defined September 12, 2026.</T></p> : <p className={styles.muted}><T>Choose a campus dining location from the list.</T></p>}
  </section>;
}
