import type { Line } from "@/contracts";
import { T } from "./Language";
import { MENU } from "@/contracts/menu";
import { totalCents } from "@/core/engine";
import { formatCents } from "./labels";
import styles from "./Kiosk.module.css";

export function LinePrice({ line }: { line: Line }) {
  return <span className={styles.linePrice}><T>{formatCents(totalCents([line]))}</T> · <T>{MENU[line.itemId].locationId === "demo" ? "sample price" : "published menu price"}</T></span>;
}
