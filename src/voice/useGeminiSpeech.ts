"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AUDIO_LIMITS, TranscriptionResponseSchema } from "@/contracts/audio";
import type { Language } from "@/contracts/languages";
import { cancelSpeech } from "./tts";
import type { OnDeviceStatus } from "./useSpeech";

const subscribe = () => () => {};
const supportedNow = () => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
const formats = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
type Options = { language: Language; localOnly: boolean; onFinal(text: string, confidence: null): void; onFail(code: string): void };
type Capture = { controller: AbortController; stream?: MediaStream; recorder?: MediaRecorder; chunks: Blob[]; bytes: number; timer?: ReturnType<typeof setTimeout>; stopping: boolean; uploading?: boolean };

/** A cancelled permission prompt, recording, upload or late response can never submit. */
export function useGeminiSpeech(options: Options) {
  const supported = useSyncExternalStore(subscribe, supportedNow, () => false);
  const [phase, setPhase] = useState<"idle" | "opening" | "recording" | "transcribing">("idle");
  const capture = useRef<Capture | null>(null);
  const callbacks = useRef(options);
  useEffect(() => { callbacks.current = options; });
  const release = useCallback((current: Capture) => {
    if (current.timer) clearTimeout(current.timer);
    current.stream?.getTracks().forEach(track => track.stop());
    if (current.recorder) {
      current.recorder.ondataavailable = null; current.recorder.onstop = null; current.recorder.onerror = null;
      if (current.recorder.state !== "inactive") { try { current.recorder.stop(); } catch {} }
    }
    current.chunks = [];
  }, []);
  const abort = useCallback(() => {
    const current = capture.current; capture.current = null;
    if (current) { current.controller.abort(); release(current); }
    setPhase("idle");
  }, [release]);
  useEffect(() => () => {
    const current = capture.current; capture.current = null;
    if (current) { current.controller.abort(); release(current); }
  }, [release]);
  const fail = useCallback((current: Capture, code: string) => {
    if (capture.current !== current) return;
    capture.current = null; current.controller.abort(); release(current); setPhase("idle"); callbacks.current.onFail(code);
  }, [release]);
  const transcribe = useCallback(async (current: Capture, mime: string, language: Language) => {
    if (capture.current !== current || current.uploading) return;
    current.uploading = true;
    if (current.timer) clearTimeout(current.timer);
    current.stream?.getTracks().forEach(track => track.stop());
    const audio = new Blob(current.chunks, { type: mime }); current.chunks = [];
    if (!audio.size) { fail(current, "EMPTY_AUDIO"); return; }
    setPhase("transcribing");
    current.timer = setTimeout(() => fail(current, "TRANSCRIPTION_TIMEOUT"), AUDIO_LIMITS.clientMs);
    try {
      const response = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": mime, "X-Audio-Language": language }, body: audio, signal: current.controller.signal });
      if (capture.current !== current) return;
      if (!response.ok) { fail(current, "TRANSCRIPTION_UNAVAILABLE"); return; }
      const checked = TranscriptionResponseSchema.safeParse(await response.json());
      if (capture.current !== current) return;
      if (!checked.success || checked.data.language !== language) { fail(current, "INVALID_TRANSCRIPT"); return; }
      capture.current = null; release(current); setPhase("idle"); callbacks.current.onFinal(checked.data.text, null);
    } catch { fail(current, "TRANSCRIPTION_UNAVAILABLE"); }
  }, [fail, release]);
  const stop = useCallback(() => {
    const current = capture.current;
    if (!current || current.stopping) return;
    current.stopping = true;
    if (!current.recorder) { abort(); callbacks.current.onFail("CANCELLED"); return; }
    try { current.recorder.stop(); } catch { fail(current, "RECORDING_FAILED"); }
  }, [abort, fail]);
  const start = useCallback(() => {
    if (capture.current) return false;
    const { language, localOnly } = callbacks.current;
    if (!supported || localOnly || language === "en-US") { callbacks.current.onFail("TRANSCRIPTION_UNAVAILABLE"); return false; }
    cancelSpeech();
    const current: Capture = { controller: new AbortController(), chunks: [], bytes: 0, stopping: false };
    capture.current = current; setPhase("opening");
    current.timer = setTimeout(() => fail(current, "MICROPHONE_TIMEOUT"), AUDIO_LIMITS.recordingMs);
    void navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      if (capture.current !== current) { stream.getTracks().forEach(track => track.stop()); return; }
      current.stream = stream;
      const mime = formats.find(format => MediaRecorder.isTypeSupported(format));
      if (!mime) { fail(current, "UNSUPPORTED_AUDIO"); return; }
      const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64000 }); current.recorder = recorder;
      recorder.ondataavailable = event => {
        if (capture.current !== current) return;
        current.bytes += event.data.size;
        if (current.bytes > AUDIO_LIMITS.bytes) { fail(current, "AUDIO_TOO_LARGE"); return; }
        if (event.data.size) current.chunks.push(event.data);
      };
      recorder.onerror = () => fail(current, "RECORDING_FAILED");
      recorder.onstop = () => { void transcribe(current, recorder.mimeType || mime, language); };
      recorder.start(250); setPhase("recording");
      if (current.timer) clearTimeout(current.timer);
      // Reaching the cap discards the clip instead of silently submitting a partial order.
      current.timer = setTimeout(() => fail(current, "RECORDING_TOO_LONG"), AUDIO_LIMITS.recordingMs);
    }).catch(() => fail(current, "MICROPHONE_UNAVAILABLE"));
    return true;
  }, [supported, fail, transcribe]);
  return { supported: supported && !options.localOnly, active: phase !== "idle", listening: phase === "recording", transcribing: phase === "transcribing", interim: "", engine: "gemini" as const, onDevice: "unsupported" as OnDeviceStatus, isBrave: false, installOnDevice: async (): Promise<OnDeviceStatus> => "unsupported", start, stop, abort };
}
