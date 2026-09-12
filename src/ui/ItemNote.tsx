import styles from "./Kiosk.module.css";
import { T } from "./Language";

export function ItemNote({ note }: { note?: string }) {
  return note ? <span className={styles.itemNote} data-testid="item-note"><strong><T>Special request:</T></strong> {note}</span> : null;
}

export function NoteDisclosure() {
  return <p className={styles.muted}><T>Special requests need counter confirmation. Availability and any extra charge are not confirmed.</T></p>;
}
