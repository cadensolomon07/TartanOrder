import type { WaitView } from "@/contracts";
import styles from "./Kiosk.module.css";

export function WaitSource({ source }: { source: WaitView["source"] }) {
  return source === "seeded" ? <span className={styles.waitSource}>Simulated wait times</span> : null;
}

/** Display only: the engine supplies the complete estimate and line values. */
export function WaitEstimate({ wait, lineId }: { wait?: WaitView; lineId?: string }) {
  if (!wait || wait.status === "empty") return null;
  if (lineId !== undefined) {
    const minutes = wait.lineWaits[lineId];
    return <span className={styles.lineWait}>
      Estimated preparation wait: {minutes == null ? "unavailable" : `${minutes} min`}. <WaitSource source={wait.source} />
    </span>;
  }
  return <div className={styles.waitEstimate} data-testid="wait-estimate">
    <p><strong>Estimated preparation wait: {wait.status === "known" && wait.estimateMinutes !== null ? `${wait.estimateMinutes} min` : "unavailable"}</strong> <WaitSource source={wait.source} /></p>
    <p className={styles.muted}>{wait.status === "unavailable" ? "The complete estimate is unavailable because at least one item’s wait is unknown. " : ""}Uses the maximum vendor wait, assuming parallel preparation. Excludes walking and pickup travel.</p>
  </div>;
}
