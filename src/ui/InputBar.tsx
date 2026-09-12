"use client";
import { T } from "./Language";
import { useLanguage } from "./Language";
import { translate } from "@/contracts/languages";
import { useRef, type KeyboardEvent } from "react";
import { LIMITS } from "@/contracts";
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
  transcribing?: boolean;
  // the engine has actually started listening
  listening: boolean;
  interim: string;
  onTalk: () => void;
  onStopTalking: () => void;
  onCancelTalking: () => void;
  lastTranscript: string;
  micNotice: string | null;
  /** Placeholder for the text field, e.g. `Say or type it — “one Smash'd Burger”`. */
  placeholder?: string;
  /** Idle hint under the field, shown until something has been heard. */
  hint?: string;
};

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3M8 21h8" />
    </svg>
  );
}

export function InputBar(p: InputBarProps) {
  const language=useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    p.onSubmit();
    // The draft clears and Submit disables; keep keyboard focus somewhere useful.
    inputRef.current?.focus();
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    // Enter may accept a Chinese IME candidate without submitting the order.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") p.onDiscard();
  }

  return (
    <section className={styles.inputBar} aria-label="Order input">
      <div className={styles.inputRow}>
        <T>{p.voiceSupported && (
          // One persistent element: Talk becomes Stop in place so keyboard focus survives.
          <button
            type="button"
            className={styles.talkBtn}
            data-testid={p.voiceActive ? "stop-talk" : "talk"}
            aria-pressed={p.voiceActive}
            disabled={p.transcribing}
            aria-label={translate(p.voiceActive ? "Stop — I’m done" : "Talk",language)}
            title={translate(p.voiceActive ? "Stop — I’m done" : "Talk",language)}
            onClick={p.voiceActive ? p.onStopTalking : p.onTalk}
          >
            <T>{p.voiceActive ? <>■ <span><T>Stop — I’m done</T></span></> : <MicIcon />}</T>
          </button>
        )}</T>
        <label htmlFor="order-text" className={styles.srOnly}><T>
          Type your order
        </T></label>
        <input
          ref={inputRef}
          id="order-text"
          className={styles.textInput}
          data-testid="text-input"
          type="text"
          inputMode="text"
          autoComplete="off"
          maxLength={LIMITS.transcriptChars}
          placeholder={p.placeholder ?? "Say or type it — “a burger, fries and lemonade”"}
          value={p.draft}
          disabled={p.voiceActive}
          onChange={(e) => p.onDraftChange(e.target.value)}
          onKeyDown={onKey}
        />
        <button
          type="button"
          className={`${styles.primaryBtn} ${styles.addBtn}`}
          data-testid="submit"
          disabled={p.voiceActive || p.draft.trim().length === 0}
          onClick={submit}
        ><T>
          Submit
        </T></button>
        {(p.draft.length > 0 || p.draftOpen) && !p.voiceActive && (
          <button type="button" className={styles.secondaryBtn} data-testid="discard" onClick={p.onDiscard}><T>
            Discard
          </T></button>
        )}
        <T>{p.voiceActive && (
          <button type="button" className={styles.secondaryBtn} data-testid="cancel-talk" onClick={p.onCancelTalking}><T>
            Cancel
          </T></button>
        )}</T>
      </div>

      <div className={styles.transcript} data-testid="transcript" aria-live="polite">
        {p.transcribing ? <span data-testid="transcribing"><T>Transcribing with Gemini…</T></span> : p.voiceActive ? (
          <span className={styles.listeningDot}><T>
            Listening… </T><em>{p.interim || (p.listening ? "say your order" : "starting mic…")}</em>
          </span>
        ) : p.parsing ? (
          <span><T>
            Working on: “</T>{p.lastTranscript || p.draft}”<T>{" "}</T>
            <button type="button" className={styles.linkBtn} data-testid="cancel-parsing" onClick={p.onCancelParsing}><T>
              Cancel
            </T></button>
          </span>
        ) : p.lastTranscript ? (
          <span><T>Heard: “</T>{p.lastTranscript}”</span>
        ) : (
          <span className={styles.muted}><T>{p.hint ?? "Press the mic and speak, or type a request and press Submit."}</T></span>
        )}
        <T>{!p.voiceSupported && (
          <span className={styles.muted} data-testid="voice-unsupported"><T>
            Voice isn’t available in this browser — typing works the same.
          </T></span>
        )}</T>
      </div>
      <T>{p.micNotice && (
        <div className={styles.voiceRow}>
          <span className={styles.notice} role="status" data-testid="mic-notice">
            <T>{p.micNotice}</T>
          </span>
        </div>
      )}</T>
    </section>
  );
}
