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

Prepare this before the demo while internet is available. Preserve an existing `.env.local`; the conditional copy below does not overwrite it.

```sh
nvm use
npm ci
test -f .env.local || cp .env.example .env.local
npm run build
npm run start
```

If `nvm` or `node` is unavailable on A's Mac, use the installed Node 22.23.2 runtime before running npm:

```sh
export PATH="/Users/cadensolomon/Documents/Codex/2026-09-11/workstream-a-astra-6-in-codex/work/runtime/node-v22.23.2-darwin-arm64/bin:$PATH"
cd /Users/cadensolomon/Documents/Codex/2026-09-11/workstream-a-astra-6-in-codex/TartanOrder
```

Open http://localhost:3000. Select Local only. Once the production page is loaded, disable Wi-Fi and run the typed demo; restore Wi-Fi afterward. All assets are bundled, with no remote fonts/images. Stop the production server before rebuilding to avoid stale assets.

Playwright starts a fresh production server on port 3100, separate from the visible demo on port 3000. Build first. Set `PLAYWRIGHT_BASE_URL` to test a deployment.

## Recover during the demo

- **Internet or provider unavailable:** keep the loaded page open, select **Local only**, and use typed input or menu buttons. Show the actual parser mode. The current starter already uses local rules; this recovery also applies after C's network client arrives. Do not claim Gemini success when rules handled the request.
- **Draft or microphone capture stuck:** use the input's Cancel/Stop control and clear the draft. This must end capture before review can proceed. In the current starter, **Cancel input** releases draft capture; it does **not** abort a parser request already in flight.
- **Parsing stuck:** change the **Local only** selection to cancel the active request. If already selected, turn it off and back on without submitting between changes. Then cancel any remaining draft and retry a short typed order. A mode change preserves an active draft, so switching modes alone may leave review disabled. Cancelled/late responses are ignored.
- **Review or confirmation disappeared:** this is expected after starting input or attempting an edit, even if the edit was rejected. Finish or cancel input, resolve any item choice, select **Review order**, inspect the complete snapshot, then confirm again. An old confirmation cannot be reused.
- **Wrong accepted edit:** use **Undo** to restore the previous accepted cart batch and its reference. Review again afterward. **New order** abandons the whole session, clears its history and receipt, and starts empty; use it after a completed simulated receipt or when intentionally restarting.
- **Before reload, closing the tab, or New order:** export the audit from the engineering panel if the history matters. Orders exist only in page memory. Reload/reset loses the live cart; an export supports inspection/replay, not restoration into the live order. Replay must never enable live confirmation or make parser/voice calls.
- **Deployed page fails:** use the primary public URL, https://tartan-order.vercel.app, rather than a sign-in-protected team/deployment URL. If it remains broken, switch to the prebuilt local page at http://localhost:3000 with **Local only**. If its server stopped, use the runtime setup above and run `npm run start`; keep that terminal open. Reuse the existing production build during the demo. Installation/rebuilding needs a separate preparation window, and moving between deployed/local pages starts a separate order.

### A-only deployment recovery

The verified baseline recorded below is implementation `3ca392b219b90d24574bca21aa3f77cba51eb8b5`, deployment `dpl_B1nB1ppEWiriuZMQm8QUdgWziWeE`. Treat it as historical evidence, not a claim about the latest deployment. A first checks which deployment currently serves the primary URL.

In Vercel, open the correct project's Production Deployment tile and choose **Instant Rollback**. Select an eligible deployment already known to work; verify its commit/deployment identity and the `tartan-order.vercel.app` domain before confirming. Hobby accounts can roll back only to the immediately previous production deployment. If the verified baseline is unavailable, continue the local demo while A investigates; do not select an unverified build or purchase an upgrade. After rollback, A checks `/api/health` and the typed review/receipt journey in a fresh logged-out browser. Rollback uses the earlier build/environment and pauses automatic production-domain assignment; A must deliberately restore normal promotion after verifying a fix. [Vercel rollback instructions](https://vercel.com/docs/instant-rollback)

## Demonstration

1. Type `a burger, fries and lemonade`: three separate lines, $13.50.
2. Type `make the burger a double`: $16.00. Type `undo`: $13.50.
3. Add another burger; type `remove burger`: show both choices. Choose the second; only that line disappears.
4. Review every item, quantity, modifier and total. Begin editing input; confirmation disappears immediately.
5. Cancel input, review again, explicitly confirm. Show the simulated receipt. Start a new order before editing.
6. Show actual parser mode in the engineering panel and export the audit. The replay engine reconstructs it without a live action. The on-page replay/import viewer is not yet implemented; it is B-owned and can be cut under the agreed plan. Do not promise a visible replay button in the current demo.

Current mode: **typed input + C's real rules grammar**, local by default or through the server when Local only is unchecked. Unsupported language is rejected; fixtures are explicitly marked. B's voice/finished kiosk handoff awaits integration. Keep `PARSER_MODE=rules` until C verifies Gemini. Never commit `.env.local` or output secrets.

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

Follow-up evidence, September 11 around 10:44 p.m.: downloaded **Export audit** from the real deployed rules-based three-item receipt and replayed the exact downloaded bytes. Its five audit entries, receipt ID, cart and $13.50 total matched the displayed history/receipt; the live page was unchanged. Two new fixture-labelled React hook integration tests passed for StrictMode lifecycle, cancellation plus unchanged export after late response, and replay/remount isolation. One new targeted test rejected a tampered audit whose replacement error code was itself valid. Typecheck/lint passed. No production code changed and no existing property-suite rerun was needed for this follow-up.

## Deployment and remaining handoffs

**Latest verified deployment:** `8d55268` contains C's corrected parser and measured repeated-word fix, A's health integration and C's evaluation harness. Deployment `dpl_4FE8vFjQMwC4n98c2cKHmEGh7HgR` serves https://tartan-order.vercel.app; public rules health, GitHub CI and a fresh logged-out browser journey passed. The browser exercised real HTTP edits, repeated words, ambiguity, undo, review invalidation and explicit simulated receipt, then offline local-only typed confirmation. B's draft correction remains pending; the public UI is still the typed starter. The records below describe earlier verification and are retained as historical evidence.

Vercel sign-in verified for `cadensolomon07-8134`. **Public demo: https://tartan-order.vercel.app**. Implementation SHA `3ca392b219b90d24574bca21aa3f77cba51eb8b5`; deployment `dpl_B1nB1ppEWiriuZMQm8QUdgWziWeE` is READY and its API reports Node 22.x. The project now explicitly uses Node 22.x and `npm ci`. No purchase was made. Keep environment variables server-only. Health reports rules until C verifies Gemini integration.

Public health returned HTTP 200 with `{v:1,menuVersion:'demo-v1',parser:'rules'}`. The deployed receipt journey passed in a fresh logged-out Chromium context; the public page was also visually inspected in the in-app browser. Share the primary public URL above: Vercel's alternate deployment/team URLs require sign-in.

A second deployed browser check also passed the $13.50 → $16.00 → undo journey, second-burger ambiguity and row choice, huge-quantity rejection without cart changes, immediate review invalidation on input, and final explicit receipt. No browser page errors were observed.

B/C received their temporary files with `1676b3d`; A stopped editing them at handoff. C's corrected parser now supplies the HTTP client, cancellation-aware fallback, 5-second server / 6-second client deadlines, grammar and provider validation. A has added `npm run eval` for C's separately reviewed harness. Default evaluation uses development/adversarial cases and no network; add `EVAL_BASE_URL=https://tartan-order.vercel.app` for deployed HTTP. Do not include `heldout` before H8 or tune on it afterward. B's ready V1 handoff remains the next integration; Gemini verification and voice evidence remain pending.

Remaining release gates: integrate B/C sequentially and repeat deployment/browser checks after integration. If H3 fails, fix the vertical slice before feature expansion. Cut import/replay UI and visual extras first; preserve atomicity, confirmation and engine/export/replay tests.
