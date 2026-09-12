"use client";
// Optional spoken read-back. The visual review is always complete on its own;
// if voices are missing this silently does nothing.
import { useSyncExternalStore } from "react";

export function ttsAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

const noop = () => () => {};
const onServer = () => false;
const listeners = new Set<() => void>();
let activeUtterance: SpeechSynthesisUtterance | null = null;
let deadline: ReturnType<typeof setTimeout> | null = null;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => { listeners.delete(onChange); };
}

function finish(): void {
  if (deadline) clearTimeout(deadline);
  deadline = null;
  if (!activeUtterance) return;
  activeUtterance.onend = null;
  activeUtterance.onerror = null;
  activeUtterance = null;
  for (const listener of listeners) listener();
}

/** Includes queued read-back, until it ends, fails, or is cancelled. */
export function useSpeaking(): boolean {
  return useSyncExternalStore(subscribe, () => activeUtterance !== null, onServer);
}

// Hook form: false on the server render, the truth on the client.
export function useTtsAvailable(): boolean {
  return useSyncExternalStore(noop, ttsAvailable, onServer);
}

export function cancelSpeech(): void {
  // Clear identity before calling the browser: cancel can synchronously emit end.
  finish();
  if (!ttsAvailable()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

export function speak(text: string): boolean {
  if (!ttsAvailable() || !text.trim()) return false;
  try {
    cancelSpeech();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 1;
    activeUtterance = u;
    const settle = () => { if (activeUtterance === u) finish(); };
    u.onend = settle;
    u.onerror = settle;
    // A missing browser completion event must not leave the status stuck.
    deadline = setTimeout(() => {
      if (activeUtterance === u) cancelSpeech();
    }, Math.min(120_000, Math.max(15_000, text.length * 100)));
    for (const listener of listeners) listener();
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    finish();
    return false;
  }
}
