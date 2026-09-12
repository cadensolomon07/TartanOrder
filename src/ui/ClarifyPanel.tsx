"use client";
import { useEffect, useRef } from "react";
import type { Choice } from "@/contracts";
import styles from "./Kiosk.module.css";

export type ClarifyProps = {
  question: string;
  choices: Choice[];
  onChoose: (choiceId: string) => void;
};

// Renders the engine's question and up to three choices. All text is shown as
// plain text; nothing here is interpreted as markup.
export function ClarifyPanel({ question, choices, onChoose }: ClarifyProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus(); // keyboard users land on the question, not <body>
  }, []);
  return (
    <section className={styles.clarify} data-testid="clarify" aria-live="polite">
      <h2 className={styles.panelTitle} tabIndex={-1} ref={heading}>
        Which one?
      </h2>
      <p className={styles.clarifyQuestion}>{question}</p>
      <div className={styles.choiceList}>
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            className={styles.choiceBtn}
            data-testid={`choice-${c.id}`}
            onClick={() => onChoose(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className={styles.muted}>Or say or type something else to start over on this change.</p>
    </section>
  );
}
