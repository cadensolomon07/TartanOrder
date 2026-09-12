import { createTranscribeHandler } from "@/voice/transcribe.server";
export const runtime = "nodejs";
export const maxDuration = 20;
export const POST = createTranscribeHandler();
