"use client";
import { useState } from "react";
import type { Op, LocationId, DietaryProfile, ItemId } from "@/contracts";
import { UNPRICED_MENU_ITEMS } from "@/contracts/campus";
import { MENU, itemsForLocation, type MenuCategory } from "@/contracts/menu";
import styles from "./Kiosk.module.css";
import { ITEM_IDS, formatCents } from "./labels";
import { checkCompatibility } from "@/core/compatibility";
import { foodEvidenceFor } from "@/contracts/food";

const CATEGORIES: { id: MenuCategory; label: string }[] = [
  { id: "mains", label: "Mains" }, { id: "sides", label: "Sides" }, { id: "drinks", label: "Drinks" },
];

export function MenuButtons({ disabled, onOps, locationId = "demo", profile, onMealItem }: { disabled: boolean; onOps: (ops: Op[]) => void; locationId?: LocationId; profile?: DietaryProfile; onMealItem?: (id: ItemId) => void }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const ids = ITEM_IDS.filter(id => MENU[id].locationId === locationId && [MENU[id].label, MENU[id].description, ...MENU[id].aliases].some(value => value.toLowerCase().includes(query)));
  const previewItems = UNPRICED_MENU_ITEMS.filter(item => item.locationId === locationId);
  const previews = previewItems.filter(item => `${item.label} ${item.description}`.toLowerCase().includes(query));
  const hasRequirements = Boolean(profile && (profile.preference !== "none" || profile.allergies.length || profile.dislikes.length));
  const checks = new Map(ids.map(id => [id, profile ? checkCompatibility(id, [], profile) : null]));
  const matches = ids.filter(id => !checks.get(id) || checks.get(id)?.status === "match");
  const excluded = ids.filter(id => checks.get(id)?.status !== "match" && checks.get(id));
  const renderCategories = (itemIds: ItemId[]) => CATEGORIES.filter(category => itemIds.some(id => MENU[id].category === category.id)).map((category) => <div key={category.id} className={styles.menuCategory}>
    <h3 className={styles.categoryTitle}>{category.label}</h3>
    <div className={styles.menuGrid} role="group" aria-label={category.label}>
      {itemIds.filter(id => MENU[id].category === category.id).map(id => {
        const check = checks.get(id);
        const blocked = check?.status === "unknown" || check?.staffReview === true;
        const preferenceConflict = check?.status === "conflict" && !check.staffReview;
        return <button key={id} type="button" className={`${styles.menuBtn}${blocked ? ` ${styles.menuEvidenceBlocked}` : ""}`} disabled={disabled || blocked} data-testid={`menu-${id}`}
          onClick={() => onMealItem ? onMealItem(id) : onOps([{ type: "ADD", itemId: id, qty: 1, modifiers: [] }])}>
          <span className={styles.menuItemHeading}><span>{MENU[id].label}</span>{!blocked && <span className={styles.menuBtnPlus} aria-hidden="true">+</span>}</span>
          <span className={styles.menuDescription}>{MENU[id].description}</span>
          <span className={styles.menuPrice}>{formatCents(MENU[id].priceCents)}</span>
          {hasRequirements && check && <span className={styles.menuDescription} data-testid={`compatibility-${id}`}><strong>{check.status === "match" ? "Matches recorded requirements" : check.status === "unknown" ? "Needs verification" : "Conflicts with requirements"}</strong>{check.status !== "match" && <> · {check.reasons.join(" ")}</>}</span>}
          {!blocked && (onMealItem || preferenceConflict) && <span className={styles.menuDescription}>{preferenceConflict ? "Request a preference choice" : "Choose for meal"}</span>}
        </button>;
      })}
    </div>
  </div>);
  return (
    <section className={styles.menu} aria-label="Menu">
      <h2 className={styles.panelTitle}>On the menu</h2>
      {locationId !== "demo" && (itemsForLocation(locationId).length > 0 || previewItems.length > 0) && <label className={styles.menuSearch}>Find an item<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search this menu" type="search" /></label>}
      {ids.length === 0 && previews.length === 0 && <p className={styles.muted}>{query ? "No matching menu items. Try another name." : "Ordering is unavailable here until we have complete, verified priced configurations. Choose another location above."}</p>}
      {hasRequirements && <p className={styles.muted} data-testid="menu-match-count">{matches.length} choices match the recorded requirements. This describes available evidence, not an allergy-safety guarantee.</p>}
      {renderCategories(matches)}
      {excluded.length > 0 && <details data-testid="excluded-menu"><summary>Inspect {excluded.length} conflicting or unverified choices</summary><p className={styles.muted}>Preference conflicts can request an explicit choice. Allergy conflicts and missing evidence cannot be overridden.</p>{renderCategories(excluded)}</details>}
      {hasRequirements && <details data-testid="food-evidence"><summary>About this dietary evidence</summary><p className={styles.muted}>{ids[0] ? foodEvidenceFor(ids[0]).provenance.explanation : "Complete ingredient and preparation evidence is unavailable."}</p><p className={styles.muted}>Ingredients and preparation are checked separately. Removing one ingredient does not establish absence of an allergen elsewhere in a recipe.</p></details>}
      {previews.length > 0 && <div className={styles.menuCategory}>
        <h3 className={styles.categoryTitle}>Menu preview · ordering unavailable</h3>
        <div className={styles.menuGrid} role="group" aria-label="Menu preview">
          {previews.map((item, index) => {
            const price = "priceCents" in item && typeof item.priceCents === "number" && Number.isInteger(item.priceCents) && item.priceCents > 0 ? item.priceCents : null;
            return <button key={`${item.label}-${index}`} type="button" className={styles.menuBtn} disabled data-testid={`menu-preview-${locationId}-${index}`}>
              <span className={styles.menuItemHeading}><span>{item.label}</span></span>
              <span className={styles.menuDescription}>{item.description}</span>
              <span className={styles.menuPrice}>{price === null ? "Price unavailable" : `Published menu price: ${formatCents(price)} · Ordering unavailable`}</span>
            </button>;
          })}
        </div>
      </div>}
    </section>
  );
}
