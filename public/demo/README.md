# public/demo

- `mic-check.html` — standalone page for the hour-0.5 microphone verdict. Open it in Chrome on the **demo laptop** (`file://` works, or `/demo/mic-check.html` once the app runs). Say the ten phrases, then five more while people talk nearby. Copy the log verbatim into the H0.5 report and to C.
- Recording (not committed, ~2 MB; written to `test-results/demo-recording/**/video.webm`, outside `public/`). Generate the ~90 s labeled recording of the typed demo flow with:

      npm run build && npm start   # in one terminal (port 3000)
      PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test --config tests/e2e/record.config.ts

  The spec injects a black "RECORDED DEMO — not live" banner for the whole clip and writes the screenshot set below.
- `shots/` — 12 screenshots taken against A's real controller and local rules parser (branch work/b-kiosk, 2026-09-11 23:15): every screen state at 1280 px, plus empty / cart / review at 390 px. Typed input only.
