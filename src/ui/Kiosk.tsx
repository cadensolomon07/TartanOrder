"use client";
// B's single export. Everything the user sees. Every cart change goes through
// controller.act; every sentence goes through controller.submit; the UI never
// mutates state or calls an API itself.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Op, OrderController, UiAction, LocationId } from "@/contracts";
import { CAMPUS_DISCLOSURE, DEMO_DISCLOSURE } from "@/contracts";
import { useSpeech, type FailureContext, type SpeechFailure } from "@/voice/useSpeech";
import { cancelSpeech, speak, useSpeaking, useTtsAvailable } from "@/voice/tts";
import styles from "./Kiosk.module.css";
import { Cart } from "./Cart";
import { CategoryRail, MenuButtons, type MenuFilter } from "./MenuButtons";
import { DiningLocation } from "./DiningLocation";
import { RequirementsPanel, RequirementsSummary } from "./RequirementsPanel";
import { InputBar } from "./InputBar";
import { ClarifyPanel } from "./ClarifyPanel";
import { ReviewPanel } from "./ReviewPanel";
import { Ticket } from "./Ticket";
import { EngineeringPanel } from "./EngineeringPanel";
import { useChangedLines } from "./useChangedLines";
import { reviewToSpeech } from "./reviewSpeech";
import { formatCents } from "./labels";
import { WaitEstimate } from "./WaitEstimate";
import { SwapOfferPanel, swapOfferToSpeech } from "./SwapOfferPanel";
import { catalogSourceLabel, useCatalog } from "./CatalogContext";

export type KioskProps = {
  controller: OrderController;
  // Optional read-only replay view supplied by A. Never calls live APIs.
  replay?: ReactNode;
};

/** Customer-facing save state. Ordering never waits on it; a failure only means the server copy is behind. */
export const PERSISTENCE_TEXT: Record<OrderController["persistence"]["state"], string> = {
  saved: "Saved to server",
  saving: "Saving to server…",
  failed: "Not saved to server",
  off: "Server saving off",
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
  const { state, busy, parser, notice, localOnly, assistant, locationId } = controller;
  const { menu, source: catalogSource } = useCatalog();
  const phase = state.phase;

  const [draft, setDraft] = useState("");
  // true once startInput has been sent for the current typed draft
  const [draftStarted, setDraftStarted] = useState(false);
  const requirementsDraftOwner = useRef(false);
  const [requirementsDraftActive, setRequirementsDraftActive] = useState(false);
  const [requirementsDraftEpoch, setRequirementsDraftEpoch] = useState(0);
  const [inputMode, setInputMode] = useState<"voice" | "text">("text");
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastConf, setLastConf] = useState<number | null>(null);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  // The controller is the only source of parser mode. A legacy saved browser
  // preference cannot silently bypass the online parser on a fresh page.
  const [readReplies, setReadReplies] = useState(true);
  const [filter, setFilter] = useState<MenuFilter>("all");
  const tts = useTtsAvailable();
  const speaking = useSpeaking();
  const changed = useChangedLines(state.lines);
  const spokenOffers = useRef(new Set<string>());
  const offer = phase === "editing" && state.wait ? state.swapOffer : null;
  const offerSpeech = offer && state.wait ? swapOfferToSpeech(offer, state.wait.source, menu) : null;
  const offerSpeechId = offer ? `${state.sessionId}:${offer.offerId}` : null;
  const endRequirementsDraft = useCallback(() => {
    if (!requirementsDraftOwner.current) return;
    requirementsDraftOwner.current = false;
    setRequirementsDraftActive(false);
    setRequirementsDraftEpoch(value => value + 1);
    controller.endInput();
  }, [controller]);

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
    endRequirementsDraft();
    cancelSpeech();
    setMicNotice(null);
    setInputMode("voice");
    setDraft("");
    setDraftStarted(false);
    controller.startInput(); // invalidates review/pending, advances revision
    speech.start();
  }, [controller, phase, speech, endRequirementsDraft]);

  const cancelTalk = useCallback(() => {
    speech.abort();
    controller.endInput();
    setMicNotice(MIC_MESSAGES.aborted);
  }, [controller, speech]);

  // Anything that is not "finish this capture" must first kill the capture so a
  // late recognition result cannot land on a different cart.
  const stopAnyCapture = useCallback(() => {
    cancelSpeech();
    endRequirementsDraft();
    // `active` covers the gap between start() and the engine's onstart too.
    if (speech.active) {
      speech.abort();
      controller.endInput();
    }
  }, [controller, speech, endRequirementsDraft]);

  const startRequirementsDraft = useCallback(() => {
    if (requirementsDraftOwner.current) return;
    stopAnyCapture();
    setDraft(""); setDraftStarted(false); setMicNotice(null);
    requirementsDraftOwner.current = true;
    setRequirementsDraftActive(true);
    controller.startInput();
  }, [controller, stopAnyCapture]);

  const changeLocation = (id: LocationId) => {
    if (id === locationId) return;
    stopAnyCapture();
    setDraft(""); setDraftStarted(false); setLastTranscript(""); setMicNotice(null); setFilter("all");
    controller.setLocation(id);
  };

  // ---- typed -----------------------------------------------------------
  const onDraftChange = useCallback(
    (v: string) => {
      setInputMode("text");
      // The first keystroke of a draft — in ANY editable phase — opens the
      // typed-input lifecycle: startInput() cancels an in-flight parse (a late
      // response can no longer apply), invalidates review/pending and holds
      // `busy` so Review/Confirm stay blocked until the draft is submitted,
      // discarded or erased. (A's first-intake correction on PR #2.)
      if (!draftStarted && (v.trim() !== "" || (offer && v !== "")) && phase !== "committed") {
        cancelSpeech();
        endRequirementsDraft();
        controller.startInput();
        setDraftStarted(true);
      } else if (draftStarted && v.trim() === "") {
        controller.endInput(); // erased the draft: release capture, do not strand Review
        setDraftStarted(false);
      }
      setDraft(v);
    },
    [controller, phase, draftStarted, offer, endRequirementsDraft],
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
    if (state.review) speak(reviewToSpeech(state.review, menu));
  }, [state.review, menu]);

  // Read only the accepted controller reply or the exact immutable review.
  // A new input, mode switch, reset, or unmount cancels the old utterance.
  const replyId = phase === "committed" ? undefined : phase === "reviewing" ? state.review?.id : offerSpeechId ?? assistant?.id;
  const replyText = phase === "committed" ? undefined : phase === "reviewing" && state.review
    ? reviewToSpeech(state.review, menu)
    : [assistant?.text, offerSpeech].filter(Boolean).join(" ");
  const abortCapture = speech.abort;
  const endCapture = controller.endInput;
  useEffect(() => {
    // A final capture normally ends before an offer arrives. Enforce that
    // boundary here too: an offer must never play into an active microphone.
    if (offerSpeechId && speech.active) {
      abortCapture();
      endCapture();
      return cancelSpeech;
    }
    if (!readReplies || busy || speech.active || !replyText) {
      cancelSpeech();
      return cancelSpeech;
    }
    if (offerSpeechId) {
      // Queue only offer playback so React's development effect replay can
      // cancel the first setup before speaking. Ack + offer is one utterance.
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled && !spokenOffers.current.has(offerSpeechId)) {
          spokenOffers.current.add(offerSpeechId);
          speak(replyText);
        }
      });
      return () => { cancelled = true; cancelSpeech(); };
    }
    speak(replyText);
    return cancelSpeech;
  }, [replyId, replyText, readReplies, busy, speech.active, abortCapture, endCapture, offerSpeechId]);

  // ---- derived ---------------------------------------------------------
  // busy covers capture + draft + parsing; only the last one is "working on" text.
  const parsing = busy && !speech.active && !draftStarted && !requirementsDraftActive;
  const requirementsReady = !state.requirements?.decision && (state.requirements?.checks.every(check => check.status === "match") ?? true);
  const canReview = phase === "editing" && state.lines.length > 0 && !state.pending && !busy && requirementsReady;
  const canConfirm = phase === "reviewing" && !busy && !speech.active && !draftStarted && requirementsReady;
  const editable = phase === "editing" || phase === "clarifying";
  const conversationStatus = speech.active ? "Listening" : parsing ? "Processing" : speaking ? "Responding" : "Ready";
  const venue = locationId === "demo"
    ? { name: "Demo Counter", location: "Seeded menu · sample prices" }
    : menu.location(locationId) ?? { name: menu.locationName(locationId), location: "" };
  const waitLabel = state.wait?.status === "known" && state.wait.estimateMinutes !== null
    ? `~${state.wait.estimateMinutes} min wait`
    : state.lines.length === 0 ? "Wait shown after you add items" : "Wait unavailable";
  const stepIndex = phase === "committed" ? 3 : phase === "reviewing" ? 2 : 1;
  const itemCount = state.lines.reduce((n, l) => n + l.qty, 0);
  const firstItem = locationId === "demo" ? null : menu.itemsForLocation(locationId)[0] ?? null;
  const placeholder = locationId === "demo"
    ? undefined
    : firstItem ? `Say or type it — “one ${firstItem.label}”` : "Choose a location with published prices to add food";
  const hint = locationId === "demo"
    ? undefined
    : firstItem ? "Include the item’s name and size." : "You can still edit items already in your cart.";
  // The assistant speaks in the order rail: its reply while ordering, the exact review
  // snapshot while reviewing, and the pickup line once the order is placed.
  const speechText = phase === "committed"
    ? `Your order is in. ${state.wait?.status === "known" && state.wait.estimateMinutes !== null ? `Pick up at ${venue.name} in about ${state.wait.estimateMinutes} minutes.` : `Pick up at ${venue.name}.`}`
    : phase === "reviewing" && state.review
      ? reviewToSpeech(state.review, menu)
      : assistant?.text || (state.lines.length ? "Anything else? Say another item, or review your order." : "What sounds good? Say or type your order, or tap an item.");
  const STEPS: readonly [string, number][] = [["Menu", 1], ["Review", 2], ["Pick up", 3]];

  return (
    <div className={styles.kiosk} data-testid="kiosk" data-phase={phase}>
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <span className={styles.logoMark} aria-hidden="true">T</span>
          <span className={styles.brand}>TartanOrder</span>
        </div>
        <div className={styles.venue}>
          <div className={styles.venueName}>{venue.name}</div>
          <div className={styles.venueMeta}>{[venue.location, waitLabel].filter(Boolean).join(" · ")}</div>
        </div>
        <ol className={styles.steps} aria-label="Order progress">
          {STEPS.map(([label, n]) => (
            <li key={n} className={`${styles.step} ${n === stepIndex ? styles.stepOn : ""}`} aria-current={n === stepIndex ? "step" : undefined}>
              <span className={styles.stepNum}>{n}</span>
              {label}
            </li>
          ))}
        </ol>
      </header>

      {notice && (
        <div className={styles.notice} role="status" data-testid="notice">
          {notice}
        </div>
      )}

      {phase !== "committed" && (
        <section className={styles.askBar} aria-label="Order assistant">
          <div className={styles.askHead}>
            <span className={styles.conversationStatus} data-testid="conversation-status" role="status">{conversationStatus}</span>
            {tts && <label className={styles.readReplies}><input type="checkbox" checked={readReplies} onChange={(event) => setReadReplies(event.target.checked)} /> Read replies aloud</label>}
          </div>
          <InputBar
            placeholder={placeholder}
            hint={hint}
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
      )}

      {phase === "committed" && state.receipt ? (
        <main className={`${styles.main} ${styles.mainDone}`}>
          <Ticket receipt={state.receipt} onNewOrder={newOrder} wait={state.wait} />
          <div className={styles.right}>
            <p className={styles.speech} data-testid="assistant-response" aria-live="polite">{speechText}</p>
            <section className={styles.cartPanel}>
              <h2 className={styles.panelTitle}>Order total</h2>
              <div className={styles.totals}>
                <span>Items</span><span>{state.receipt.lines.reduce((n, l) => n + l.qty, 0)}</span>
                <span>Tax</span><span>not applied</span>
                <span className={styles.totalRow}>Total</span><span className={styles.totalRow}>{formatCents(state.receipt.totalCents)}</span>
              </div>
              <p className={styles.muted}>Listed menu prices only. Nothing was sent to a dining location.</p>
            </section>
          </div>
        </main>
      ) : (
        <main className={styles.main}>
          <aside className={styles.rail} aria-label="Browse the menu">
            <CategoryRail locationId={locationId} value={filter} onChange={setFilter} />
            <DiningLocation locationId={locationId} onChange={changeLocation} />
          </aside>

          <div className={styles.center}>
            <RequirementsPanel key={`${state.sessionId}:${requirementsDraftEpoch}`} requirements={state.requirements} lines={state.lines} acceptedTotalCents={state.totalCents} locationId={locationId} disabled={busy && !requirementsDraftActive} onAction={act} onStartDraft={startRequirementsDraft} onEndDraft={endRequirementsDraft} />
            <MenuButtons key={locationId} locationId={locationId} disabled={!editable} onOps={manual} filter={filter} profile={state.requirements?.profile} onMealItem={state.requirements?.meal ? itemId => act({ type: "REQUIREMENTS", locationId, changes: [{ type: "SELECT_ITEM", itemId, modifiers: [], locked: false }] }) : undefined} />
          </div>

          <div className={styles.right}>
            <p className={styles.speech} data-testid="assistant-response" aria-live="polite">{speechText}</p>
            <RequirementsSummary requirements={state.requirements} />
            {offer && state.wait && <SwapOfferPanel offer={offer} source={state.wait.source} disabled={busy || speech.active} onAction={act} />}
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
                wait={state.wait}
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
                  wait={state.wait}
                />
                <WaitEstimate wait={state.wait} />
                <div className={styles.cartFooter}>
                  <div className={styles.totals}>
                    <span>Items</span><span>{itemCount}</span>
                    <span>Tax</span><span>not applied</span>
                    <span className={styles.totalRow}>Total</span>
                    <span className={styles.totalRow} data-testid="total">{formatCents(state.totalCents)}</span>
                  </div>
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
                      Review order{itemCount > 0 ? ` · ${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}
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
        <div className={styles.footerRight}>
          <span className={styles.subBrand} data-testid="disclosure">{locationId === "demo" ? DEMO_DISCLOSURE : CAMPUS_DISCLOSURE}</span>
          <div className={styles.badges} aria-label="Current modes">
            <span className={styles.badge} data-testid="badge-parser">
              parser: {parser}
            </span>
            <span className={styles.badge} data-testid="badge-input">
              input: {inputMode === "voice" ? `voice (${speech.engine})` : "text"}
            </span>
            <span className={styles.badge} data-testid="catalog-source">{catalogSourceLabel(catalogSource, menu.catalog.versionId)}</span>
            <span className={`${styles.badge}${controller.persistence.state === "failed" ? ` ${styles.badgeWarn}` : ""}`} data-testid="persistence" data-state={controller.persistence.state} title={controller.persistence.message ?? undefined}>
              {PERSISTENCE_TEXT[controller.persistence.state]}
              {controller.persistence.state === "failed" && <>{" "}<button type="button" className={styles.linkBtn} data-testid="persistence-retry" onClick={controller.retryPersistence}>Retry</button></>}
            </span>
            {localOnly && <span className={styles.badge}>local only</span>}
            {parser === "fixture" && <span className={`${styles.badge} ${styles.badgeWarn}`}>fixture</span>}
            {busy && (
              <span className={`${styles.badge} ${styles.badgeBusy}`} data-testid="badge-busy">
                {speech.active ? "listening" : draftStarted || requirementsDraftActive ? "typing" : "working"}
              </span>
            )}
          </div>
        </div>
      </footer>
      <div className={styles.engArea}>
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
      </div>
    </div>
  );
}

export default Kiosk;
