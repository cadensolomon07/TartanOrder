"use client";
import { T } from "./Language";
import { useEffect, useRef } from "react";
import type { Review, WaitView } from "@/contracts";
import styles from "./Kiosk.module.css";
import { useCatalog } from "./CatalogContext";
import { formatCents, itemLabel, modifierLabel } from "./labels";
import { LinePrice } from "./LinePrice";
import { WaitEstimate } from "./WaitEstimate";
import { ItemNote, NoteDisclosure } from "./ItemNote";

export type ReviewProps = {
  review: Review;
  canConfirm: boolean;
  onConfirm: (reviewId: string, revision: number) => void;
  onReadAloud: () => void;
  ttsAvailable: boolean;
  wait?: WaitView;
};

export function ReviewPanel({ review, canConfirm, onConfirm, onReadAloud, ttsAvailable, wait }: ReviewProps) {
  // The Review button that was focused has just unmounted; land focus here.
  const { menu } = useCatalog();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className={styles.review} data-testid="review">
      <h2 className={styles.panelTitle} tabIndex={-1} ref={heading}><T>
        Check your order
      </T></h2>
      <ul className={styles.reviewList}>
        {review.lines.map((l) => (
          <li key={l.lineId} className={styles.reviewRow}>
            <span>
              <T>{l.qty}</T>× <T>{itemLabel(menu, l.itemId)}</T>
              <T>{l.modifiers.length > 0 && (
                <span className={styles.muted}> — <T>{l.modifiers.map((m) => modifierLabel(menu, m)).join(", ")}</T></span>
              )}</T>
              <LinePrice line={l} />
              <ItemNote note={l.note} />
              <WaitEstimate wait={wait} lineId={l.lineId} />
            </span>
          </li>
        ))}
      </ul>
      {review.lines.some(line => line.note) && <NoteDisclosure />}
      <div className={styles.reviewTotal}>
        <span><T>Total</T></span>
        <span data-testid="review-total"><T>{formatCents(review.totalCents)}</T></span>
      </div>
      <WaitEstimate wait={wait} />
      <div className={styles.reviewActions}>
        <T>{ttsAvailable && (
          <button type="button" className={styles.secondaryBtn} onClick={onReadAloud}><T>
            Read it back
          </T></button>
        )}</T>
        <button
          type="button"
          className={styles.primaryBtn}
          data-testid="confirm"
          disabled={!canConfirm}
          onClick={() => onConfirm(review.id, review.revision)}
        ><T>
          Confirm simulated order · {review.lines.reduce((n, l) => n + l.qty, 0)}</T> <T>{review.lines.reduce((n, l) => n + l.qty, 0) === 1 ? "item" : "items"}</T>
        </button>
      </div>
      <p className={styles.muted}><T>Talking or editing again cancels this review.</T></p>
      <p className={styles.muted}><T>Total uses listed menu prices. Counter prices, tax and meal-plan discounts may differ. Nothing will be sent to a dining location.</T></p>
    </section>
  );
}
