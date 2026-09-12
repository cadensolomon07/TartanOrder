"use client";
import { useEffect, useRef } from "react";
import type { Receipt, WaitView } from "@/contracts";
import styles from "./Kiosk.module.css";
import { useCatalog } from "./CatalogContext";
import { formatCents, itemLabel, modifierLabel } from "./labels";
import { LinePrice } from "./LinePrice";
import { WaitEstimate } from "./WaitEstimate";

export function Ticket({ receipt, onNewOrder, wait }: { receipt: Receipt; onNewOrder: () => void; wait?: WaitView }) {
  // Focus the heading, NOT the reset button: a repeated Enter after Confirm
  // must not wipe the receipt before anyone reads it.
  const { menu } = useCatalog();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className={styles.ticket} data-testid="ticket">
      <div className={styles.ticketHead}>
        <h2 className={styles.panelTitle} tabIndex={-1} ref={heading}>
          Order placed
        </h2>
        <span className={styles.simTag}>Simulated · no real purchase</span>
      </div>
      <p className={styles.ticketId}>
        Ticket <code>{receipt.id}</code>
      </p>
      <ul className={styles.reviewList}>
        {receipt.lines.map((l) => (
          <li key={l.lineId} className={styles.reviewRow}>
            <span>
              {l.qty}× {itemLabel(menu, l.itemId)}
              {l.modifiers.length > 0 && (
                <span className={styles.muted}> — {l.modifiers.map((m) => modifierLabel(menu, m)).join(", ")}</span>
              )}
              <LinePrice line={l} />
              <WaitEstimate wait={wait} lineId={l.lineId} />
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.reviewTotal}>
        <span>Total</span>
        <span>{formatCents(receipt.totalCents)}</span>
      </div>
      <WaitEstimate wait={wait} />
      <button type="button" className={styles.primaryBtn} data-testid="new-order" onClick={onNewOrder}>
        New order
      </button>
      <p className={styles.muted}>Published or sample menu prices only; no tax or meal-plan discounts applied. Nothing was sent to a dining location.</p>
    </section>
  );
}
