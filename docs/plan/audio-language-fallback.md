# Audio-clip language fallback plan — record the utterance, transcribe it with Gemini when English recognition fails

Written 2026-09-12. Objective: a customer who speaks a language other than English at the kiosk still gets their order understood. Today the browser recognizer is fixed to `en-US` (`src/voice/useSpeech.ts:160`, `:277`), so Spanish speech reaches `/api/interpret` as low-quality English text and is rejected with `UNSUPPORTED` or `OFF_MENU`. This plan records the microphone audio **alongside** the browser recognizer, and **only when the parse is rejected** sends that clip to Gemini for a verbatim transcript plus the spoken language, re-submits the transcript through the unchanged parser, and switches the recognizer to that language for the rest of the session. The English path is untouched: no added latency, and no audio leaves the browser unless the fallback fires.

Precedents: `docs/plan/supabase-persistence.md` (format, orchestrate use), `tasks/beyond-wrapper-plan.md` (Gemini conventions). `docs/integration.md:177,191,203,213` record "direct Gemini audio deferred / excluded"; this plan lifts that only for the rejected-utterance fallback, never for the main path.

Branch: `feat/audio-language-fallback` from `main` after `feat/dietary-marks` is committed (`src/contracts/index.ts` and `src/parser/gemini.server.ts` are modified on that branch and this plan touches both).

## Where the voice path stands today

- **Capture.** `useSpeech` (`src/voice/useSpeech.ts`) guarantees at most one `onFinal` per capture, never submits a prefix, and falls back cloud → on-device on a network error. `lang` is an option defaulting to `en-US`; nothing passes it. No `MediaRecorder`, `getUserMedia` or `AudioContext` code exists anywhere in `src/`.
- **Kiosk wiring.** `src/ui/Kiosk.tsx:110-122`: `onFinal` → `setLastTranscript`, `setLastConf`, `controller.submit(text, "voice", conf)`; `onFail` → `controller.endInput()` + `micFailureMessage`. `talk()` at `:139-151` calls `controller.startInput()` then `speech.start()`. `newOrder` at `:257-265` calls `controller.reset()`, clears draft / transcript / notice and stops any capture; the session id changes only there. TTS `speak()` is driven by the effect at `:288-314` and never plays into a live mic.
- **Submit.** `src/controller/controller.ts:167-214`: builds `ParseRequestSchema`, calls the injected `interpret`, validates `ParseResponseSchema`, dispatches `PARSE_RECEIVED`, then branches on `engine.lastOutcome` (`applied | clarify | rejected`) at `:191-205`; a rejection becomes the generic notice "I couldn't apply that request. Your cart was not changed." `submit` resolves to `void`; the only observable outcome is the last `audit` entry (`outcome`, `code`; `src/contracts/index.ts:510-516`) and `controller.notice`. There is no language signal of any kind.
- **Route.** `src/app/api/interpret/route.ts`: `admit()` (`:166-192`) gates content-length (413), JSON, foreign `menuVersion` (409), strict public schema (400), blank text (400); gemini mode requires `GEMINI_API_KEY` else 503 `PROVIDER_UNAVAILABLE` (`:269-279`); `deliver()` (`:282-319`) re-validates the envelope and grounds every item id against the public catalog; `emitLog` (`:401-414`) writes one JSON line per request and **never includes the transcript, headers or key** (asserted by `tests/parser/route.test.ts:199-205`). Provider cap `PROVIDER_TIMEOUT_MS = 14000` under a 15 s lifecycle (`:112`, `:330`). No rate limiter exists.
- **Gemini adapter.** `src/parser/gemini.server.ts`: `ENDPOINT_BASE` (`:53`), `x-goog-api-key` header (`:288`), `responseMimeType: application/json` + `responseJsonSchema` derived from Zod (`:302-303`), temperature 0, one `fetch`, `createDeadline` (`:321-336`), `GeminiError` with `mapStatus` / `mapFailure` (`:338-356`). The system prompt already says "Understand any language, but return canonical menu IDs and English labels" (`:243`): the parser accepts non-English **text**; the gap is speech only.
- **Contracts.** `LIMITS` (`src/contracts/index.ts:11-24`): `transcriptChars 1500`, `requestBytes 32768`, `serverTimeoutMs 15000`, `clientTimeoutMs 17000`. `CORE_CODES` (`:26-31`) include `UNSUPPORTED` and `OFF_MENU`; `HTTP_CODES` (`:33-36`) cover the transport failures. `ParseRequestSchema` (`:444-455`) has `source: voice | text | fixture` and no language field. `API_VERSION` is 3.
- **TTS.** `speak()` hardcodes `u.lang = "en-US"` (`src/voice/tts.ts:57`); review text is English.
- **Tests.** jsdom is opted into per file with `// @vitest-environment jsdom`. `tests/ui/useSpeech.test.ts:8-36` installs a `FakeRecognition` class on `window.webkitSpeechRecognition`. `tests/ui/kiosk.realController.test.tsx` mocks `@/parser/client` (`:16`) and mounts the real controller + Kiosk. `tests/parser/route.test.ts:8-11` mocks `@/parser/gemini.server` wholesale. Playwright injects a fake recognizer through `page.addInitScript` (`tests/e2e/kiosk.spec.ts:13-27`). CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit, build, `check:build`, keyless e2e.
- **Evals.** `evals/cases/schema.ts:32-44`: rows carry `source: typed | fixture | voice`, `intended`, `asrConfidence`, `expectOverrides`. `evals/cases/heldout.jsonl:22-24` (`ho-022` Spanish, `ho-023` German, `ho-024` mixed) expect rules → `reject UNSUPPORTED` and gemini → the correct cart. `docs/evaluation.md:94` lists voice-sourced cases as a known gap.

## Invariants that must survive

1. **One outcome per capture.** At most one submit from the recognizer plus at most one fallback re-submit per Talk press. A clip over the caps is discarded, never truncated: the fallback must not submit a prefix of the order.
2. **The English path is unchanged.** Same latency, same behaviour offline and in `localOnly`. Recorder failure (permission denied, no `MediaRecorder`, unsupported type) never blocks or delays the recognizer; the fallback is simply unavailable.
3. **Audio leaves the browser only after a rejected voice submission.** One clip at a time, in memory only, discarded on apply, on the next Talk, on New order, and after the fallback attempt. Never persisted. Server logs never carry audio bytes, the transcript, headers or the key.
4. **Zod at every edge, engine pure, key server-only.** The transcription response is validated on the server and again in the browser; the transcript re-enters through the same `ParseRequestSchema` and route guards as typed text; `src/core/**` is untouched; `npm run check:build` stays clean.
5. **Additive contracts only.** `ParseRequest`, `ParseResponse` and `API_VERSION` do not change. New exports: `TranscribeResponseSchema`, `LIMITS.audioBytes`, `LIMITS.audioMs`, `AUDIO_MIME_TYPES`.
6. **Fail closed.** Transcription failure, English detected, no speech detected, undetermined language, or a transcript over limits leaves the original rejection standing, with a notice telling the customer to try again or type.

## Decisions fixed by this plan (Step 1 confirms them or amends them with written reasons)

- **Capture.** A sibling hook `src/voice/useAudioClip.ts` (not a change to `useSpeech`): `getUserMedia({ audio: true })` from the Talk gesture, `MediaRecorder` with the first supported of `audio/webm;codecs=opus`, `audio/webm`, `audio/ogg;codecs=opus`; if none is supported or permission is denied, status `unavailable` and nothing else changes. Started with the recognizer, stopped when the capture settles (`onFinal` / `onFail`), discarded on abort. The recognizer and the recorder both open the microphone. Step 1 verifies concurrent capture in Chrome; if Chrome refuses, the amendment is to open one `getUserMedia` stream and pass its track to `recognition.start(track)` (Chrome-only, not Baseline).
- **Caps.** `LIMITS.audioBytes = 1_500_000`, `LIMITS.audioMs = 30_000` (Opus at 32–48 kbps is roughly 180 KB for 30 s; Gemini's inline limit is 20 MB). Over either cap → the clip is discarded.
- **Trigger.** A pure module `src/voice/fallbackPolicy.ts`. `shouldFallback` is true only when: source is `voice`, a clip exists, the submit outcome is `rejected` with code `UNSUPPORTED` or `OFF_MENU`, no fallback has run for this capture, the app is online and not `localOnly`. Never on `applied`, `clarify`, `ignored`, or transport errors. To make the outcome observable, `controller.submit` returns `{ outcome, code }` (additive; `controller.ts:191-214`).
- **Switch rule.** `decideSwitch`: language `en` or `en-*` → no switch, no re-submit, original rejection stands. `speechDetected === false`, empty transcript, or `und` → no switch, notice "Didn't catch that. Try again, or type it." Anything else → set the session language, show the transcript with its language in the Heard display, re-submit once with `controller.submit(transcript, "voice", null)`, notice "Switched to <language> for this order".
- **Session language.** `sessionLang` state in `Kiosk.tsx` (default `en-US`), passed to `useSpeech({ lang })`. `useSpeech` resets its on-device availability cache when `lang` changes and leaves an open capture unaffected. `newOrder` resets to `en-US`. The on-device language pack is per language, so a switched session on a keyless browser stays on the cloud recognizer unless that pack is installed; documented, not solved here.
- **TTS stays English.** Review text is generated in English; speaking it with a Spanish voice would be wrong. Translating read-back is a separate follow-up.
- **Server.** New route `src/app/api/transcribe/route.ts`, `POST` with the raw audio body. `content-type` must be in `AUDIO_MIME_TYPES` after stripping parameters (400 `INVALID_REQUEST` otherwise); `content-length` and a bounded read over `LIMITS.audioBytes` → 413 `INPUT_TOO_LARGE`; empty body → 400; missing `GEMINI_API_KEY` → 503 `PROVIDER_UNAVAILABLE` (not retryable); client disconnect → 499; provider under the 14 s cap inside the 15 s lifecycle; the existing `ApiError` envelope and `HTTP_CODES`; `Server-Timing`. Response `{ transcript, language, speechDetected }` validated by `TranscribeResponseSchema` (transcript ≤ `transcriptChars`, language a BCP 47 tag ≤ 35 chars, lower-cased language subtag). One log line: `event, outcome, code, latencyMs, providerMs, tokens, audioBytes, mimeType, language` — never the transcript or audio.
- **Adapter.** `src/parser/transcribe.server.ts` (imports `server-only`) reuses the Gemini conventions: same `ENDPOINT_BASE`, same `GEMINI_MODEL` (`gemini-3.8-flash` accepts inline audio; documented input formats include `audio/webm` and `audio/ogg`), `contents` = one text part (prompt) + one `inlineData { mimeType, data }` part, `responseMimeType: application/json`, `responseJsonSchema` from Zod, temperature 0, one `fetch`, and the shared `GeminiError` / deadline / status mapping exported from `gemini.server.ts` rather than copied. Prompt: transcribe verbatim in the language spoken, return the BCP 47 code, `speechDetected: false` for silence or noise, no menu knowledge (grounding stays in the parser).
- **Client.** `src/voice/transcribe.client.ts`: one attempt, `LIMITS.clientTimeoutMs`, caller signal merged (New order and the next Talk abort it), status → code mapping as in `src/parser/client.ts:54-62`, response validated by `TranscribeResponseSchema`. Never retried.
- **UI.** While the fallback is in flight the input stays locked (`startInput` / `endInput`) and the notice reads "Checking the recording in other languages…". The engineering panel shows the last fallback `{ language, latencyMs, outcome }`.
- **Rate limiting.** None exists in the app. The endpoint is bounded by one fallback per capture and the body caps; a per-instance limiter stays a known limitation, as recorded in `docs/adr-supabase-persistence.md`.
- **Browser scope.** Chrome, which the voice path already requires. Safari's `audio/mp4` is not in the allowlist; the fallback is unavailable there and the recognizer behaves as today.

## Prerequisites

- `GEMINI_API_KEY` in `.env.local` locally (never committed). CI holds no key: unit and e2e tests run with mocked transcription.
- Chrome with a microphone for the manual check in Step 1 and the runbook check in Step 9.
- One Spanish audio fixture (≤ 5 s, webm/opus or ogg, ≤ 200 KB) under `tests/fixtures/audio/` for the opt-in live test, recorded through the check page or synthesized.

---

## Step 1. Design the fallback boundary and verify concurrent capture

**Intent.** Produce `docs/adr-audio-language-fallback.md` that fixes the decisions above before any application code: the data flow (Talk → recognizer + clip → submit → policy → `POST /api/transcribe` → Gemini transcript + language → one re-submit → session language switch); the trigger decision table over (source × outcome × code × clip present × attempted × online); the caps; the log and privacy stance; the additive contract diff (`TranscribeResponseSchema`, `LIMITS.audioBytes` / `audioMs`, `AUDIO_MIME_TYPES`, the `submit` return value); where session language lives; the security stance that a transcript from audio is untrusted text subject to the existing guards. Verify in Chrome on a static page (`public/demo/clip-check.html`, next to `public/demo/mic-check.html`) that `MediaRecorder` and `SpeechRecognition` can capture the microphone concurrently, and record the mime type and bytes per 10 s; if concurrent capture fails, amend the design to the shared-track variant with written reasons.

**Acceptance.** The ADR exists with the decision table, the contract diff, one paragraph per invariant above, and a recorded manual result (Chrome version, concurrent capture yes / no, mime type, bytes per 10 s). It lists what is not changed: engine, `ParseRequest` / `ParseResponse`, rules grammar, the English path, TTS.

**Out of scope.** Application code beyond the static check page; TTS language; streaming transcription; rate limiting.

---

## Step 2. Contracts and the server-side transcription adapter

**Intent.** Add to `src/contracts/index.ts`, additively: `LIMITS.audioBytes`, `LIMITS.audioMs`, `AUDIO_MIME_TYPES`, `TranscribeResponseSchema` (transcript ≤ `transcriptChars`, language BCP 47, `speechDetected`), with contract tests extended. Build `src/parser/transcribe.server.ts` mirroring `gemini.server.ts`: same `ENDPOINT_BASE`, `x-goog-api-key`, `GEMINI_MODEL`, `generateContent` with a prompt part and an `inlineData` part, JSON `responseJsonSchema` from Zod, temperature 0, one `fetch`, the shared `GeminiError` / deadline / status mapping exported from `gemini.server.ts` (no copy-paste). Validate the output and normalize the language tag. Test-first with an injected `fetchImpl` as in `tests/parser/gemini.test.ts`.

**Acceptance.** Unit tests cover success, invalid JSON, an over-long transcript (→ `INVALID_MODEL_OUTPUT`), 429 / 503 / timeout mapping, and that the request body carries the mime type and base64 bytes; `ParseRequest` / `ParseResponse` fixtures are unchanged; typecheck and lint clean.

**Out of scope.** The HTTP route; browser code.

---

## Step 3. The `/api/transcribe` route

**Intent.** Implement `src/app/api/transcribe/route.ts` following `interpret`'s admit / deliver structure: content-type allowlist with parameters stripped (400), content-length gate and bounded read over `LIMITS.audioBytes` (413), empty body (400), missing key (503 `PROVIDER_UNAVAILABLE`, not retryable), merged lifecycle signal (client disconnect → 499), provider call under the 14 s cap, `ApiError` envelope with existing `HTTP_CODES`, `Server-Timing`, and one `emitLog` line carrying `event, outcome, code, latencyMs, providerMs, tokens, audioBytes, mimeType, language` and never the transcript, audio, headers or key. Tests mock `@/parser/transcribe.server` the way `tests/parser/route.test.ts:8-11` mocks `gemini.server`.

**Acceptance.** Route tests cover every status above, the log-hygiene assertion (no transcript, audio or key in the logged line), and the deadline and signal wiring via the config passed to the adapter; `npm run check:build` still reports no key material in `.next/static`.

**Out of scope.** Rate limiting (recorded as a known limitation); client code.

---

## Step 4. Browser clip capture and transport

**Intent.** Build `src/voice/useAudioClip.ts` with `{ status: unavailable | idle | recording | ready, start(), stop(), discard(), take(): AudioClip | null }` where `AudioClip = { blob, mimeType, durationMs }`: audio-only `getUserMedia` from the Talk gesture, `MediaRecorder` with the first supported mime type, timesliced chunks, tracks stopped on stop and discard, caps from `LIMITS` (over-cap → discard), every failure → `unavailable` without throwing, stale recorder events ignored after discard, cleanup on unmount (the same guarantees `useSpeech` gives its recognizer). Build `src/voice/transcribe.client.ts`: `POST` the blob with its content-type, `LIMITS.clientTimeoutMs` merged with the caller's signal, one attempt, status → code mapping as in `src/parser/client.ts`, response validated by `TranscribeResponseSchema`. Test-first with fake `getUserMedia` / `MediaRecorder` following the `FakeRecognition` pattern in `tests/ui/useSpeech.test.ts` (jsdom pragma).

**Acceptance.** Hook tests cover start / stop / take, discard, permission denied, no `MediaRecorder`, unsupported mime, cap exceeded, and stale events after discard; client tests cover success, abort, timeout, and 413 / 503 mapping; `src/voice/useSpeech.ts` is not modified in this step.

**Out of scope.** The trigger policy and kiosk wiring; on-device recognition changes.

---

## Step 5. Fallback policy and session language state

**Intent.** Build the pure module `src/voice/fallbackPolicy.ts`: `shouldFallback({ source, outcome, code, hasClip, attempted, online, localOnly })` and `decideSwitch({ transcript, language, speechDetected, currentLang })` → `none | switch { lang }`, where `en` / `en-*` and undetermined never switch; table-driven tests plus a fast-check property that a capture triggers at most one fallback. Make `controller.submit` return `{ outcome, code }` (additive, `src/controller/controller.ts:191-214`, tests in `tests/core/controller.test.ts`). Make `useSpeech` safe under a `lang` change: reset the on-device availability cache and the local-preference flag when `lang` changes, and prove an open capture is unaffected. Add `sessionLang` state in `Kiosk.tsx` (default `en-US`) passed to `useSpeech`, reset in `newOrder`.

**Acceptance.** Policy tests pass; `submit` reports the outcome for applied / clarify / rejected / error; `useSpeech` tests prove the cache resets on a `lang` change and that an open capture keeps its recognizer; typecheck and lint clean.

**Out of scope.** The transcription network call; UI copy; the engineering panel.

---

## Step 6. Kiosk wiring and UI

**Intent.** In `src/ui/Kiosk.tsx`: `talk()` starts the clip with the recognizer; `onFinal` / `onFail` stop it; after `controller.submit` resolves, evaluate `shouldFallback`; when true keep the input locked, show "Checking the recording in other languages…", call the transcribe client with a signal tied to New order and the next Talk, then apply `decideSwitch`: on switch set `sessionLang`, show the transcript and its language in Heard, re-submit once with `controller.submit(transcript, "voice", null)` and notice "Switched to <language> for this order"; on none keep the original rejection and notice "Didn't catch that. Try again, or type it." Discard the clip on every exit path (apply, fallback attempted, next Talk, New order, cancel). Show the last fallback `{ language, latencyMs, outcome }` in the engineering panel. Extend `tests/ui/kiosk.realController.test.tsx`: the mocked client rejects the English transcript with `UNSUPPORTED` and returns a cart for the Spanish one; the mocked transcribe client returns an `es` transcript; assert exactly one re-submit, the cart lines, recognizer `lang` `es` on the next Talk, and `en-US` after New order; an English detection produces no re-submit; a transcription failure leaves the original rejection.

**Acceptance.** The scenarios above pass; rapid Talk presses never double-submit; Talk and typing are blocked while the fallback is in flight; every existing UI test passes.

**Out of scope.** TTS voice or language; menu-button flows; on-device pack installation for the switched language.

---

## Step 7. End-to-end and evaluation coverage

**Intent.** Add `tests/e2e/audio-fallback.spec.ts`: inject the fake recognizer (`tests/e2e/kiosk.spec.ts:13-27` pattern) plus fake `getUserMedia` / `MediaRecorder` via `addInitScript`, serve `/api/interpret` from the real server, answer `/api/transcribe` through `page.route` with an `es` transcript; assert the cart, the "Switched to Spanish" notice, and the recognizer `lang` on the next capture; a second test answers 503 and asserts the original rejection. Add the opt-in live test `tests/parser/transcribe.live.test.ts` with the Spanish fixture, skipped without `GEMINI_API_KEY`. Extend the evals: heldout rows with `source: "voice"` for Spanish, Chinese and Hindi transcripts of the three demo items (`asrConfidence: null`, per `docs/evaluation.md:94`), expecting rules → `reject UNSUPPORTED` and gemini → the cart as in `ho-022`–`ho-024`; one adversarial row whose transcript is an injection phrase as if spoken into the microphone.

**Acceptance.** Keyless e2e passes in CI with mocked transcription; the live test passes locally with the key; an eval run under `evals/runs/` shows 0 adversarial leaks.

**Out of scope.** Audio fixtures beyond the one Spanish clip; Safari.

---

## Step 8. Security review and chaos drill of the audio boundary

**Intent.** Review the route, adapter, client and hook for: content-type and size enforcement, no audio or transcript in logs, the key server-only, the transcript treated as untrusted text through `publicParseRequestSchema` and the route guards, injection spoken into the microphone ending as plain text, silence and noise (`speechDetected: false` → no switch), 30 s of speech (cap → discard), oversized and wrong-type bodies (413 / 400), provider outage and timeout (original rejection stands, UI recovers, no retry storm), New order in the middle of a fallback (aborted, no late submit), rapid Talk presses. Record rate limiting as a known limitation with its mitigations.

**Acceptance.** No CRITICAL or HIGH finding stays open; each chaos case has an automated test or a recorded manual result; `npm run check:build` clean.

**Out of scope.** Adding a rate limiter; authentication.

---

## Step 9. Documentation, runbook and evidence

**Intent.** Update `README.md` (feature and Chrome requirement), `docs/engineering.md` (voice section: clip capture, policy, session language, what stays mocked), `docs/evaluation.md` (new section on the audio fallback cases and results; update the gap row at line 94), `docs/runbook.md` (manual microphone check steps, the exact notices, and that a missing key disables the fallback), `docs/integration.md` (direct audio is now used on the fallback only), `.env.example` only if a new variable was introduced, and the review section of `tasks/todo.md` with evidence (tsc, lint, unit count, build, keyless e2e, live test, eval run).

**Acceptance.** Docs describe the shipped behaviour with the exact notices; the `tasks/todo.md` review lists the evidence; no document claims a human microphone test that was not performed.

**Out of scope.** Demo video; marketing copy.
