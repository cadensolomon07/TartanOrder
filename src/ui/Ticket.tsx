"use client";
import { useEffect, useRef } from "react";
import type { Receipt, WaitView } from "@/contracts";
import styles from "./Kiosk.module.css";
import { ITEM_LABEL, MODIFIER_LABEL, formatCents } from "./labels";
import { totalCents } from "@/core/engine";
import { WaitEstimate } from "./WaitEstimate";

/** A short, stable display number derived from the receipt id (the full id stays visible below). */
export function ticketNumber(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 9000;
  return String(1000 + h);
}

export function Ticket({ receipt, onNewOrder, wait }: { receipt: Receipt; onNewOrder: () => void; wait?: WaitView }) {
  // Focus the heading, NOT the reset button: a repeated Enter after Confirm
  // must not wipe the receipt before anyone reads it.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const pickup = wait?.status === "known" && wait.estimateMinutes !== null
    ? `Ready in about ${wait.estimateMinutes} min`
    : "Preparation time is shown at the counter";
  return (
    <section className={styles.ticket} data-testid="ticket">
      <div className={styles.ticketHero}>
        <span className={styles.ticketCheck} aria-hidden="true">✓</span>
        <div>
          <h2 className={styles.panelTitle} tabIndex={-1} ref={heading}>
            Order placed
          </h2>
          <p className={styles.ticketNumber}>#{ticketNumber(receipt.id)}</p>
          <p className={styles.ticketPickup}>{pickup}</p>
        </div>
        <span className={styles.simTag}>Simulated · no real purchase</span>
      </div>
      <p className={styles.ticketId}>
        Ticket <code>{receipt.id}</code>
      </p>
      <h3 className={styles.categoryTitle}>Order summary</h3>
      <ul className={styles.reviewList}>
        {receipt.lines.map((l) => (
          <li key={l.lineId} className={`${styles.reviewRow} ${styles.sumRow}`}>
            <span>
              {l.qty}× {ITEM_LABEL[l.itemId]}
              {l.modifiers.length > 0 && (
                <span className={styles.muted}> — {l.modifiers.map((m) => MODIFIER_LABEL[m]).join(", ")}</span>
              )}
              <WaitEstimate wait={wait} lineId={l.lineId} />
            </span>
            <span className={styles.sumPrice}>{formatCents(totalCents([l]))}</span>
          </li>
        ))}
      </ul>
      <div className={styles.reviewTotal}>
        <span>Total</span>
        <span>{formatCents(receipt.totalCents)}</span>
      </div>
      <WaitEstimate wait={wait} />
      <div className={styles.reviewActions}>
        <button type="button" className={styles.primaryBtn} data-testid="new-order" onClick={onNewOrder}>
          Start a new order
        </button>
      </div>
      <p className={styles.muted}>Published or sample menu prices only; no tax or meal-plan discounts applied. Nothing was sent to a dining location.</p>
    </section>
  );
}
