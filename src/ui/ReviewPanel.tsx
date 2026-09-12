"use client";
import { useEffect, useRef } from "react";
import type { Review, WaitView } from "@/contracts";
import styles from "./Kiosk.module.css";
import { ITEM_LABEL, MODIFIER_LABEL, formatCents } from "./labels";
import { LinePrice } from "./LinePrice";
import { WaitEstimate } from "./WaitEstimate";

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
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className={styles.review} data-testid="review">
      <h2 className={styles.panelTitle} tabIndex={-1} ref={heading}>
        Check your order
      </h2>
      <ul className={styles.reviewList}>
        {review.lines.map((l) => (
          <li key={l.lineId} className={styles.reviewRow}>
            <span>
              {l.qty}× {ITEM_LABEL[l.itemId]}
              {l.modifiers.length > 0 && (
                <span className={styles.muted}> — {l.modifiers.map((m) => MODIFIER_LABEL[m]).join(", ")}</span>
              )}
              <LinePrice line={l} />
              <WaitEstimate wait={wait} lineId={l.lineId} />
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.reviewTotal}>
        <span>Total</span>
        <span data-testid="review-total">{formatCents(review.totalCents)}</span>
      </div>
      <WaitEstimate wait={wait} />
      <div className={styles.reviewActions}>
        {ttsAvailable && (
          <button type="button" className={styles.secondaryBtn} onClick={onReadAloud}>
            Read it back
          </button>
        )}
        <button
          type="button"
          className={styles.primaryBtn}
          data-testid="confirm"
          disabled={!canConfirm}
          onClick={() => onConfirm(review.id, review.revision)}
        >
          Confirm simulated order · {review.lines.reduce((n, l) => n + l.qty, 0)} {review.lines.reduce((n, l) => n + l.qty, 0) === 1 ? "item" : "items"}
        </button>
      </div>
      <p className={styles.muted}>Talking or editing again cancels this review.</p>
      <p className={styles.muted}>Total uses listed menu prices. Counter prices, tax and meal-plan discounts may differ. Nothing will be sent to a dining location.</p>
    </section>
  );
}
