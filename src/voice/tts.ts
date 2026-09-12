"use client";
// Optional spoken read-back. The visual review is always complete on its own;
// if voices are missing this silently does nothing.
import { useSyncExternalStore } from "react";

export function ttsAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

const noop = () => () => {};
const onServer = () => false;

// Hook form: false on the server render, the truth on the client.
export function useTtsAvailable(): boolean {
  return useSyncExternalStore(noop, ttsAvailable, onServer);
}

export function cancelSpeech(): void {
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
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}
