import { z } from "zod";
import { LIMITS } from "./index";
export const AUDIO_LIMITS = { bytes: 2_000_000, recordingMs: 30_000, serverMs: 15_000, clientMs: 18_000 } as const;
export const AudioLanguageSchema = z.enum(["es-ES", "zh-CN"]);
export type AudioLanguage = z.infer<typeof AudioLanguageSchema>;
export const TranscriptSchema = z.strictObject({ text: z.string().trim().max(LIMITS.transcriptChars) });
export const TranscriptionResponseSchema = z.strictObject({ v: z.literal(1), language: AudioLanguageSchema, transcriber: z.literal("gemini"), text: z.string().trim().min(1).max(LIMITS.transcriptChars) });
export const AUDIO_MIMES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"] as const;
