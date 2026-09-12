"use client";
import { useState } from "react";
import type { Op, LocationId } from "@/contracts";
import { UNPRICED_MENU_ITEMS } from "@/contracts/campus";
import { MENU, itemsForLocation, type MenuCategory } from "@/contracts/menu";
import styles from "./Kiosk.module.css";
import { ITEM_IDS, formatCents } from "./labels";

const CATEGORIES: { id: MenuCategory; label: string }[] = [
  { id: "mains", label: "Mains" }, { id: "sides", label: "Sides" }, { id: "drinks", label: "Drinks" },
];

export function MenuButtons({ disabled, onOps, locationId = "demo" }: { disabled: boolean; onOps: (ops: Op[]) => void; locationId?: LocationId }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const ids = ITEM_IDS.filter(id => MENU[id].locationId === locationId && [MENU[id].label, MENU[id].description, ...MENU[id].aliases].some(value => value.toLowerCase().includes(query)));
  const previewItems = UNPRICED_MENU_ITEMS.filter(item => item.locationId === locationId);
  const previews = previewItems.filter(item => `${item.label} ${item.description}`.toLowerCase().includes(query));
  return (
    <section className={styles.menu} aria-label="Menu">
      <h2 className={styles.panelTitle}>On the menu</h2>
      {locationId !== "demo" && (itemsForLocation(locationId).length > 0 || previewItems.length > 0) && <label className={styles.menuSearch}>Find an item<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search this menu" type="search" /></label>}
      {ids.length === 0 && previews.length === 0 && <p className={styles.muted}>{query ? "No matching menu items. Try another name." : "Ordering is unavailable here until we have complete, verified priced configurations. Choose another location above."}</p>}
      {CATEGORIES.filter(category => ids.some(id => MENU[id].category === category.id)).map((category) => <div key={category.id} className={styles.menuCategory}>
        <h3 className={styles.categoryTitle}>{category.label}</h3>
        <div className={styles.menuGrid} role="group" aria-label={category.label}>
      {ids.filter((id) => MENU[id].category === category.id).map((id) => (
        <button
          key={id}
          type="button"
          className={styles.menuBtn}
          disabled={disabled}
          data-testid={`menu-${id}`}
          onClick={() => onOps([{ type: "ADD", itemId: id, qty: 1, modifiers: [] }])}
        >
          <span className={styles.menuItemHeading}><span>{MENU[id].label}</span><span className={styles.menuBtnPlus} aria-hidden="true">+</span></span>
          <span className={styles.menuDescription}>{MENU[id].description}</span>
          <span className={styles.menuPrice}>{formatCents(MENU[id].priceCents)}</span>
        </button>
      ))}
        </div>
      </div>)}
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
