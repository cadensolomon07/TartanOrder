# Demo support files

`mic-check.html` is an optional raw browser speech diagnostic. Open `/demo/mic-check.html` in Chrome on the demo laptop. Its recognizer is separate from the kiosk and it never calls Gemini or changes an order. Multiple final chunks in one capture are normal. Preserve the raw log; do not correct transcripts. The integrated microphone acceptance trial is in [docs/demo.md](../../docs/demo.md).

Generate a clearly labelled recording of the **typed local-rules** flow against a production build:

```sh
npm run build
npm start
```

In a second terminal:

```sh
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test --config tests/e2e/record.config.ts
```

The recording spec explicitly selects Local only after each page load and keeps a “RECORDED DEMO — not live · typed input · local rules parser” banner visible. The video is written under `test-results/demo-recording/`; screenshots go to `public/demo/shots/`. This does not test a real microphone or Gemini. Existing screenshot assets are historical and may not match the current release; regenerate before presenting.

## Real typed Gemini backup (explicit opt-in)

After real-provider acceptance passes on the target release, run:

```sh
GEMINI_LIVE=1 RECORDING_PARSER=gemini PLAYWRIGHT_BASE_URL=https://tartan-order.vercel.app npx playwright test --config tests/e2e/record.config.ts
```

Use the already configured local production URL as `PLAYWRIGHT_BASE_URL` to record locally. This makes five real interpretation requests; it does not mock HTTP or recognition, does not open the microphone, and never accepts a rules fallback as Gemini evidence. No key belongs in this command: the target server reads its own protected environment.

The recording shows the exact long request, a correction across turns, Undo, a fresh mixed pizza order, targeted clarification with a typed answer, and explicit review/confirmation. It aims for 2:25 and fails if it exceeds three minutes. The video is silent; visible replies and the mode badge stay on screen. Only a successful run writes these named artifacts:

- `test-results/demo-recording/tartanorder-gemini.webm`
- `test-results/demo-recording/tartanorder-gemini-evidence.json`

Both are ignored by Git. The JSON contains the demonstration transcripts, HTTP status and actual validated response envelopes. Failed recordings remain in Playwright's per-test output and must not be presented as successful demonstrations. Preparing this workflow does not mean a recording exists or has been played back; inspect the resulting video before using it.

For keyboard recovery, focus the text field, type, and press Enter to submit; Escape discards an unsent draft. Tab to Review and press Enter, then Tab to Confirm and press Enter only after checking the snapshot. To abandon parsing, use its Cancel button. If the provider is unavailable, open the engineering panel and check Local only, then use the simple rules script above. Announce that mode change.
