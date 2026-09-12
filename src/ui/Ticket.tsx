"use client";
import { T } from "./Language";
import { useEffect, useRef } from "react";
import type { Receipt, WaitView } from "@/contracts";
import styles from "./Kiosk.module.css";
import { useCatalog } from "./CatalogContext";
import { formatCents, itemLabel, modifierLabel } from "./labels";
import { LinePrice } from "./LinePrice";
import { WaitEstimate } from "./WaitEstimate";
import { ItemNote, NoteDisclosure } from "./ItemNote";

/** A short, stable display number derived from the receipt id (the full id stays visible below). */
export function ticketNumber(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 9000;
  return String(1000 + h);
}

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
      <div className={styles.ticketHero}>
        <span className={styles.ticketCheck} aria-hidden="true">✓</span>
        <div>
          <h2 className={styles.panelTitle} tabIndex={-1} ref={heading}><T>
            Simulated receipt
          </T></h2>
          <p className={styles.ticketNumber}>#<T>{ticketNumber(receipt.id)}</T></p>
          <p className={styles.ticketPickup}><T>No purchase or kitchen dispatch</T></p>
        </div>
        <span className={styles.simTag}><T>Simulated · no real purchase</T></span>
      </div>
      <p className={styles.ticketId}><T>
        Ticket </T><code><T>{receipt.id}</T></code>
      </p>
      <h3 className={styles.categoryTitle}><T>Order summary</T></h3>
      <ul className={styles.reviewList}>
        {receipt.lines.map((l) => (
          <li key={l.lineId} className={`${styles.reviewRow} ${styles.sumRow}`}>
            <span>
              <T>{l.qty}</T>× <T>{itemLabel(menu, l.itemId)}</T>
              <T>{l.modifiers.length > 0 && (
                <span className={styles.muted}> — <T>{l.modifiers.map((m) => modifierLabel(menu, m)).join(", ")}</T></span>
              )}</T>
              <WaitEstimate wait={wait} lineId={l.lineId} />
              <ItemNote note={l.note} />
            </span>
            <span className={styles.sumPrice}><LinePrice line={l} /></span>
          </li>
        ))}
      </ul>
      {receipt.lines.some(line => line.note) && <NoteDisclosure />}
      <div className={styles.reviewTotal}>
        <span><T>Menu subtotal</T></span>
        <span><T>{formatCents(receipt.totalCents)}</T></span>
      </div>
      <WaitEstimate wait={wait} />
      <div className={styles.reviewActions}>
        <button type="button" className={styles.primaryBtn} data-testid="new-order" onClick={onNewOrder}><T>
          Start a new order
        </T></button>
      </div>
      <p className={styles.muted}><T>Published or sample menu prices only; no tax or meal-plan discounts applied. Nothing was sent to a dining location.</T></p>
    </section>
  );
}
