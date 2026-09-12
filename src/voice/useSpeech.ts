"use client";
// Push-to-talk wrapper around the browser's built-in speech recognition.
// Guarantees: at most ONE complete onFinal per capture, interim text is display-only,
// TTS is cancelled before the mic opens, and every handler is bound to the
// recognition object it was installed on — an event from an aborted or
// superseded object is dropped, so a stale callback can never end, fail or
// submit a newer capture. Listening lasts only for an explicit Talk capture;
// recognition is never restarted after Stop/end. No offline promise.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cancelSpeech } from "./tts";

export type SpeechFailure =
  | "unsupported"
  | "not-allowed"
  | "no-speech"
  | "network"
  | "aborted"
  | "empty"
  | "error";

// Which recognizer handled (or will handle) the capture.
//   cloud     – the browser's remote speech service (Chrome: Google's servers)
//   on-device – Chrome 139+ local recognition (processLocally); needs a one-time
//               language-pack download; never contacts a speech server
export type SpeechEngine = "cloud" | "on-device";
// Result of SpeechRecognition.available({ processLocally: true }).
export type OnDeviceStatus = "unknown" | "unsupported" | "unavailable" | "downloadable" | "downloading" | "available";

export type FailureContext = { engine: SpeechEngine; onDevice: OnDeviceStatus; isBrave: boolean };
export type UseSpeechOptions = {
  onFinal: (text: string, asrConfidence: number | null) => void;
  onFail: (reason: SpeechFailure, ctx: FailureContext) => void;
  lang?: string;
};

export type UseSpeech = {
  supported: boolean;
  // true from the moment the engine says it is listening
  listening: boolean;
  // true from start() until the capture settles (covers the pre-onstart gap)
  active: boolean;
  interim: string;
  // Engine used by the current/last capture.
  engine: SpeechEngine;
  // On-device language pack status for `lang` (see OnDeviceStatus).
  onDevice: OnDeviceStatus;
  // true if this browser looks like Brave (its speech recognition has no backend).
  isBrave: boolean;
  // Opens a capture. Returns false (and calls onFail("unsupported") or nothing)
  // when no new capture was opened.
  start: () => boolean;
  stop: () => void;
  abort: () => void;
  // Download the on-device language pack (call from a user gesture). Resolves
  // to the resulting OnDeviceStatus.
  installOnDevice: () => Promise<OnDeviceStatus>;
};

// Minimal structural types so this compiles without lib.dom speech typings.
type RecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string; confidence: number };
};
type RecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
};
type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  onstart: (() => void) | null;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type AvailabilityOptions = { langs: string[]; processLocally?: boolean };
type RecognitionCtor = (new () => RecognitionLike) & {
  // Chrome 139+: on-device availability / language-pack install.
  available?: (o: AvailabilityOptions) => Promise<string>;
  install?: (o: AvailabilityOptions) => Promise<boolean>;
};

export function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function mapError(code: string): SpeechFailure {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "not-allowed";
    case "no-speech":
      return "no-speech";
    case "network":
      return "network";
    case "aborted":
      return "aborted";
    default:
      return "error";
  }
}

export function detectBrave(): boolean {
  if (typeof navigator === "undefined") return false;
  const n = navigator as unknown as { brave?: unknown; userAgentData?: { brands?: { brand: string }[] } };
  return !!n.brave || !!n.userAgentData?.brands?.some((b) => /brave/i.test(b.brand));
}

function toStatus(v: string): OnDeviceStatus {
  return v === "available" || v === "downloadable" || v === "downloading" || v === "unavailable" ? v : "unknown";
}

// Ask the browser whether on-device recognition exists for `lang`.
export async function onDeviceAvailability(lang: string): Promise<OnDeviceStatus> {
  const Ctor = getRecognitionCtor();
  if (!Ctor || typeof Ctor.available !== "function") return "unsupported";
  try {
    return toStatus(await Ctor.available({ langs: [lang], processLocally: true }));
  } catch {
    return "unknown";
  }
}

// How long a language-pack download may take before we stop waiting on it.
export const INSTALL_TIMEOUT_MS = 90_000;
// How long the cloud->on-device hand-over may wait for the availability probe.
export const HANDOVER_TIMEOUT_MS = 4_000;
// Stop allows final recognition results to arrive, but cannot hold the input
// lock forever. A missing end event fails the capture rather than submitting a prefix.
export const STOP_TIMEOUT_MS = 5_000;

// Drop every handler so a lingering object can never call back into the hook.
function detach(r: RecognitionLike | null) {
  if (!r) return;
  r.onstart = null;
  r.onresult = null;
  r.onerror = null;
  r.onend = null;
}

// Support is a property of the browser, not of React state: read it through
// useSyncExternalStore so the server render says "no" and the client says the
// truth without a setState-in-effect.
const noop = () => () => {};
const supportedNow = () => getRecognitionCtor() !== null;
const supportedOnServer = () => false;

export function useSpeech({ onFinal, onFail, lang = "en-US" }: UseSpeechOptions): UseSpeech {
  const supported = useSyncExternalStore(noop, supportedNow, supportedOnServer);
  const [listening, setListening] = useState(false);
  const [active, setActive] = useState(false);
  const [interim, setInterim] = useState("");
  const [engine, setEngine] = useState<SpeechEngine>("cloud");
  const [onDevice, setOnDevice] = useState<OnDeviceStatus>("unknown");
  const isBrave = useSyncExternalStore(noop, detectBrave, () => false);
  // Once the cloud service has failed with a network error this session, prefer
  // on-device for every later capture (when its pack is installed).
  const preferLocalRef = useRef(false);
  const onDeviceRef = useRef<OnDeviceStatus>("unknown");
  // The CURRENT recognition object. Handlers compare against it; anything else is stale.
  const recRef = useRef<RecognitionLike | null>(null);
  // "settled" means the current capture has already produced its one outcome
  // (final text OR a failure). Anything arriving afterwards is ignored.
  const settledRef = useRef(true);
  const genRef = useRef(0);
  const stoppedRef = useRef(false);
  const engineRef = useRef<SpeechEngine>("cloud");
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinalRef = useRef(onFinal);
  const onFailRef = useRef(onFail);
  useEffect(() => {
    onFinalRef.current = onFinal;
    onFailRef.current = onFail;
  });

  const settle = useCallback((outcome: () => void) => {
    if (settledRef.current) return;
    settledRef.current = true;
    if (stopTimerRef.current !== null) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    detach(recRef.current);
    recRef.current = null;
    setListening(false);
    setActive(false);
    setInterim("");
    outcome();
  }, []);

  const updateOnDevice = useCallback((s: OnDeviceStatus) => {
    onDeviceRef.current = s;
    setOnDevice(s);
  }, []);

  // NEVER probe availability at page load: SpeechRecognition.available() is
  // only needed once the cloud path has failed (or the user asks to download),
  // and at least one Chromium build (the headless shell) crashes the renderer
  // on that call. Resolve lazily and remember the answer.
  const ensureOnDevice = useCallback(async (): Promise<OnDeviceStatus> => {
    if (onDeviceRef.current !== "unknown") return onDeviceRef.current;
    const s = await onDeviceAvailability(lang);
    updateOnDevice(s);
    return s;
  }, [lang, updateOnDevice]);

  const fail = useCallback(
    (reason: SpeechFailure, engine: SpeechEngine) => {
      settle(() => onFailRef.current(reason, { engine, onDevice: onDeviceRef.current, isBrave: detectBrave() }));
    },
    [settle],
  );

  const installOnDevice = useCallback(async (): Promise<OnDeviceStatus> => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || typeof Ctor.install !== "function") {
      updateOnDevice("unsupported");
      return "unsupported";
    }
    const before = await ensureOnDevice();
    if (before === "available" || before === "unsupported" || before === "unavailable") return before;
    if (before !== "downloading") updateOnDevice("downloading");
    // install() can hang forever in browsers that cannot reach Google's component
    // updater (keyless Chromium builds). Bound it, then re-ask the browser what
    // the real status is instead of guessing: only an explicit `false` from
    // install() means "unavailable".
    let ok: boolean | "timeout";
    try {
      ok = await Promise.race<boolean | "timeout">([
        Ctor.install({ langs: [lang], processLocally: true }),
        new Promise<"timeout">((res) => setTimeout(() => res("timeout"), INSTALL_TIMEOUT_MS)),
      ]);
    } catch {
      ok = "timeout";
    }
    // Whatever install() said, the browser's own availability answer is the
    // truth (a failed or timed-out download usually leaves the pack "downloadable",
    // so the retry control stays visible).
    const s = await onDeviceAvailability(lang);
    // A status that still says "downloading" after our deadline is a hang for our purposes.
    const final: OnDeviceStatus = s === "downloading" ? "downloadable" : s === "unknown" && ok === false ? "unavailable" : s;
    updateOnDevice(final);
    return final;
  }, [lang, updateOnDevice, ensureOnDevice]);

  // Open one recognition object for the current capture. `tried` records the
  // engines already attempted in this capture so a failure can retry the
  // other engine exactly once without a second Talk press. The retry goes
  // through openRef (a callback cannot reference itself before declaration).
  const openRef = useRef<(Ctor: RecognitionCtor, mode: SpeechEngine, tried: Set<SpeechEngine>) => boolean>(() => false);
  const open = useCallback(
    (Ctor: RecognitionCtor, mode: SpeechEngine, tried: Set<SpeechEngine>): boolean => {
      cancelSpeech();
      const r = new Ctor();
      const generation = genRef.current;
      const isCurrent = () => recRef.current === r && genRef.current === generation;
      // Web Speech's result list is cumulative. Indexing final chunks avoids
      // duplicating them when a later event repeats earlier results.
      const finalChunks = new Map<number, { text: string; confidence: number | null }>();
      let unfinishedText = "";
      let heardSpeech = false;
      const finalParts = () => [...finalChunks.entries()].sort(([a], [b]) => a - b).map(([, chunk]) => chunk).filter((chunk) => chunk.text);
      recRef.current = r;
      tried.add(mode);
      engineRef.current = mode;
      setEngine(mode);
      r.lang = lang;
      r.interimResults = true;
      r.continuous = true;
      r.maxAlternatives = 1;
      if ("processLocally" in r || mode === "on-device") r.processLocally = mode === "on-device";

      r.onstart = () => {
        if (isCurrent() && !settledRef.current && !stoppedRef.current) setListening(true);
      };
      r.onresult = (e) => {
        if (!isCurrent() || settledRef.current) return;
        const interimParts: string[] = [];
        for (let index = 0; index < e.results.length; index += 1) {
          const result = e.results[index];
          const alternative = result?.[0];
          if (!alternative) continue;
          const text = alternative.transcript.trim();
          if (result.isFinal) {
            const confidence = alternative.confidence;
            finalChunks.set(index, {
              text,
              confidence: typeof confidence === "number" && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : null,
            });
          } else if (text) {
            interimParts.push(text);
          }
        }
        unfinishedText = interimParts.join(" ");
        const display = [...finalParts().map((chunk) => chunk.text), unfinishedText].filter(Boolean).join(" ");
        heardSpeech ||= display.length > 0;
        setInterim(display);
      };
      // Drop this object without settling the capture, so another engine can
      // take over the same Talk press.
      const supersede = () => {
        detach(r);
        recRef.current = null;
        setListening(false);
        setInterim("");
      };
      r.onerror = (e) => {
        if (!isCurrent() || settledRef.current) return; // a settled capture never re-opens anything
        const failure = mapError(e.error);
        // Once any words were heard, restarting would lose the beginning of the
        // utterance. Ask for a retry rather than submit or recapture only its tail.
        if (heardSpeech) {
          fail(failure, mode);
          return;
        }
        // Cloud service unreachable (keyless Chromium, blocked endpoint, Brave):
        // find out — only now — whether on-device recognition exists. If its
        // pack is installed, retry this same capture on-device; if it is
        // downloadable, start the download so the NEXT Talk works; then report.
        if (mode === "cloud" && failure === "network" && !tried.has("on-device")) {
          preferLocalRef.current = true;
          const gen = genRef.current;
          // If the user already pressed Stop, their utterance is gone: do not
          // silently re-open the microphone. Learn the status for next time
          // and report this capture as failed.
          supersede();
          // The probe is bounded: a browser that never answers must not hold
          // the capture open (Stop during the hand-over settles it at once, see stop()).
          const probe = Promise.race<OnDeviceStatus>([
            ensureOnDevice(),
            new Promise<OnDeviceStatus>((res) => setTimeout(() => res("unknown"), HANDOVER_TIMEOUT_MS)),
          ]);
          void probe.then((s) => {
            if (settledRef.current || gen !== genRef.current) return; // aborted, stopped, or a newer Talk press
            if (!stoppedRef.current && s === "available" && openRef.current(Ctor, "on-device", tried)) return;
            if (s === "downloadable") {
              // Say "downloading" in the failure report: the download is started right here.
              updateOnDevice("downloading");
              void installOnDevice();
            }
            fail("network", "cloud");
          });
          return;
        }
        // Cloud failed after on-device was already tried this capture: still make
        // sure the pack download is underway for next time.
        if (mode === "cloud" && failure === "network" && onDeviceRef.current === "downloadable") void installOnDevice();
        if (mode === "on-device" && e.error === "language-not-supported") {
          // The browser said the pack was there and now says it is not.
          updateOnDevice("downloadable");
          // On-device was the first engine of this capture: fall back to cloud once.
          if (!stoppedRef.current && !tried.has("cloud")) {
            supersede();
            if (openRef.current(Ctor, "cloud", tried)) return;
          }
        }
        // On-device was the retry after a cloud network failure and the ENGINE
        // itself failed (not the user staying silent or denying the mic): the
        // honest reason for this capture failing is still that the service is unreachable.
        const engineFailed = failure === "error" || e.error === "language-not-supported";
        fail(mode === "on-device" && tried.has("cloud") && engineFailed ? "network" : failure, mode);
      };
      r.onend = () => {
        if (!isCurrent() || settledRef.current) return;
        const parts = finalParts();
        // An unfinished trailing segment means the complete request was not
        // recognized. Never send the finalized prefix as though it were complete.
        if (unfinishedText) {
          fail("error", mode);
          return;
        }
        const text = parts.map((chunk) => chunk.text).join(" ");
        if (!text) {
          fail("empty", mode);
          return;
        }
        // Multiple chunks have no single measured confidence. Do not invent an average.
        const confidence = parts.length === 1 ? parts[0].confidence : null;
        settle(() => onFinalRef.current(text, confidence));
      };
      try {
        r.start();
      } catch {
        recRef.current = null;
        detach(r);
        return false;
      }
      return true;
    },
    [lang, settle, fail, ensureOnDevice, installOnDevice, updateOnDevice],
  );

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const start = useCallback((): boolean => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      onFailRef.current("unsupported", { engine: "cloud", onDevice: onDeviceRef.current, isBrave: detectBrave() });
      return false;
    }
    if (!settledRef.current) return false; // a live capture (or its engine hand-over) is already open
    // A settled object whose end event has not arrived yet is dead: detach it.
    detach(recRef.current);
    recRef.current = null;
    cancelSpeech(); // never let our own read-back be heard as the user

    genRef.current += 1;
    settledRef.current = false;
    stoppedRef.current = false;
    setActive(true);
    // On-device first when its pack is installed and the cloud service has
    // already failed once (or the browser is Brave, whose cloud path never works).
    const useLocal = onDeviceRef.current === "available" && (preferLocalRef.current || isBrave);
    const opened = open(Ctor, useLocal ? "on-device" : "cloud", new Set<SpeechEngine>());
    if (!opened) {
      fail("error", useLocal ? "on-device" : "cloud");
      return false;
    }
    return true;
  }, [isBrave, open, fail]);

  // User is done talking: let the engine emit its final result, then end.
  const stop = useCallback(() => {
    if (settledRef.current || stoppedRef.current) return;
    stoppedRef.current = true;
    const r = recRef.current;
    if (r) {
      const generation = genRef.current;
      stopTimerRef.current = setTimeout(() => {
        if (settledRef.current || generation !== genRef.current || recRef.current !== r) return;
        fail("error", engineRef.current);
        try { r.abort(); } catch { /* Already stopped. */ }
      }, STOP_TIMEOUT_MS);
      try {
        r.stop();
      } catch {
        fail("error", engineRef.current);
        try { r.abort(); } catch { /* Already stopped. */ }
      }
      return;
    }
    // No object but not settled: an engine hand-over is in progress. The user
    // said they are done, so settle now (the pending probe then does nothing).
    if (!settledRef.current) fail("network", "cloud");
  }, [fail]);

  // Discard the capture entirely. The object is dropped from recRef and
  // detached FIRST, so a result or end event already in flight is a no-op.
  const abort = useCallback(() => {
    const r = recRef.current;
    genRef.current += 1; // pending engine hand-overs belong to an old generation now
    settledRef.current = true;
    if (stopTimerRef.current !== null) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    recRef.current = null;
    detach(r);
    setListening(false);
    setActive(false);
    setInterim("");
    try {
      r?.abort();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => () => abort(), [abort]);

  return { supported, listening, active, interim, engine, onDevice, isBrave, start, stop, abort, installOnDevice };
}
