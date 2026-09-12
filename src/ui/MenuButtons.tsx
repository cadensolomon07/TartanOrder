"use client";
import { useState } from "react";
import type { Op, LocationId } from "@/contracts";
import { MENU, itemsForLocation, type MenuCategory } from "@/contracts/menu";
import styles from "./Kiosk.module.css";
import { ITEM_IDS, formatCents } from "./labels";

const CATEGORIES: { id: MenuCategory; label: string }[] = [
  { id: "mains", label: "Mains" }, { id: "sides", label: "Sides" }, { id: "drinks", label: "Drinks" },
];

export function MenuButtons({ disabled, onOps, locationId = "demo" }: { disabled: boolean; onOps: (ops: Op[]) => void; locationId?: LocationId }) {
  const [search, setSearch] = useState("");
  const ids = ITEM_IDS.filter(id => MENU[id].locationId === locationId && MENU[id].label.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className={styles.menu} aria-label="Menu">
      <h2 className={styles.panelTitle}>On the menu</h2>
      {locationId !== "demo" && itemsForLocation(locationId).length > 0 && <label className={styles.menuSearch}>Find an item<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search this menu" type="search" /></label>}
      {ids.length === 0 && <p className={styles.muted}>{search ? "No matching published items. Try another name." : "Ordering is unavailable here until we have verified item prices. Choose another location above."}</p>}
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
    </section>
  );
}
