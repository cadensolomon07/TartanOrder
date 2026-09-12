import type { Line } from "@/contracts";
import { MENU } from "@/contracts/menu";
import { totalCents } from "@/core/engine";
import { formatCents } from "./labels";
import styles from "./Kiosk.module.css";

export function LinePrice({ line }: { line: Line }) {
  return <span className={styles.linePrice}>{formatCents(totalCents([line]))} · {MENU[line.itemId].locationId === "demo" ? "sample price" : "published menu price"}</span>;
}
