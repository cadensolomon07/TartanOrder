"use client";
import type { ItemId, Op } from "@/contracts";
import styles from "./Kiosk.module.css";
import { ITEM_IDS, ITEM_LABEL } from "./labels";

export function MenuButtons({ disabled, onOps }: { disabled: boolean; onOps: (ops: Op[]) => void }) {
  return (
    <div className={styles.menuGrid} role="group" aria-label="Add an item">
      {ITEM_IDS.map((id: ItemId) => (
        <button
          key={id}
          type="button"
          className={styles.menuBtn}
          disabled={disabled}
          data-testid={`menu-${id}`}
          onClick={() => onOps([{ type: "ADD", itemId: id, qty: 1, modifiers: [] }])}
        >
          <span className={styles.menuBtnPlus} aria-hidden="true">+</span>
          {ITEM_LABEL[id]}
        </button>
      ))}
    </div>
  );
}
