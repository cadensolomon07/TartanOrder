# Plan-Orchestrate Result

**Plan**: `docs/plan/audio-language-fallback.md`
**Lang**: `typescript`
**ECC mode**: `legacy`
**Steps**: 9
**Scope**: all

## Steps overview

| # | Title | Tags | Chain |
|---|---|---|---|
| 1 | Design the fallback boundary and verify concurrent capture | design, security | `planner,architect,security-reviewer` |
| 2 | Contracts and the server-side transcription adapter | impl, security | `tdd-guide,typescript-reviewer,security-reviewer` |
| 3 | The /api/transcribe route | impl, security | `tdd-guide,typescript-reviewer,security-reviewer` |
| 4 | Browser clip capture and transport | impl | `tdd-guide,typescript-reviewer` |
| 5 | Fallback policy and session language state | impl | `tdd-guide,typescript-reviewer` |
| 6 | Kiosk wiring and UI | impl | `tdd-guide,typescript-reviewer` |
| 7 | End-to-end and evaluation coverage | test | `tdd-guide,e2e-runner` |
| 8 | Security review and chaos drill of the audio boundary | security, review | `security-reviewer,typescript-reviewer,code-reviewer` |
| 9 | Documentation, runbook and evidence | docs | `doc-updater` |

---

## Step 1 — Design the fallback boundary and verify concurrent capture

**Intent**: Write the ADR that fixes the data flow, trigger decision table, caps, privacy and log stance, and additive contract diff, and verify in Chrome that MediaRecorder and SpeechRecognition can capture the microphone at the same time.
**Tags**: design, security
**Chain rationale**: A design step, so `planner` restates and de-risks, `architect` fixes the boundary and contract diff; audio leaving the browser and the injection stance make `security-reviewer` the closing check.

```bash
/orchestrate custom "planner,architect,security-reviewer" "[Plan: docs/plan/audio-language-fallback.md#step-1] Write docs/adr-audio-language-fallback.md: flow Talk -> recognizer + MediaRecorder clip -> submit -> policy -> POST /api/transcribe -> Gemini transcript+language -> one re-submit -> session lang switch; trigger table over source x outcome x code x clip x attempted; caps 1.5 MB / 30 s; log/privacy stance. Verify in Chrome on public/demo/clip-check.html that MediaRecorder and SpeechRecognition share the mic; Acceptance: ADR has decision table, additive contract diff, a paragraph per invariant, recorded manual result (Chrome version, concurrent yes/no, mime, bytes per 10 s); Out of scope: app code beyond the check page; TTS language; streaming transcription; rate limiting"
```

---

## Step 2 — Contracts and the server-side transcription adapter

**Intent**: Add the additive contract exports and build the server-only Gemini transcription adapter that mirrors the existing parser adapter's conventions.
**Tags**: impl, security
**Chain rationale**: Implementation with tests first (`tdd-guide`), `typescript-reviewer` for types and async correctness, and `security-reviewer` closes because the step handles the provider key and the audio payload.

```bash
/orchestrate custom "tdd-guide,typescript-reviewer,security-reviewer" "[Plan: docs/plan/audio-language-fallback.md#step-2] Add additively to src/contracts/index.ts: LIMITS.audioBytes, LIMITS.audioMs, AUDIO_MIME_TYPES (audio/webm, audio/ogg), TranscribeResponseSchema {transcript, language BCP 47, speechDetected}; API_VERSION unchanged. Build src/parser/transcribe.server.ts mirroring gemini.server.ts: same endpoint, key header and GEMINI_MODEL, generateContent with prompt part + inlineData, JSON responseJsonSchema from Zod, temperature 0, one fetch, shared GeminiError/deadline/status mapping exported not copied; test-first with injected fetchImpl; Acceptance: tests cover success, bad JSON, over-long transcript -> INVALID_MODEL_OUTPUT, 429/503/timeout mapping, request carries mime + base64; ParseRequest/ParseResponse fixtures unchanged; Out of scope: the HTTP route; browser code"
```

---

## Step 3 — The /api/transcribe route

**Intent**: Implement the transcription route with the same admission, deadline, envelope and log-hygiene discipline as the interpret route.
**Tags**: impl, security
**Chain rationale**: Same shape as Step 2: tests first, TypeScript review, and `security-reviewer` last because the route accepts raw audio bodies and must never log them.

```bash
/orchestrate custom "tdd-guide,typescript-reviewer,security-reviewer" "[Plan: docs/plan/audio-language-fallback.md#step-3] Implement src/app/api/transcribe/route.ts following interpret's admit/deliver structure: content-type allowlist with parameters stripped (400), content-length gate and bounded read over LIMITS.audioBytes (413), empty body (400), missing GEMINI_API_KEY (503 not retryable), client disconnect (499), provider under the 14 s cap in the 15 s lifecycle, ApiError envelope with existing HTTP_CODES, Server-Timing, one emitLog line with the interpret fields plus audioBytes/mimeType/language and never transcript, audio, headers or key; tests mock @/parser/transcribe.server as route.test.ts mocks gemini.server; Acceptance: route tests cover every status, the log-hygiene assertion, deadline and signal wiring; npm run check:build clean; Out of scope: rate limiting (known limitation); client code"
```

---

## Step 4 — Browser clip capture and transport

**Intent**: Build the audio-clip hook and the browser transport for the transcription route, with the same lifecycle guarantees the speech hook gives its recognizer.
**Tags**: impl
**Chain rationale**: Browser-side implementation; `tdd-guide` drives the fake MediaRecorder tests, `typescript-reviewer` closes on hook correctness and abort handling. Unit tests live inside the impl chain, so no separate test agent.

```bash
/orchestrate custom "tdd-guide,typescript-reviewer" "[Plan: docs/plan/audio-language-fallback.md#step-4] Build src/voice/useAudioClip.ts (start/stop/discard/take; status unavailable|idle|recording|ready; clip = {blob, mimeType, durationMs}): audio-only getUserMedia from the Talk gesture, MediaRecorder with the first supported webm/ogg opus type, LIMITS caps (over-cap -> discard), failures -> unavailable, stale events ignored, unmount cleanup. Build src/voice/transcribe.client.ts: POST the blob, clientTimeoutMs merged with the caller signal, one attempt, status->code mapping as parser/client.ts, response validated by TranscribeResponseSchema. Test-first with fake getUserMedia/MediaRecorder (FakeRecognition pattern); Acceptance: hook tests cover start/stop/take, discard, denied permission, no MediaRecorder, unsupported mime, cap exceeded, stale events; client tests cover success, abort, timeout, 413/503; useSpeech.ts untouched; Out of scope: policy and kiosk wiring; on-device changes"
```

---

## Step 5 — Fallback policy and session language state

**Intent**: Build the pure trigger and switch policy, expose the submit outcome from the controller, make the speech hook safe under a language change, and add the session language state.
**Tags**: impl
**Chain rationale**: Pure logic plus small controller and hook changes; `tdd-guide` for table and property tests, `typescript-reviewer` closes.

```bash
/orchestrate custom "tdd-guide,typescript-reviewer" "[Plan: docs/plan/audio-language-fallback.md#step-5] Build pure src/voice/fallbackPolicy.ts: shouldFallback true only for a voice submit rejected UNSUPPORTED/OFF_MENU with a clip, not yet attempted, online, not localOnly; decideSwitch -> none | switch {lang}, never for en/en-* or undetermined; table tests plus a fast-check property of at most one fallback per capture. Make controller.submit return {outcome, code} (additive). Make useSpeech reset its on-device cache and local preference when lang changes without touching an open capture. Add sessionLang state in Kiosk.tsx (default en-US) passed to useSpeech, reset in newOrder; Acceptance: policy tests pass; submit reports applied/clarify/rejected/error; useSpeech tests prove the cache reset and an open capture unaffected; Out of scope: the transcription call; UI copy; engineering panel"
```

---

## Step 6 — Kiosk wiring and UI

**Intent**: Wire the clip, policy, transcription client, re-submit and language switch into the kiosk with the agreed notices, and prove the flow against the real controller.
**Tags**: impl
**Chain rationale**: UI integration with the real controller test as the gate; `tdd-guide` writes the scenario first, `typescript-reviewer` closes on effect and abort correctness.

```bash
/orchestrate custom "tdd-guide,typescript-reviewer" "[Plan: docs/plan/audio-language-fallback.md#step-6] Wire src/ui/Kiosk.tsx: talk() starts the clip with the recognizer, onFinal/onFail stop it; after controller.submit resolves run shouldFallback; when true keep input locked, show the checking notice, call the transcribe client with a signal tied to New order and the next Talk, apply decideSwitch: switch -> set sessionLang, show transcript + language in Heard, re-submit once as voice, notice Switched to <language> for this order; none -> keep the original rejection; discard the clip on every exit path; engineering panel shows the last fallback. Extend tests/ui/kiosk.realController.test.tsx with the English-reject-then-Spanish-cart scenario; Acceptance: exactly one re-submit, cart lines, recognizer lang es on the next Talk and en-US after New order; English detection -> no re-submit; transcription failure -> original rejection; Out of scope: TTS; menu-button flows; on-device pack for the switched language"
```

---

## Step 7 — End-to-end and evaluation coverage

**Intent**: Prove the flow in a real browser with mocked transcription, add the opt-in live test on a Spanish clip, and extend the eval sets with voice-sourced non-English rows.
**Tags**: test
**Chain rationale**: A testing step; `tdd-guide` for the live test and eval rows, `e2e-runner` owns the Playwright spec and closes the chain.

```bash
/orchestrate custom "tdd-guide,e2e-runner" "[Plan: docs/plan/audio-language-fallback.md#step-7] Add tests/e2e/audio-fallback.spec.ts: fake recognizer (kiosk.spec.ts pattern) plus fake getUserMedia/MediaRecorder via addInitScript, real /api/interpret, /api/transcribe answered by page.route with an es transcript; assert cart, the Switched to Spanish notice, recognizer lang on the next capture; a second test answers 503 and expects the original rejection. Add opt-in tests/parser/transcribe.live.test.ts on the Spanish fixture, skipped without GEMINI_API_KEY. Extend evals with voice-source heldout rows for Spanish, Chinese and Hindi orders of the three demo items (rules reject UNSUPPORTED, gemini cart, as ho-022..024) and one adversarial injection transcript; Acceptance: keyless e2e passes in CI; live test passes locally with the key; eval run under evals/runs/ shows 0 adversarial leaks; Out of scope: fixtures beyond the one Spanish clip; Safari"
```

---

## Step 8 — Security review and chaos drill of the audio boundary

**Intent**: Audit the new audio boundary end to end and drive every failure mode with a test or a recorded manual result.
**Tags**: security, review
**Chain rationale**: Security is primary, so `security-reviewer` leads; `typescript-reviewer` and `code-reviewer` follow for the review tag and close on quality.

```bash
/orchestrate custom "security-reviewer,typescript-reviewer,code-reviewer" "[Plan: docs/plan/audio-language-fallback.md#step-8] Review the transcribe route, adapter, client and useAudioClip for: content-type and size enforcement, no audio or transcript in logs, key server-only, the transcript treated as untrusted text through publicParseRequestSchema and route guards, injection spoken into the mic ending as plain text, silence/noise (speechDetected false -> no switch), 30 s of speech (cap -> discard), oversized and wrong-type bodies (413/400), provider outage and timeout (original rejection stands, no retry storm), New order mid-fallback (aborted, no late submit), rapid Talk presses; record rate limiting as a known limitation with mitigations; Acceptance: no CRITICAL or HIGH finding open; each chaos case has an automated test or a recorded manual result; npm run check:build clean; Out of scope: adding a rate limiter; authentication"
```

---

## Step 9 — Documentation, runbook and evidence

**Intent**: Document the shipped behaviour, the manual microphone check, and the evidence.
**Tags**: docs
**Chain rationale**: Documentation only; `doc-updater` alone.

```bash
/orchestrate custom "doc-updater" "[Plan: docs/plan/audio-language-fallback.md#step-9] Update README.md (feature, Chrome requirement), docs/engineering.md (voice section: clip capture, policy, session language, what stays mocked), docs/evaluation.md (new audio-fallback section; update the voice-cases gap row near line 94), docs/runbook.md (manual microphone check steps, exact notices, missing key disables the fallback), docs/integration.md (direct audio used on the fallback only), .env.example only if a variable was added, and the tasks/todo.md review section with evidence (tsc, lint, unit count, build, keyless e2e, live test, eval run); Acceptance: docs match the shipped behaviour and notices; todo.md review lists the evidence; no document claims a human microphone test that was not performed; Out of scope: demo video; marketing copy"
```

---

## Batch execution

```bash
/orchestrate custom "planner,architect,security-reviewer" "[Plan: docs/plan/audio-language-fallback.md#step-1] Write docs/adr-audio-language-fallback.md: flow Talk -> recognizer + MediaRecorder clip -> submit -> policy -> POST /api/transcribe -> Gemini transcript+language -> one re-submit -> session lang switch; trigger table over source x outcome x code x clip x attempted; caps 1.5 MB / 30 s; log/privacy stance. Verify in Chrome on public/demo/clip-check.html that MediaRecorder and SpeechRecognition share the mic; Acceptance: ADR has decision table, additive contract diff, a paragraph per invariant, recorded manual result (Chrome version, concurrent yes/no, mime, bytes per 10 s); Out of scope: app code beyond the check page; TTS language; streaming transcription; rate limiting"
/orchestrate custom "tdd-guide,typescript-reviewer,security-reviewer" "[Plan: docs/plan/audio-language-fallback.md#step-2] Add additively to src/contracts/index.ts: LIMITS.audioBytes, LIMITS.audioMs, AUDIO_MIME_TYPES (audio/webm, audio/ogg), TranscribeResponseSchema {transcript, language BCP 47, speechDetected}; API_VERSION unchanged. Build src/parser/transcribe.server.ts mirroring gemini.server.ts: same endpoint, key header and GEMINI_MODEL, generateContent with prompt part + inlineData, JSON responseJsonSchema from Zod, temperature 0, one fetch, shared GeminiError/deadline/status mapping exported not copied; test-first with injected fetchImpl; Acceptance: tests cover success, bad JSON, over-long transcript -> INVALID_MODEL_OUTPUT, 429/503/timeout mapping, request carries mime + base64; ParseRequest/ParseResponse fixtures unchanged; Out of scope: the HTTP route; browser code"
/orchestrate custom "tdd-guide,typescript-reviewer,security-reviewer" "[Plan: docs/plan/audio-language-fallback.md#step-3] Implement src/app/api/transcribe/route.ts following interpret's admit/deliver structure: content-type allowlist with parameters stripped (400), content-length gate and bounded read over LIMITS.audioBytes (413), empty body (400), missing GEMINI_API_KEY (503 not retryable), client disconnect (499), provider under the 14 s cap in the 15 s lifecycle, ApiError envelope with existing HTTP_CODES, Server-Timing, one emitLog line with the interpret fields plus audioBytes/mimeType/language and never transcript, audio, headers or key; tests mock @/parser/transcribe.server as route.test.ts mocks gemini.server; Acceptance: route tests cover every status, the log-hygiene assertion, deadline and signal wiring; npm run check:build clean; Out of scope: rate limiting (known limitation); client code"
/orchestrate custom "tdd-guide,typescript-reviewer" "[Plan: docs/plan/audio-language-fallback.md#step-4] Build src/voice/useAudioClip.ts (start/stop/discard/take; status unavailable|idle|recording|ready; clip = {blob, mimeType, durationMs}): audio-only getUserMedia from the Talk gesture, MediaRecorder with the first supported webm/ogg opus type, LIMITS caps (over-cap -> discard), failures -> unavailable, stale events ignored, unmount cleanup. Build src/voice/transcribe.client.ts: POST the blob, clientTimeoutMs merged with the caller signal, one attempt, status->code mapping as parser/client.ts, response validated by TranscribeResponseSchema. Test-first with fake getUserMedia/MediaRecorder (FakeRecognition pattern); Acceptance: hook tests cover start/stop/take, discard, denied permission, no MediaRecorder, unsupported mime, cap exceeded, stale events; client tests cover success, abort, timeout, 413/503; useSpeech.ts untouched; Out of scope: policy and kiosk wiring; on-device changes"
/orchestrate custom "tdd-guide,typescript-reviewer" "[Plan: docs/plan/audio-language-fallback.md#step-5] Build pure src/voice/fallbackPolicy.ts: shouldFallback true only for a voice submit rejected UNSUPPORTED/OFF_MENU with a clip, not yet attempted, online, not localOnly; decideSwitch -> none | switch {lang}, never for en/en-* or undetermined; table tests plus a fast-check property of at most one fallback per capture. Make controller.submit return {outcome, code} (additive). Make useSpeech reset its on-device cache and local preference when lang changes without touching an open capture. Add sessionLang state in Kiosk.tsx (default en-US) passed to useSpeech, reset in newOrder; Acceptance: policy tests pass; submit reports applied/clarify/rejected/error; useSpeech tests prove the cache reset and an open capture unaffected; Out of scope: the transcription call; UI copy; engineering panel"
/orchestrate custom "tdd-guide,typescript-reviewer" "[Plan: docs/plan/audio-language-fallback.md#step-6] Wire src/ui/Kiosk.tsx: talk() starts the clip with the recognizer, onFinal/onFail stop it; after controller.submit resolves run shouldFallback; when true keep input locked, show the checking notice, call the transcribe client with a signal tied to New order and the next Talk, apply decideSwitch: switch -> set sessionLang, show transcript + language in Heard, re-submit once as voice, notice Switched to <language> for this order; none -> keep the original rejection; discard the clip on every exit path; engineering panel shows the last fallback. Extend tests/ui/kiosk.realController.test.tsx with the English-reject-then-Spanish-cart scenario; Acceptance: exactly one re-submit, cart lines, recognizer lang es on the next Talk and en-US after New order; English detection -> no re-submit; transcription failure -> original rejection; Out of scope: TTS; menu-button flows; on-device pack for the switched language"
/orchestrate custom "tdd-guide,e2e-runner" "[Plan: docs/plan/audio-language-fallback.md#step-7] Add tests/e2e/audio-fallback.spec.ts: fake recognizer (kiosk.spec.ts pattern) plus fake getUserMedia/MediaRecorder via addInitScript, real /api/interpret, /api/transcribe answered by page.route with an es transcript; assert cart, the Switched to Spanish notice, recognizer lang on the next capture; a second test answers 503 and expects the original rejection. Add opt-in tests/parser/transcribe.live.test.ts on the Spanish fixture, skipped without GEMINI_API_KEY. Extend evals with voice-source heldout rows for Spanish, Chinese and Hindi orders of the three demo items (rules reject UNSUPPORTED, gemini cart, as ho-022..024) and one adversarial injection transcript; Acceptance: keyless e2e passes in CI; live test passes locally with the key; eval run under evals/runs/ shows 0 adversarial leaks; Out of scope: fixtures beyond the one Spanish clip; Safari"
/orchestrate custom "security-reviewer,typescript-reviewer,code-reviewer" "[Plan: docs/plan/audio-language-fallback.md#step-8] Review the transcribe route, adapter, client and useAudioClip for: content-type and size enforcement, no audio or transcript in logs, key server-only, the transcript treated as untrusted text through publicParseRequestSchema and route guards, injection spoken into the mic ending as plain text, silence/noise (speechDetected false -> no switch), 30 s of speech (cap -> discard), oversized and wrong-type bodies (413/400), provider outage and timeout (original rejection stands, no retry storm), New order mid-fallback (aborted, no late submit), rapid Talk presses; record rate limiting as a known limitation with mitigations; Acceptance: no CRITICAL or HIGH finding open; each chaos case has an automated test or a recorded manual result; npm run check:build clean; Out of scope: adding a rate limiter; authentication"
/orchestrate custom "doc-updater" "[Plan: docs/plan/audio-language-fallback.md#step-9] Update README.md (feature, Chrome requirement), docs/engineering.md (voice section: clip capture, policy, session language, what stays mocked), docs/evaluation.md (new audio-fallback section; update the voice-cases gap row near line 94), docs/runbook.md (manual microphone check steps, exact notices, missing key disables the fallback), docs/integration.md (direct audio used on the fallback only), .env.example only if a variable was added, and the tasks/todo.md review section with evidence (tsc, lint, unit count, build, keyless e2e, live test, eval run); Acceptance: docs match the shipped behaviour and notices; todo.md review lists the evidence; no document claims a human microphone test that was not performed; Out of scope: demo video; marketing copy"
```
