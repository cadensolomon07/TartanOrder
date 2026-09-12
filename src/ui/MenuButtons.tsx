"use client";
import type { Op } from "@/contracts";
import { MENU, type MenuCategory } from "@/contracts/menu";
import styles from "./Kiosk.module.css";
import { ITEM_IDS, formatCents } from "./labels";

const CATEGORIES: { id: MenuCategory; label: string }[] = [
  { id: "mains", label: "Mains" }, { id: "sides", label: "Sides" }, { id: "drinks", label: "Drinks" },
];

export function MenuButtons({ disabled, onOps }: { disabled: boolean; onOps: (ops: Op[]) => void }) {
  return (
    <section className={styles.menu} aria-label="Menu">
      <h2 className={styles.panelTitle}>On the menu</h2>
      {CATEGORIES.map((category) => <div key={category.id} className={styles.menuCategory}>
        <h3 className={styles.categoryTitle}>{category.label}</h3>
        <div className={styles.menuGrid} role="group" aria-label={category.label}>
      {ITEM_IDS.filter((id) => MENU[id].category === category.id).map((id) => (
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
