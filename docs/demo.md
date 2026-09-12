# TartanOrder — judging demo (2:40)

Slot: 3 minutes total including setup. Shorten by dropping step 7 (18,000 lemonades) and the spoken read-back if the verified slot is shorter. Never drop correction → clarification → confirmation.

## Before the slot
- Laptop on wall power, Chrome, deployed URL open in one tab, local production build (`npm run build && npm start`) in a second tab, `public/demo/recording/` open in a third.
- Mic check (`/demo/mic-check.html`) passed within the last hour on **this** laptop. `speechSynthesis` voice tested once (press Review on a throwaway order).
- Engineering panel closed. Local only is ON by default (A's controller); leave it on until C's HTTP client and a verified key are integrated.
- Say the mode aloud at the start: "Live cloud parser" / "Live local rules" / "Recorded".

## Script

| t | Who | Says / does | What the audience sees |
|---|---|---|---|
| 0:00 | Lead | "Ordering at a busy campus counter fails at the correction, not the first sentence. TartanOrder takes the order, takes the correction, and refuses to guess. Seeded menu, no purchase is sent." | Kiosk, empty cart, badges show parser + input mode |
| 0:15 | B | Press Talk. "A burger, fries and lemonade." Stop. | Transcript shows heard text; three lines flash in; total $13.50 |
| 0:30 | B | Talk. "Make the burger a double." | Burger line flashes, shows Double; total $16.00 |
| 0:40 | B | Talk. "Add a burger." (starter grammar has no "another" until C lands) | Fourth line; labels become Burger (line 1) / Burger (line 2) |
| 0:50 | B | Talk. "Remove the burger." | Clarify panel: "Which burger line did you mean?" with two choices (Burger 1 / Burger 2). Cart unchanged. |
| 1:00 | Lead | Turn to audience: "First or second?" Tap the answer. (If nobody answers in 3 s, A picks.) | Only that line disappears |
| 1:10 | B | Press Undo. | Line returns; total restored |
| 1:15 | B | Type "18,000 lemonades", Submit. Say "same parser, typed input." | Notice: rejected; cart unchanged. (Starter grammar rejects it as unsupported; C's grammar reports the quantity limit.) |
| 1:25 | Lead | "It never clamps, never guesses, never partially applies." | — |
| 1:30 | B | Press Review order. | Full review, every line and modifier, total; read-back plays |
| 1:45 | B | Press Confirm simulated order. | Ticket with id and "Simulated · no real purchase" |
| 1:55 | Lead | Open engineering panel. | Audit: input started → parse → applied / clarify / rejected; parser mode; ASR confidence marked diagnostic |
| 2:10 | Lead | "The model can only propose typed menu edits. Our engine validates the whole batch or nothing, resolves one ambiguity per utterance with an explicit line reference, and binds confirmation to the reviewed revision so a stale confirm can't fire. Voice is push-to-talk, one final result per utterance, TTS is cancelled before the mic opens." | — |
| 2:25 | C | Measured results on the release SHA only (see Metrics). "Next real step: vendor/POS integration and user testing." | — |
| 2:40 | Lead | "Questions?" Press New order. | Empty cart in under a second |

## Fallback ladder (announce the switch; never present a fallback as live)
1. Gemini fails or is slow → flip Local only in the engineering panel. Say "switching to the local rules parser". The parser badge changes visibly.
2. Mic denied or misheard → type the same line. Say "typing this one". The UI shows "Microphone access was blocked. Type your order instead." on its own.
3. Internet fails → switch to the local production build tab, Local only on. Verified: full typed flow completes with **zero** `/api/` requests (harness prod build, 2026-09-11).
4. App fails → play the recording from `test-results/demo-recording/` (generate it before the demo; see `public/demo/README.md`). Every frame carries a black "RECORDED DEMO — not live" banner. Say it is a recording.

## Metrics to state (fill the blanks at H12 from real trials on the release SHA)

Measured by B on branch `work/b-kiosk` against **A's real controller, engine and bootstrap rules parser** (2026-09-11 ~23:40, Node 22.23.2, macOS 26.6.2):
- Vitest: 120/120 in the repo — A's 92 + B's 28 (fake controller; browser voice **mocked** — not a microphone test).
- Playwright (A's config, fresh production server): **14 passed, 1 skipped**. The skipped flow (provider 503 → labelled rules fallback) checks at runtime whether `/api/interpret` was called and skips because the bootstrap client parses locally; it runs for real once C's HTTP client lands.
- Zero `/api/` requests during the typed → receipt journey with Local only on (asserted in `tests/e2e/starter.spec.ts`).
- Real recognizer, denied microphone (Claude desktop's embedded Chromium blocks the mic): genuine `not-allowed` handled — notice shown, busy cleared, Talk re-enabled.
- Reset to empty cart: < 1 s in e2e.

Still to measure (needs a human on the demo laptop — see the protocol below):
- Mic trials: __/10 phrases captured correctly in quiet, __/5 in room noise, median __ ms to final. Paste the raw `mic-check.html` log into `docs/evaluation.md` for C. **Do not correct transcripts.**
- Duplicate final results observed: __ (guarded by once-per-utterance in `useSpeech`).
- Ten full kiosk flows completed on the integrated build: __/10 without a stuck state.
- Five nearby users: time to complete, number of corrections, one-line comment each. Convenience sample; say so.

## Real microphone test protocol (H0.5 verdict; a human must do this)

Automated tests mock the recognizer. This is the only way to learn how the demo laptop actually hears.

1. In a terminal: `npm run dev` in the repo (branch `work/b-kiosk`), then open **http://localhost:3000 in Google Chrome** (not Safari, not an embedded browser, not Brave/Vivaldi/plain Chromium — those lack Google's speech keys). Chrome's cloud recognizer talks to Google's speech service; Chrome 139+ can instead recognise **on-device** after a one-time language-pack download, which the kiosk offers automatically when the cloud path fails ("Speech service unreachable…") and from the engineering panel.
2. Click **Talk**. Chrome asks for microphone permission once — click **Allow**. The badge shows `listening`; the strip shows "Listening… say your order".
3. Say, at normal speed: **"a burger, fries and lemonade"**. Stop speaking; click **Stop — I'm done** (or wait — Chrome finalizes on silence).
   Expected: strip shows `Heard: "a burger fries and lemonade"` (punctuation may differ), three lines, **$13.50**, badge `input: voice`, `parser: rules`.
4. Talk → **"make the burger a double"** → Burger shows *Double*, total **$16.00**.
5. Talk → **"remove the burger"** → applied (single burger) or, after adding a second burger via the **+ Burger** button, the "Which burger line did you mean?" choice — cart unchanged until you pick.
6. Click **Review order**: the read-back plays through the speakers (menu-generated text of the snapshot). While it is speaking, click **Talk** — read-back must stop before the mic opens (nothing of it may appear as `Heard:`).
7. Click **Talk**, say nothing for ~5 s → "Didn't catch anything" and Talk is available again (empty capture releases the lock).
8. Click **Talk**, then **Cancel** → "Voice capture cancelled." and the cart is unchanged.
9. Open the engineering panel and read the **ASR confidence** row after a voice utterance (diagnostic only).
10. Then run `public/demo/mic-check.html` for the 10-phrase / 5-in-noise log and paste it raw (uncorrected) into the handoff for C.

Record: Chrome version (chrome://version), macOS version, how many of the phrases were heard verbatim, any duplicate `Heard:` for a single utterance, and time from Stop to cart update.
