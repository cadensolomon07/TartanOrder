"use client";
// B's single export. Everything the user sees. Every cart change goes through
// controller.act; every sentence goes through controller.submit; the UI never
// mutates state or calls an API itself.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Op, OrderController, UiAction } from "@/contracts";
import { useSpeech, type FailureContext, type SpeechFailure } from "@/voice/useSpeech";
import { cancelSpeech, speak, useSpeaking, useTtsAvailable } from "@/voice/tts";
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
  // Filled in at runtime by micFailureMessage(): the cause is usually NOT the user's connection.
  network: "The browser’s speech service couldn’t be reached. Type your order instead.",
  aborted: "Voice capture cancelled.",
  empty: "Didn’t catch anything. Try again, or type it.",
  error: "Voice didn’t work that time. Try again, or type it.",
};

// A `network` error almost never means the user's Wi-Fi is down: Chrome's cloud
// recognizer lives on Google's servers, which keyless Chromium builds (Brave,
// Vivaldi, plain Chromium) cannot use and some networks block. Say so, and say
// what will happen next.
export function micFailureMessage(reason: SpeechFailure, ctx: Pick<FailureContext, "isBrave" | "onDevice">): string {
  if (reason !== "network") return MIC_MESSAGES[reason];
  if (ctx.isBrave) return "Brave can’t reach a speech service. Open this page in Google Chrome, or type your order.";
  switch (ctx.onDevice) {
    case "downloading":
      return "Speech service unreachable — downloading on-device recognition (one-time; if it never finishes here, use Google Chrome). Meanwhile, type your order.";
    case "downloadable":
      return "Speech service unreachable. Press Talk again to download on-device recognition (one-time), or type your order.";
    case "available":
      return "Speech service unreachable and on-device recognition failed too. Type your order.";
    case "unavailable":
      // The browser has the on-device API but reports no pack for this language/device.
      return "Speech service unreachable, and this browser reports no on-device recognition for English here. Type your order.";
    default:
      return "This browser can’t reach its speech service and has no on-device recognition (Google Chrome 139+ does). Type your order, or use Chrome.";
  }
}

export function Kiosk({ controller, replay }: KioskProps) {
  const { state, busy, parser, notice, localOnly, assistant } = controller;
  const phase = state.phase;

  const [draft, setDraft] = useState("");
  // true once startInput has been sent for the current typed draft
  const [draftStarted, setDraftStarted] = useState(false);
  const [inputMode, setInputMode] = useState<"voice" | "text">("text");
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastConf, setLastConf] = useState<number | null>(null);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  // The controller is the only source of parser mode. A legacy saved browser
  // preference cannot silently bypass the online parser on a fresh page.
  const [readReplies, setReadReplies] = useState(true);
  const tts = useTtsAvailable();
  const speaking = useSpeaking();
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
    onFail: (reason, ctx) => {
      controller.endInput(); // release the input lock; review is NOT restored
      setMicNotice(micFailureMessage(reason, ctx));
    },
  });

  const downloadOnDevice = useCallback(() => {
    setMicNotice("Downloading on-device speech recognition (one-time)…");
    void speech.installOnDevice().then((s) => {
      setMicNotice(
        s === "available"
          ? "On-device speech is ready. Press Talk."
          : s === "unsupported"
            ? "This browser has no on-device speech recognition (Google Chrome 139+ does)."
            : s === "downloadable"
              ? "The download didn’t finish. Try again, use Google Chrome, or type your order."
              : "On-device speech could not be installed here. Type your order instead.",
      );
    });
  }, [speech]);

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
      // The first keystroke of a draft — in ANY editable phase — opens the
      // typed-input lifecycle: startInput() cancels an in-flight parse (a late
      // response can no longer apply), invalidates review/pending and holds
      // `busy` so Review/Confirm stay blocked until the draft is submitted,
      // discarded or erased. (A's first-intake correction on PR #2.)
      if (!draftStarted && v.trim() !== "" && phase !== "committed") {
        cancelSpeech();
        controller.startInput();
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
      cancelSpeech();
      controller.setLocalOnly(v);
    },
    [controller],
  );

  // Read the review snapshot aloud (menu-generated text only).
  const readAloud = useCallback(() => {
    if (state.review) speak(reviewToSpeech(state.review));
  }, [state.review]);

  // Read only the accepted controller reply or the exact immutable review.
  // A new input, mode switch, reset, or unmount cancels the old utterance.
  const replyId = phase === "committed" ? undefined : phase === "reviewing" ? state.review?.id : assistant?.id;
  const replyText = phase === "committed" ? undefined : phase === "reviewing" && state.review
    ? reviewToSpeech(state.review)
    : assistant?.text;
  useEffect(() => {
    if (readReplies && !busy && !speech.active && replyText) speak(replyText);
    else cancelSpeech();
    return cancelSpeech;
  }, [replyId, replyText, readReplies, busy, speech.active]);

  // ---- derived ---------------------------------------------------------
  // busy covers capture + draft + parsing; only the last one is "working on" text.
  const parsing = busy && !speech.active && !draftStarted;
  const canReview = phase === "editing" && state.lines.length > 0 && !state.pending && !busy;
  const canConfirm = phase === "reviewing" && !busy && !speech.active && !draftStarted;
  const editable = phase === "editing" || phase === "clarifying";
  const conversationStatus = speech.active ? "Listening" : parsing ? "Processing" : speaking ? "Responding" : "Ready";

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
            input: {inputMode === "voice" ? `voice (${speech.engine})` : "text"}
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
            <section className={styles.conversation} aria-label="Order assistant">
              <div className={styles.conversationHeader}>
                <span className={styles.conversationStatus} data-testid="conversation-status" role="status">{conversationStatus}</span>
                {tts && <label className={styles.readReplies}><input type="checkbox" checked={readReplies} onChange={(event) => setReadReplies(event.target.checked)} /> Read replies aloud</label>}
              </div>
              <p className={styles.assistantReply} data-testid="assistant-response" aria-live="polite">
                {assistant?.text || "What sounds good? Tell me your order, or choose from the menu."}
              </p>
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
            </section>
            <MenuButtons disabled={!editable} onOps={manual} />
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
          voiceEngine={speech.supported ? speech.engine : "none"}
          onDevice={speech.onDevice}
          isBrave={speech.isBrave}
          onDownloadOnDevice={downloadOnDevice}
          replay={replay}
        />
      </footer>
    </div>
  );
}

export default Kiosk;
