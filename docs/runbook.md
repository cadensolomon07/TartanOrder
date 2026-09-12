# Demo and release runbook

## Timing (America/New_York)

Friday, September 11, 2026 at 9 p.m. to Saturday, September 12 at 4 p.m. EDT is **19 hours**. Freeze features Saturday at 11 a.m.; target submission at 3:15 p.m. Protect 11 a.m.–3:15 p.m. for stabilization and presentation. No twentieth coding hour.

| Milestone | Time | Outcome |
| --- | --- | --- |
| H0.5 | Friday 9:30 p.m. | Bootstrap/contracts |
| H1.5 | Friday 10:30 p.m. | Controller/minimal engine; first B/C integration |
| H3 | Saturday midnight | Deployed real rules typed-to-receipt journey |
| H5.5 | Saturday 2:30 a.m. | Full transaction semantics |
| H8 | Saturday 5 a.m. | Property/replay/offline evidence; contract freeze |
| H11 | Saturday 8 a.m. | Integration checkpoint |
| H14 | Saturday 11 a.m. | Release candidate and feature freeze |

A's session actually began about Friday 9:50 p.m.; early milestones are compressed. Bootstrap `1676b3d` was published around 10 p.m. to the existing repository and all three work branches.

[Official Devpost](https://hack-cmu-2026.devpost.com/) confirms the September 12, 4 p.m. EDT cutoff, project description, track selection and 50-word track-fit explanation. Judging covers usefulness, technical complexity, originality and demo quality. Gemini has a sponsor prize, contingent on actually using it. The [organizer site](https://www.acmatcmu.com/hackcmu2026/) still contains placeholder tracks and signup forms. **The actual submission form and final track names remain unverified. Get these from the on-site organizer before submission.**

## Local production fallback

```sh
nvm use
npm ci
test -f .env.local || cp .env.example .env.local
npm run build
npm run start
```

Open http://localhost:3000. Select Local only. Once the production page is loaded, disable Wi-Fi and run the typed demo; restore Wi-Fi afterward. All assets are bundled, with no remote fonts/images. Stop the production server before rebuilding to avoid stale assets.

Playwright starts a fresh production server on port 3100, separate from the visible demo on port 3000. Build first. Set `PLAYWRIGHT_BASE_URL` to test a deployment.

## Demonstration

1. Type `a burger, fries and lemonade`: three separate lines, $13.50.
2. Type `make the burger a double`: $16.00. Type `undo`: $13.50.
3. Add another burger; type `remove burger`: show both choices. Choose the second; only that line disappears.
4. Review every item, quantity, modifier and total. Begin editing input; confirmation disappears immediately.
5. Cancel input, review again, explicitly confirm. Show the simulated receipt. Start a new order before editing.
6. Show actual parser mode in the engineering panel and export the audit. Replay reconstructs state without a live action.

Starter mode: **typed input + small real local rules grammar**. Unsupported language is rejected; fixtures are explicitly marked. B owns voice and the finished kiosk. C owns provider verification and expanded rules/client/server behavior. Keep `PARSER_MODE=rules` until C verifies Gemini. Never commit `.env.local` or output secrets.

## Executed A verification

- Fresh `npm ci`: pass on Node 22.23.2 / npm 10.9.8; dependency audit reported zero vulnerabilities.
- Typecheck and ESLint: pass.
- Unit/contract tests: **89 passed** across contracts, engine and controller.
- Property evidence: **1,000 sequences up to 50 events, seed 20260912**, including invalid late operations, malformed quantities, stale/duplicate events, atomicity, invariants and replay. Reproduce: `npm test -- tests/core/engine.property.test.ts`. These tests are evidence, not formal proof.
- Production build: pass. App routes: `/`, `/api/health`, `/api/interpret`, plus Next's standard not-found page.
- Playwright: typed real rules journey through review and simulated receipt passes against a fresh production server.
- Live HTTP smoke: health and real rules response pass; invalid request 400, menu mismatch 409, oversized body 413 pass.
- Visual inspection: kiosk layout and $13.50 cart checked in the in-app browser.
- **Physical Wi-Fi-off demonstration passed** around 10:04 p.m.: verified the Mac's Wi-Fi switch was off; typed `make the burger a double` in the preloaded production app; observed $16.00; reviewed and confirmed a simulated receipt. Restored Wi-Fi and verified connected status.

An intermediate browser test hit stale assets while the visible server was being rebuilt. Tests now start their own fresh server on port 3100; rerun passed. No current failing automated checks are known.

## Deployment and remaining handoffs

Vercel sign-in verified for `cadensolomon07-8134`. **Public demo: https://tartan-order.vercel.app**. Implementation SHA `3ca392b219b90d24574bca21aa3f77cba51eb8b5`; deployment `dpl_B1nB1ppEWiriuZMQm8QUdgWziWeE` is READY and its API reports Node 22.x. The project now explicitly uses Node 22.x and `npm ci`. No purchase was made. Keep environment variables server-only. Health reports rules until C verifies Gemini integration.

Public health returned HTTP 200 with `{v:1,menuVersion:'demo-v1',parser:'rules'}`. The deployed receipt journey passed in a fresh logged-out Chromium context; the public page was also visually inspected in the in-app browser. Share the primary public URL above: Vercel's alternate deployment/team URLs require sign-in.

A second deployed browser check also passed the $13.50 → $16.00 → undo journey, second-burger ambiguity and row choice, huge-quantity rejection without cart changes, immediate review invalidation on input, and final explicit receipt. No browser page errors were observed.

B/C received their temporary files with `1676b3d`; A stopped editing them at handoff. The starter client always uses local rules, even with Local only unchecked. C must supply the HTTP client, cancellation-aware fallback, 5-second server / 6-second client deadlines, expanded grammar, provider validation and evals. B must supply voice, review speech and the finished kiosk. No B/C commits were available at this checkpoint. Add C's eval command when that handoff arrives.

Remaining release gates: integrate B/C sequentially and repeat deployment/browser checks after integration. If H3 fails, fix the vertical slice before feature expansion. Cut import/replay UI and visual extras first; preserve atomicity, confirmation and engine/export/replay tests.
