"use client";
import { useRef, type KeyboardEvent } from "react";
import styles from "./Kiosk.module.css";

export type InputBarProps = {
  draft: string;
  // true while a typed draft holds the controller's capture (started during review)
  draftOpen: boolean;
  onDraftChange: (v: string) => void;
  onSubmit: () => void;
  onDiscard: () => void;
  onCancelParsing: () => void;
  parsing: boolean;
  // voice
  voiceSupported: boolean;
  // from Talk press until the capture settles (covers the permission prompt)
  voiceActive: boolean;
  // the engine has actually started listening
  listening: boolean;
  interim: string;
  onTalk: () => void;
  onStopTalking: () => void;
  onCancelTalking: () => void;
  lastTranscript: string;
  micNotice: string | null;
};

export function InputBar(p: InputBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    p.onSubmit();
    // The draft clears and Submit disables; keep keyboard focus somewhere useful.
    inputRef.current?.focus();
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") p.onDiscard();
  }

  return (
    <section className={styles.inputBar} aria-label="Order input">
      <div className={styles.transcript} data-testid="transcript" aria-live="polite">
        {p.voiceActive ? (
          <span className={styles.listeningDot}>
            Listening… <em>{p.interim || (p.listening ? "say your order" : "starting mic…")}</em>
          </span>
        ) : p.parsing ? (
          <span>
            Working on: “{p.lastTranscript || p.draft}”{" "}
            <button type="button" className={styles.linkBtn} data-testid="cancel-parsing" onClick={p.onCancelParsing}>
              Cancel
            </button>
          </span>
        ) : p.lastTranscript ? (
          <span>Heard: “{p.lastTranscript}”</span>
        ) : (
          <span className={styles.muted}>Try: “a burger, fries and lemonade” or “make the burger a double”.</span>
        )}
      </div>

      <div className={styles.inputRow}>
        <label htmlFor="order-text" className={styles.srOnly}>
          Type your order
        </label>
        <input
          ref={inputRef}
          id="order-text"
          className={styles.textInput}
          data-testid="text-input"
          type="text"
          inputMode="text"
          autoComplete="off"
          maxLength={500}
          placeholder="Type your order"
          value={p.draft}
          disabled={p.voiceActive}
          onChange={(e) => p.onDraftChange(e.target.value)}
          onKeyDown={onKey}
        />
        <button
          type="button"
          className={styles.primaryBtn}
          data-testid="submit"
          disabled={p.voiceActive || p.draft.trim().length === 0}
          onClick={submit}
        >
          Submit
        </button>
        {(p.draft.length > 0 || p.draftOpen) && !p.voiceActive && (
          <button type="button" className={styles.secondaryBtn} data-testid="discard" onClick={p.onDiscard}>
            Discard
          </button>
        )}
      </div>

      <div className={styles.voiceRow}>
        {p.voiceSupported ? (
          <>
            {/* One persistent element: Talk becomes Stop in place so keyboard focus survives. */}
            <button
              type="button"
              className={styles.talkBtn}
              data-testid={p.voiceActive ? "stop-talk" : "talk"}
              aria-pressed={p.voiceActive}
              onClick={p.voiceActive ? p.onStopTalking : p.onTalk}
            >
              {p.voiceActive ? "Stop — I’m done" : "Talk"}
            </button>
            {p.voiceActive && (
              <button type="button" className={styles.secondaryBtn} data-testid="cancel-talk" onClick={p.onCancelTalking}>
                Cancel
              </button>
            )}
          </>
        ) : (
          <span className={styles.muted} data-testid="voice-unsupported">
            Voice isn’t available in this browser — typing works the same.
          </span>
        )}
        {p.micNotice && (
          <span className={styles.notice} role="status" data-testid="mic-notice">
            {p.micNotice}
          </span>
        )}
      </div>
    </section>
  );
}
