"use client";
import { useState } from "react";
import type { CatalogCategory, Op, LocationId } from "@/contracts";
import styles from "./Kiosk.module.css";
import { useCatalog } from "./CatalogContext";
import { formatCents } from "./labels";

const CATEGORIES: { id: CatalogCategory; label: string }[] = [
  { id: "mains", label: "Mains" }, { id: "sides", label: "Sides" }, { id: "drinks", label: "Drinks" },
];

export function MenuButtons({ disabled, onOps, locationId = "demo" }: { disabled: boolean; onOps: (ops: Op[]) => void; locationId?: LocationId }) {
  const { menu } = useCatalog();
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const priced = menu.itemsForLocation(locationId);
  const items = priced.filter((item) => [item.label, item.description, ...item.aliases].some((value) => value.toLowerCase().includes(query)));
  const previewItems = menu.previewsForLocation(locationId);
  const previews = previewItems.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(query));
  return (
    <section className={styles.menu} aria-label="Menu">
      <h2 className={styles.panelTitle}>On the menu</h2>
      {locationId !== "demo" && (priced.length > 0 || previewItems.length > 0) && <label className={styles.menuSearch}>Find an item<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this menu" type="search" /></label>}
      {items.length === 0 && previews.length === 0 && <p className={styles.muted}>{query ? "No matching menu items. Try another name." : "Ordering is unavailable here until we have complete, verified priced configurations. Choose another location above."}</p>}
      {CATEGORIES.filter((category) => items.some((item) => item.category === category.id)).map((category) => <div key={category.id} className={styles.menuCategory}>
        <h3 className={styles.categoryTitle}>{category.label}</h3>
        <div className={styles.menuGrid} role="group" aria-label={category.label}>
      {items.filter((item) => item.category === category.id).map((item) => (
        <button
          key={item.id}
          type="button"
          className={styles.menuBtn}
          disabled={disabled}
          data-testid={`menu-${item.id}`}
          onClick={() => onOps([{ type: "ADD", itemId: item.id, qty: 1, modifiers: [] }])}
        >
          <span className={styles.menuItemHeading}><span>{item.label}</span><span className={styles.menuBtnPlus} aria-hidden="true">+</span></span>
          <span className={styles.menuDescription}>{item.description}</span>
          <span className={styles.menuPrice}>{formatCents(item.priceCents)}</span>
        </button>
      ))}
        </div>
      </div>)}
      {previews.length > 0 && <div className={styles.menuCategory}>
        <h3 className={styles.categoryTitle}>Menu preview · ordering unavailable</h3>
        <div className={styles.menuGrid} role="group" aria-label="Menu preview">
          {previews.map((item, index) => {
            const price = typeof item.priceCents === "number" && Number.isInteger(item.priceCents) && item.priceCents > 0 ? item.priceCents : null;
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
