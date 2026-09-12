"use client";
import { useEffect, useRef } from "react";
import type { Receipt } from "@/contracts";
import styles from "./Kiosk.module.css";
import { ITEM_LABEL, MODIFIER_LABEL, formatCents } from "./labels";

export function Ticket({ receipt, onNewOrder }: { receipt: Receipt; onNewOrder: () => void }) {
  // Focus the heading, NOT the reset button: a repeated Enter after Confirm
  // must not wipe the receipt before anyone reads it.
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
              {l.qty}× {ITEM_LABEL[l.itemId]}
              {l.modifiers.length > 0 && (
                <span className={styles.muted}> — {l.modifiers.map((m) => MODIFIER_LABEL[m]).join(", ")}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.reviewTotal}>
        <span>Total</span>
        <span>{formatCents(receipt.totalCents)}</span>
      </div>
      <button type="button" className={styles.primaryBtn} data-testid="new-order" onClick={onNewOrder}>
        New order
      </button>
    </section>
  );
}
