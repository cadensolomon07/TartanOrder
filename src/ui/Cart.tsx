"use client";
import { T, useLanguage } from "./Language";
import { translate } from "@/contracts/languages";
import { LIMITS, type Line, type Op, type WaitView } from "@/contracts";
import type { CatalogIndex } from "@/catalog/lookup";
import styles from "./Kiosk.module.css";
import { useCatalog } from "./CatalogContext";
import { itemLabel, modifierLabel, modifiersFor } from "./labels";
import { LinePrice } from "./LinePrice";
import { WaitEstimate } from "./WaitEstimate";
import { glyphFor } from "./MenuButtons";
import { DietaryMarks } from "./DietaryMarks";
import { foodEvidenceFor } from "@/catalog/food";
import { ItemNote } from "./ItemNote";

export type CartProps = {
  lines: Line[];
  lastLineId: string | null;
  changed: Set<string>;
  editable: boolean;
  onOps: (ops: Op[]) => void;
  wait?: WaitView;
  noteEditor?: {
    lineId: string | null;
    text: string;
    start: (line: Line) => void;
    change: (text: string) => void;
    save: () => void;
    cancel: () => void;
  };
};

// "Burger (line 2)" when the same item appears more than once, so the
// audience can follow an ambiguity question like "which burger?".
export function lineLabel(menu: CatalogIndex, lines: Line[], line: Line): string {
  const same = lines.filter((l) => l.itemId === line.itemId);
  const base = itemLabel(menu, line.itemId);
  if (same.length < 2) return base;
  const n = same.findIndex((l) => l.lineId === line.lineId) + 1;
  return `${base} (line ${n})`;
}

export function Cart({ lines, lastLineId, changed, editable, onOps, wait, noteEditor }: CartProps) {
  const language = useLanguage();
  const { menu } = useCatalog();
  if (lines.length === 0) {
    return (
      <div className={styles.emptyCart} data-testid="cart-empty">
        <div className={styles.emptyIcon} aria-hidden="true">🍽</div>
        <p><T>Your order is empty.</T></p>
        <p className={styles.muted}><T>Tap an item, type an order, or press the mic and say one.</T></p>
      </div>
    );
  }
  return (
    <ul className={styles.cartList} data-testid="cart" aria-label="Your order">
      {lines.map((line) => {
        const ref = { by: "line" as const, lineId: line.lineId };
        const isChanged = changed.has(line.lineId);
        const isLast = lastLineId === line.lineId;
        const item = menu.item(line.itemId);
        return (
          <li
            key={line.lineId}
            className={`${styles.cartRow} ${isChanged ? styles.rowChanged : ""}`}
            data-testid={`line-${line.lineId}`}
            data-line-id={line.lineId}
          >
            <div className={styles.rowMain}>
              <span className={styles.thumb} aria-hidden="true"><T>{glyphFor(item?.label ?? line.itemId, item?.category ?? "mains")}</T></span>
              <span className={styles.rowInfo}>
                <span className={styles.rowTitle}>
                  <T>{lineLabel(menu, lines, line)}</T>
                  <T>{isLast && <span className={styles.lastTag}><T> · last mentioned</T></span>}</T>
                </span>
                <LinePrice line={line} />
                <WaitEstimate wait={wait} lineId={line.lineId} />
                <T>{line.modifiers.length > 0 && (
                  <span className={styles.rowMods}>
                    <T>{line.modifiers.map((m) => modifierLabel(menu, m)).join(", ")}</T>
                  </span>
                )}</T>
                <ItemNote note={line.note} />
                {item && <DietaryMarks evidence={foodEvidenceFor(menu, line.itemId, line.modifiers)} compact testId="line-marks" />}
              </span>
              <T>{editable ? (
                <span className={styles.stepper}>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    aria-label={`Decrease ${lineLabel(menu, lines, line)}`}
                    disabled={line.qty <= 1}
                    onClick={() => onOps([{ type: "SET_QTY", ref, qty: line.qty - 1 }])}
                  >
                    −
                  </button>
                  <span className={styles.qtyBadge} aria-label={`quantity ${line.qty}`}><T>{line.qty}</T></span>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    aria-label={`Increase ${lineLabel(menu, lines, line)}`}
                    disabled={line.qty >= 5}
                    onClick={() => onOps([{ type: "SET_QTY", ref, qty: line.qty + 1 }])}
                  >
                    +
                  </button>
                </span>
              ) : (
                <span className={styles.qtyBadge} aria-label={`quantity ${line.qty}`}><T>{line.qty}</T>×</span>
              )}</T>
            </div>
            {editable && (
              <div className={styles.rowControls}>
                <T>{modifiersFor(menu, line.itemId).map((m) => {
                  const on = line.modifiers.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                      aria-pressed={on}
                      onClick={() => onOps([{ type: "MOD", ref, modifier: m, enabled: !on }])}
                    >
                      <T>{modifierLabel(menu, m)}</T>
                    </button>
                  );
                })}</T>
                <button
                  type="button"
                  className={styles.removeBtn}
                  aria-label={`Remove ${lineLabel(menu, lines, line)}`}
                  onClick={() => onOps([{ type: "REMOVE", ref }])}
                ><T>
                  Remove
                </T></button>
                {noteEditor && <button type="button" className={styles.chip} onClick={() => noteEditor.start(line)} aria-label={`${line.note ? "Edit" : "Add"} note for ${lineLabel(menu, lines, line)}`}>
                  <T>{line.note ? "Edit note" : "Add note"}</T>
                </button>}
              </div>
            )}
            {editable && noteEditor?.lineId === line.lineId && <form className={styles.noteEditor} onSubmit={event => { event.preventDefault(); noteEditor.save(); }}>
              <label><T>Note for {lineLabel(menu, lines, line)}</T>
                <textarea autoFocus rows={3} maxLength={LIMITS.noteChars} value={noteEditor.text} onChange={event => noteEditor.change(event.target.value)} placeholder={translate("e.g. extra ice",language)} data-testid="item-note-input" />
              </label>
              <p className={styles.muted}><T>Request only. Extra charges are not included. Clear the text to remove this note.</T></p>
              <div className={styles.rowControls}>
                <button type="submit" className={styles.chip} data-testid="save-item-note"><T>Save note</T></button>
                <button type="button" className={styles.removeBtn} onClick={noteEditor.cancel} data-testid="cancel-item-note"><T>Cancel</T></button>
              </div>
            </form>}
          </li>
        );
      })}
    </ul>
  );
}
