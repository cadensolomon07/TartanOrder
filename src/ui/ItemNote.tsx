import styles from "./Kiosk.module.css";

export function ItemNote({ note }: { note?: string }) {
  return note ? <span className={styles.itemNote} data-testid="item-note"><strong>Special request:</strong> {note}</span> : null;
}

export function NoteDisclosure() {
  return <p className={styles.muted}>Special requests need counter confirmation. Availability and any extra charge are not confirmed.</p>;
}
