"use client";
// B's single export. Everything the user sees. Every cart change goes through
// controller.act; every sentence goes through controller.submit; the UI never
// mutates state or calls an API itself.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Op, OrderController, UiAction } from "@/contracts";
import { useSpeech, type SpeechFailure } from "@/voice/useSpeech";
import { cancelSpeech, speak, useTtsAvailable } from "@/voice/tts";
import styles from "./Kiosk.module.css";
import { Cart } from "./Cart";
import { MenuButtons } from "./MenuButtons";
import { InputBar } from "./InputBar";
import { ClarifyPanel } from "./ClarifyPanel";
import { ReviewPanel } from "./ReviewPanel";
import { Ticket } from "./Ticket";
import { EngineeringPanel } from "./EngineeringPanel";
import { useChangedLines } from "./useChangedLines";
import { reviewToSpeech } from "./reviewSpeech";
import { formatCents } from "./labels";
import { DEMO_DISCLOSURE } from "@/contracts/menu";

export type KioskProps = {
  controller: OrderController;
  // Optional read-only replay view supplied by A. Never calls live APIs.
  replay?: ReactNode;
};

const MIC_MESSAGES: Record<SpeechFailure, string> = {
  unsupported: "Voice isn’t available here. Type your order instead.",
  "not-allowed": "Microphone access was blocked. Type your order instead.",
  "no-speech": "Didn’t catch anything. Try again, or type it.",
  network: "Voice needs an internet connection. Type your order instead.",
  aborted: "Voice capture cancelled.",
  empty: "Didn’t catch anything. Try again, or type it.",
  error: "Voice didn’t work that time. Try again, or type it.",
};

export function Kiosk({ controller, replay }: KioskProps) {
  const { state, busy, parser, notice } = controller;
  const phase = state.phase;

  const [draft, setDraft] = useState("");
  // true once startInput has been sent for the current typed draft
  const [draftStarted, setDraftStarted] = useState(false);
  const [inputMode, setInputMode] = useState<"voice" | "text">("text");
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastConf, setLastConf] = useState<number | null>(null);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  // A's controller starts in Local only (rules, no network); mirror that here.
  const [localOnly, setLocalOnlyState] = useState(true);
  const tts = useTtsAvailable();
  const changed = useChangedLines(state.lines);

  // ---- voice -----------------------------------------------------------
  const speech = useSpeech({
    onFinal: (text, conf) => {
      setLastTranscript(text);
      setLastConf(conf);
      setMicNotice(null);
      // One final result -> exactly one submit. submit ends capture on A's side.
      void controller.submit(text, "voice", conf);
    },
    onFail: (reason) => {
      controller.endInput(); // release the input lock; review is NOT restored
      setMicNotice(MIC_MESSAGES[reason]);
    },
  });

  const talk = useCallback(() => {
    // Idempotent: a second press during the mic-permission gap must not
    // re-issue startInput() (extra INPUT_STARTED events) while nothing new opens.
    if (phase === "committed" || speech.active) return;
    cancelSpeech();
    setMicNotice(null);
    setInputMode("voice");
    setDraft("");
    setDraftStarted(false);
    controller.startInput(); // invalidates review/pending, advances revision
    speech.start();
  }, [controller, phase, speech]);

  const cancelTalk = useCallback(() => {
    speech.abort();
    controller.endInput();
    setMicNotice(MIC_MESSAGES.aborted);
  }, [controller, speech]);

  // Anything that is not "finish this capture" must first kill the capture so a
  // late recognition result cannot land on a different cart.
  const stopAnyCapture = useCallback(() => {
    cancelSpeech();
    // `active` covers the gap between start() and the engine's onstart too.
    if (speech.active) {
      speech.abort();
      controller.endInput();
    }
  }, [controller, speech]);

  // ---- typed -----------------------------------------------------------
  const onDraftChange = useCallback(
    (v: string) => {
      setInputMode("text");
      if (phase === "reviewing" && !draftStarted && v.trim() !== "") {
        controller.startInput(); // first edit of a reviewed order
        setDraftStarted(true);
      } else if (draftStarted && v.trim() === "") {
        controller.endInput(); // erased the draft: release capture, do not strand Review
        setDraftStarted(false);
      }
      setDraft(v);
    },
    [controller, phase, draftStarted],
  );

  const submitDraft = useCallback(() => {
    const text = draft.trim();
    if (!text) {
      if (draftStarted) controller.endInput();
      setDraftStarted(false);
      return;
    }
    stopAnyCapture();
    setLastTranscript(text);
    setLastConf(null);
    setDraft("");
    setDraftStarted(false);
    void controller.submit(text, "text", null);
  }, [controller, draft, draftStarted, stopAnyCapture]);

  // Cancel a parse that is already running. Per A's controller contract an
  // action that cancels a running parse calls startInput() then endInput():
  // startInput aborts the request and invalidates review; endInput releases capture.
  const cancelParsing = useCallback(() => {
    controller.startInput();
    controller.endInput();
  }, [controller]);

  const discardDraft = useCallback(() => {
    setDraft("");
    if (draftStarted) controller.endInput();
    setDraftStarted(false);
  }, [controller, draftStarted]);

  // ---- actions ---------------------------------------------------------
  const act = useCallback(
    (action: UiAction) => {
      stopAnyCapture();
      controller.act(action);
    },
    [controller, stopAnyCapture],
  );

  const manual = useCallback((ops: Op[]) => act({ type: "MANUAL", ops }), [act]);

  const review = useCallback(() => act({ type: "REVIEW" }), [act]);

  const confirm = useCallback(
    (reviewId: string, revision: number) => act({ type: "CONFIRM", reviewId, revision }),
    [act],
  );

  const newOrder = useCallback(() => {
    stopAnyCapture();
    setDraft("");
    setDraftStarted(false);
    setLastTranscript("");
    setLastConf(null);
    setMicNotice(null);
    controller.reset();
  }, [controller, stopAnyCapture]);

  const setLocalOnly = useCallback(
    (v: boolean) => {
      setLocalOnlyState(v);
      controller.setLocalOnly(v);
    },
    [controller],
  );

  // Read the review snapshot aloud (menu-generated text only).
  const readAloud = useCallback(() => {
    if (state.review) speak(reviewToSpeech(state.review));
  }, [state.review]);

  useEffect(() => {
    if (phase === "reviewing" && state.review) speak(reviewToSpeech(state.review));
    if (phase !== "reviewing") cancelSpeech();
    // Only when the review itself changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, state.review?.id]);

  // ---- derived ---------------------------------------------------------
  // busy covers capture + draft + parsing; only the last one is "working on" text.
  const parsing = busy && !speech.active && !draftStarted;
  const canReview = phase === "editing" && state.lines.length > 0 && !state.pending && !busy;
  const canConfirm = phase === "reviewing" && !busy && !speech.active && !draftStarted;
  const editable = phase === "editing" || phase === "clarifying";

  return (
    <div className={styles.kiosk} data-testid="kiosk" data-phase={phase}>
      <header className={styles.header}>
        <div className={styles.brand}>TartanOrder</div>
        <div className={styles.subBrand} data-testid="disclosure">{DEMO_DISCLOSURE}</div>
        <div className={styles.badges} aria-label="Current modes">
          <span className={styles.badge} data-testid="badge-parser">
            parser: {parser}
          </span>
          <span className={styles.badge} data-testid="badge-input">
            input: {inputMode}
          </span>
          {localOnly && <span className={styles.badge}>local only</span>}
          {parser === "fixture" && <span className={`${styles.badge} ${styles.badgeWarn}`}>fixture</span>}
          {busy && (
            <span className={`${styles.badge} ${styles.badgeBusy}`} data-testid="badge-busy">
              {speech.active ? "listening" : draftStarted ? "typing" : "working"}
            </span>
          )}
        </div>
      </header>

      {notice && (
        <div className={styles.notice} role="status" data-testid="notice">
          {notice}
        </div>
      )}

      {phase === "committed" && state.receipt ? (
        <main className={styles.main}>
          <Ticket receipt={state.receipt} onNewOrder={newOrder} />
        </main>
      ) : (
        <main className={styles.main}>
          <div className={styles.left}>
            <MenuButtons disabled={!editable} onOps={manual} />
            <InputBar
              draft={draft}
              draftOpen={draftStarted}
              onDraftChange={onDraftChange}
              onSubmit={submitDraft}
              onDiscard={discardDraft}
              onCancelParsing={cancelParsing}
              parsing={parsing}
              voiceSupported={speech.supported}
              voiceActive={speech.active}
              listening={speech.listening}
              interim={speech.interim}
              onTalk={talk}
              onStopTalking={speech.stop}
              onCancelTalking={cancelTalk}
              lastTranscript={lastTranscript}
              micNotice={micNotice}
            />
          </div>

          <div className={styles.right}>
            {phase === "clarifying" && state.pending && (
              <ClarifyPanel
                question={state.pending.question}
                choices={state.pending.choices}
                onChoose={(choiceId) =>
                  act({ type: "CHOOSE", pendingId: state.pending!.id, choiceId })
                }
              />
            )}

            {phase === "reviewing" && state.review ? (
              <ReviewPanel
                review={state.review}
                canConfirm={canConfirm}
                onConfirm={confirm}
                onReadAloud={readAloud}
                ttsAvailable={tts}
              />
            ) : (
              <section className={styles.cartPanel}>
                <h2 className={styles.panelTitle}>Your order</h2>
                <Cart
                  lines={state.lines}
                  lastLineId={state.lastLineId}
                  changed={changed}
                  editable={editable}
                  onOps={manual}
                />
                <div className={styles.cartFooter}>
                  <span className={styles.total}>
                    Total <strong data-testid="total">{formatCents(state.totalCents)}</strong>
                  </span>
                  <div className={styles.cartActions}>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      data-testid="undo"
                      disabled={state.lines.length === 0 && state.audit.length === 0}
                      onClick={() => act({ type: "UNDO" })}
                    >
                      Undo
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      data-testid="clear"
                      disabled={state.lines.length === 0}
                      onClick={() => act({ type: "CLEAR" })}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      data-testid="review"
                      disabled={!canReview}
                      onClick={review}
                    >
                      Review order
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      )}

      <footer className={styles.footer}>
        <button type="button" className={styles.linkBtn} data-testid="reset" onClick={newOrder}>
          New order
        </button>
        <EngineeringPanel
          controller={controller}
          inputMode={inputMode}
          lastTranscript={lastTranscript}
          lastAsrConfidence={lastConf}
          localOnly={localOnly}
          onLocalOnly={setLocalOnly}
          replay={replay}
        />
      </footer>
    </div>
  );
}

export default Kiosk;
