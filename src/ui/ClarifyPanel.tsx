"use client";
import { T } from "./Language";
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
        <T>{choices.length ? "Which one?" : "A quick question"}</T>
      </h2>
      <p className={styles.clarifyQuestion}><T>{question}</T></p>
      <div className={styles.choiceList}>
        <T>{choices.map((c) => (
          <button
            key={c.id}
            type="button"
            className={styles.choiceBtn}
            data-testid={`choice-${c.id}`}
            onClick={() => onChoose(c.id)}
          >
            <T>{c.label}</T>
          </button>
        ))}</T>
      </div>
      <p className={styles.muted}><T>Say or type your answer{choices.length ? ", or choose an option above" : ""}</T>.</p>
    </section>
  );
}
