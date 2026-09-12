"use client";
import type { Line, Op, ItemId, WaitView } from "@/contracts";
import styles from "./Kiosk.module.css";
import { ITEM_LABEL, MODIFIER_LABEL, modifiersFor } from "./labels";
import { LinePrice } from "./LinePrice";
import { WaitEstimate } from "./WaitEstimate";
import { MENU } from "@/contracts/menu";
import { glyphFor } from "./MenuButtons";

export type CartProps = {
  lines: Line[];
  lastLineId: string | null;
  changed: Set<string>;
  editable: boolean;
  onOps: (ops: Op[]) => void;
  wait?: WaitView;
};

// "Burger (line 2)" when the same item appears more than once, so the
// audience can follow an ambiguity question like "which burger?".
export function lineLabel(lines: Line[], line: Line): string {
  const same = lines.filter((l) => l.itemId === line.itemId);
  const base = ITEM_LABEL[line.itemId];
  if (same.length < 2) return base;
  const n = same.findIndex((l) => l.lineId === line.lineId) + 1;
  return `${base} (line ${n})`;
}

export function Cart({ lines, lastLineId, changed, editable, onOps, wait }: CartProps) {
  if (lines.length === 0) {
    return (
      <div className={styles.emptyCart} data-testid="cart-empty">
        <div className={styles.emptyIcon} aria-hidden="true">🍽</div>
        <p>Your order is empty.</p>
        <p className={styles.muted}>Tap an item, type an order, or press the mic and say one.</p>
      </div>
    );
  }
  return (
    <ul className={styles.cartList} data-testid="cart" aria-label="Your order">
      {lines.map((line) => {
        const ref = { by: "line" as const, lineId: line.lineId };
        const isChanged = changed.has(line.lineId);
        const isLast = lastLineId === line.lineId;
        return (
          <li
            key={line.lineId}
            className={`${styles.cartRow} ${isChanged ? styles.rowChanged : ""}`}
            data-testid={`line-${line.lineId}`}
            data-line-id={line.lineId}
          >
            <div className={styles.rowMain}>
              <span className={styles.thumb} aria-hidden="true">{glyphFor(MENU[line.itemId].label, MENU[line.itemId].category)}</span>
              <span className={styles.rowInfo}>
                <span className={styles.rowTitle}>
                  {lineLabel(lines, line)}
                  {isLast && <span className={styles.lastTag}> · last mentioned</span>}
                </span>
                <LinePrice line={line} />
                <WaitEstimate wait={wait} lineId={line.lineId} />
                {line.modifiers.length > 0 && (
                  <span className={styles.rowMods}>
                    {line.modifiers.map((m) => MODIFIER_LABEL[m]).join(", ")}
                  </span>
                )}
              </span>
              {editable ? (
                <span className={styles.stepper}>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    aria-label={`Decrease ${lineLabel(lines, line)}`}
                    disabled={line.qty <= 1}
                    onClick={() => onOps([{ type: "SET_QTY", ref, qty: line.qty - 1 }])}
                  >
                    −
                  </button>
                  <span className={styles.qtyBadge} aria-label={`quantity ${line.qty}`}>{line.qty}</span>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    aria-label={`Increase ${lineLabel(lines, line)}`}
                    disabled={line.qty >= 5}
                    onClick={() => onOps([{ type: "SET_QTY", ref, qty: line.qty + 1 }])}
                  >
                    +
                  </button>
                </span>
              ) : (
                <span className={styles.qtyBadge} aria-label={`quantity ${line.qty}`}>{line.qty}×</span>
              )}
            </div>
            {editable && (
              <div className={styles.rowControls}>
                {modifiersFor(line.itemId as ItemId).map((m) => {
                  const on = line.modifiers.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                      aria-pressed={on}
                      onClick={() => onOps([{ type: "MOD", ref, modifier: m, enabled: !on }])}
                    >
                      {MODIFIER_LABEL[m]}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={styles.removeBtn}
                  aria-label={`Remove ${lineLabel(lines, line)}`}
                  onClick={() => onOps([{ type: "REMOVE", ref }])}
                >
                  Remove
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
