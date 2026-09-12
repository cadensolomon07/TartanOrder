import type { Line } from "@/contracts";
import { totalCents } from "@/core/engine";
import { useCatalog } from "./CatalogContext";
import { formatCents } from "./labels";
import styles from "./Kiosk.module.css";

export function LinePrice({ line }: { line: Line }) {
  const { menu } = useCatalog();
  const sample = menu.item(line.itemId)?.locationId === "demo";
  return <span className={styles.linePrice}>{formatCents(totalCents([line], menu.catalog))} · {sample ? "sample price" : "published menu price"}</span>;
}
