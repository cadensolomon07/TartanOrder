"use client";
// Push-to-talk wrapper around the browser's built-in speech recognition.
// Guarantees: at most ONE onFinal per capture, interim text is display-only,
// TTS is cancelled before the mic opens, and every handler is bound to the
// recognition object it was installed on — an event from an aborted or
// superseded object is dropped, so a stale callback can never end, fail or
// submit a newer capture. No continuous listening, no barge-in, no offline promise.

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

export type UseSpeechOptions = {
  onFinal: (text: string, asrConfidence: number | null) => void;
  onFail: (reason: SpeechFailure) => void;
  lang?: string;
};

export type UseSpeech = {
  supported: boolean;
  // true from the moment the engine says it is listening
  listening: boolean;
  // true from start() until the capture settles (covers the pre-onstart gap)
  active: boolean;
  interim: string;
  // Opens a capture. Returns false (and calls onFail("unsupported") or nothing)
  // when no new capture was opened.
  start: () => boolean;
  stop: () => void;
  abort: () => void;
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
  onstart: (() => void) | null;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => RecognitionLike;

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
  // The CURRENT recognition object. Handlers compare against it; anything else is stale.
  const recRef = useRef<RecognitionLike | null>(null);
  // "settled" means the current capture has already produced its one outcome
  // (final text OR a failure). Anything arriving afterwards is ignored.
  const settledRef = useRef(true);
  const onFinalRef = useRef(onFinal);
  const onFailRef = useRef(onFail);
  useEffect(() => {
    onFinalRef.current = onFinal;
    onFailRef.current = onFail;
  });

  const settle = useCallback((outcome: () => void) => {
    if (settledRef.current) return;
    settledRef.current = true;
    setListening(false);
    setActive(false);
    setInterim("");
    outcome();
  }, []);

  const start = useCallback((): boolean => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      onFailRef.current("unsupported");
      return false;
    }
    if (recRef.current && !settledRef.current) return false; // a live capture is already open
    // A settled object whose end event has not arrived yet is dead: detach it.
    detach(recRef.current);
    recRef.current = null;
    cancelSpeech(); // never let our own read-back be heard as the user

    const r = new Ctor();
    const isCurrent = () => recRef.current === r;
    recRef.current = r;
    settledRef.current = false;
    setActive(true);
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;

    r.onstart = () => {
      if (isCurrent()) setListening(true);
    };
    r.onresult = (e) => {
      if (!isCurrent() || settledRef.current) return;
      const last = e.results[e.results.length - 1];
      if (!last) return;
      if (!last.isFinal) {
        setInterim(last[0].transcript);
        return;
      }
      const text = last[0].transcript.trim();
      const c = last[0].confidence;
      const conf = typeof c === "number" && Number.isFinite(c) && c > 0 ? c : null;
      settle(() => (text ? onFinalRef.current(text, conf) : onFailRef.current("empty")));
    };
    r.onerror = (e) => {
      if (!isCurrent()) return;
      settle(() => onFailRef.current(mapError(e.error)));
    };
    r.onend = () => {
      if (!isCurrent()) return;
      // Ended with no final result and no error => nothing captured.
      settle(() => onFailRef.current("empty"));
      recRef.current = null;
    };
    try {
      r.start();
    } catch {
      recRef.current = null;
      detach(r);
      settle(() => onFailRef.current("error"));
      return false;
    }
    return true;
  }, [lang, settle]);

  // User is done talking: let the engine emit its final result, then end.
  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  // Discard the capture entirely. The object is dropped from recRef and
  // detached FIRST, so a result or end event already in flight is a no-op.
  const abort = useCallback(() => {
    const r = recRef.current;
    settledRef.current = true;
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

  return { supported, listening, active, interim, start, stop, abort };
}
