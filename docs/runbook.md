# Demo and release runbook

## Current V2 release status

The local candidate uses **API 2 / `demo-v2`**, an eleven-item demonstration menu and online Gemini by default. Real local generation is verified with **`gemini-3.6-flash`**. Gemini 2.5 Flash generation was unavailable for the configured key; do not label this release as using 2.5. The key remains server-only in ignored local configuration and the existing Vercel environment.

**This V2 work is not yet deployed.** The latest recorded public production remains the earlier typed A/C rules starter at https://tartan-order.vercel.app. A will verify the actual deployment identity, configuration and real Gemini journey before changing this status. The final C evaluation delta has been reviewed and incorporated; five historical evidence files were preserved. Old B/C ownership holds and the V1 contract freeze are superseded by the user's authorization for coordinated end-to-end completion.

The current candidate passed fresh `npm ci` (zero reported vulnerabilities), typecheck, lint, production build, **472 default tests / 18 optional skips**, and **19/19 Playwright tests with no skips**. The HTTP 503 browser recovery test observed an injected failure; it is not a real provider call. Generated engine evidence remains **1,000 sequences up to 50 events, seed `20260912`**. Full checks do not replace the pending human microphone and production trials.

The subsequently reviewed final C delta contains an evaluation helper and four transport regression tests. Its **10 relevant evaluation tests passed / 6 optional HTTP checks skipped**, with typecheck and lint passing. These supplemental results are reported separately from the earlier full-suite count.

**Current offline backup check:** on the prebuilt local production server at `http://localhost:3000`, a fresh Chromium browser with `setOffline(true)` and Local only selected completed the real rules burger/fries/lemonade → review → **$13.50 simulated receipt** journey. It made **zero interpret HTTP requests** and produced **zero page errors**. Browser networking was disabled; the Mac's physical Wi-Fi switch was not changed for this check. The older physical Wi-Fi-off demonstration remains separately labelled historical evidence below.

### Verified local Gemini evidence

The [recorded run](../evals/runs/live-app-gemini-2026-09-12T06-14-45-051Z.json), completed September 12 at 2:15 a.m. EDT against `http://127.0.0.1:3150`, contains **9 passing scenarios, zero failures and 14 real HTTP requests**. Every request returned HTTP 200, `parser="gemini"`, `fallbackReason=null`; calls ran sequentially with no retries. The real controller and engine applied the interpretations. These were synthetic typed utterances, not human speech trials.

| Scenario | Observed result |
| --- | --- |
| Exact long burger/fries/lemonade request | One double burger without lettuce, fries and lemonade; $16.00. |
| Correction across turns | Two lemonades; lettuce restored on the same double burger; $18.50. |
| Pizza plus burger and lemonade | Burger/lemonade added for $10.50; pizza explained as unavailable. |
| Two separate burgers, remove, “the second one” | Specific clarification; answer removed only the second line. |
| New menu items/options | Chicken without mayo, extra-cheese grilled cheese and dressing-on-side salad; $20.00. |
| Negative/excessive quantities and invalid option | Existing $11.00 cart preserved for all three requests. |
| Conditional unavailable replacement | Burger preserved while the app asked a question. |
| Three unused correction phrasings | Drink replacement/no ice, restored wrap lettuce, and cheese/water correction all matched the expected carts. |

The long-order scenario also reviewed, explicitly confirmed and replayed the $18.50 simulated receipt. Stored timings describe these requests only; no general accuracy or latency claim follows. To repeat deliberately against a ready server, use `LIVE_APP_URL=http://127.0.0.1:3150 npm test -- tests/core/gemini.acceptance.test.ts`. Ordinary tests skip this network suite; its report is written to `evals/runs` only when enabled. No client-side key is needed.

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

Prepare this before the demo while internet is available. Preserve an existing `.env.local`; the conditional copy below does not overwrite it. For the online demo, it must contain `PARSER_MODE=gemini` and `GEMINI_MODEL=gemini-3.6-flash`, with the key entered securely in that ignored file. Never paste the key into chat, browser code, logs or Git. Missing/unavailable Gemini has a visibly labelled rules recovery path.

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

Open http://localhost:3000. For the offline backup, open the engineering panel and select **Local only (skip the network parser)**. Use simple typed orders or menu buttons; the fallback does not promise Gemini's conversational understanding. Once the production page is loaded, disable Wi-Fi and rehearse the backup; restore Wi-Fi afterward. All assets are bundled, with no remote fonts/images. Stop the production server before rebuilding to avoid stale assets. The earlier physical Wi-Fi-off success below is historical; repeat it on the release build before presenting.

Playwright starts a fresh production server on port 3100, separate from the visible demo on port 3000. Build first. Set `PLAYWRIGHT_BASE_URL` to test a deployment.

## Recover during the demo

- **Internet or provider unavailable:** keep the loaded page open, select **Local only**, and use short typed orders or menu buttons. Availability failures may already fall back with an explicit notice. Show the actual parser mode; a Gemini configuration flag or health response alone is not proof of successful Gemini interpretation.
- **Unfinished typed draft:** press **Discard** or erase the field. Typing holds the input active and blocks review/confirmation until submitted or discarded. Switching parser mode does not silently finish a draft.
- **Microphone capture stuck:** **Stop — I’m done** finishes the current utterance; **Cancel** discards it. Cancel a failed/stalled capture and use typing. Do not expect browser speech to work offline. An optional on-device pack depends on browser support and should be prepared before the demo.
- **Parsing stuck:** press the **Cancel** beside “Working on”. It aborts the active request and invalidates the old review; late responses cannot apply. Then select Local only and retry a short typed request if needed. Mode switching also aborts parsing, but any unfinished draft still needs Discard.
- **Review or confirmation disappeared:** this is expected after starting input or attempting an edit, even if the edit was rejected. Finish or cancel input, resolve any item choice, select **Review order**, inspect the complete snapshot, then confirm again. An old confirmation cannot be reused.
- **Wrong accepted edit:** use **Undo** to restore the previous accepted cart batch and its reference. Review again afterward. **New order** abandons the whole session, clears its history and receipt, and starts empty; use it after a completed simulated receipt or when intentionally restarting.
- **Before reload, closing the tab, or New order:** use **Export full log (JSON)** in the engineering panel if history matters. Orders exist only in page memory. V2 export/replay supports detached inspection, not restoration into a live order. It never enables confirmation or makes parser/voice calls. V1 logs are rejected by the V2 schema rather than silently converted; keep their original build if historical replay is needed.
- **Deployed page fails:** use the primary public URL, https://tartan-order.vercel.app, rather than a sign-in-protected team/deployment URL. If it remains broken, switch to the prebuilt local page at http://localhost:3000 with **Local only**. If its server stopped, use the runtime setup above and run `npm run start`; keep that terminal open. Reuse the existing production build during the demo. Installation/rebuilding needs a separate preparation window, and moving between deployed/local pages starts a separate order.

### A-only deployment recovery

The verified baseline recorded below is implementation `3ca392b219b90d24574bca21aa3f77cba51eb8b5`, deployment `dpl_B1nB1ppEWiriuZMQm8QUdgWziWeE`. Treat it as historical evidence, not a claim about the latest deployment. A first checks which deployment currently serves the primary URL.

In Vercel, open the correct project's Production Deployment tile and choose **Instant Rollback**. Select an eligible deployment already known to work; verify its commit/deployment identity and the `tartan-order.vercel.app` domain before confirming. Hobby accounts can roll back only to the immediately previous production deployment. If the verified baseline is unavailable, continue the local demo while A investigates; do not select an unverified build or purchase an upgrade. After rollback, A checks `/api/health` and the typed review/receipt journey in a fresh logged-out browser. Rollback uses the earlier build/environment and pauses automatic production-domain assignment; A must deliberately restore normal promotion after verifying a fix. [Vercel rollback instructions](https://vercel.com/docs/instant-rollback)

## Demonstration

Use the verified local V2 build until the production release is verified. Leave **Local only** unchecked; verify the first completed request shows `gemini` with no fallback notice. For a two-to-three-minute demo:

1. Say or type: `Hi I would like to order a burger and um also some fries and a lemonade too, actually wait can you make it a double burger with no lettuce.` Show exactly three lines and $16.00; no regular burger remains.
2. Continue: `Actually make that two lemonades and put the lettuce back on the burger`. Show $18.50, quantity two on lemonade and restored lettuce. Use **Undo** to demonstrate one accepted-batch reversal, then repeat the correction if time permits.
3. Review the complete cart. Begin a draft to show confirmation disappearing; **Discard**, review again and explicitly confirm. Show the simulated receipt, then start **New order**.
4. Type: `Can I get a pizza, a burger, and a lemonade?` Show the $10.50 supported order and honest unavailable-pizza response.
5. If time allows, add another burger, request `remove the burger`, then answer `the second one`. Show that only the selected line is removed.
6. Explain: “Gemini understands the request; our engine validates the edits, prices the menu and requires confirmation.” Show the actual mode and **Export full log (JSON)**. The replay engine is read-only; no on-page import viewer is wired, so do not promise one.

The eleven seeded items span mains, sides and drinks; burger “double” and “no lettuce” are supported, and pizza is deliberately unavailable. Proposed available edits apply atomically; unavailable items are explanatory notices. An ambiguous replacement asks before changing the cart. A pending question can be answered by typing or a captured utterance; current real-Gemini evidence used typing. Prices are demonstration data, not official CMU prices. There is no payment, POS call or kitchen dispatch.

### Human microphone trial — still required

On the demo laptop, allow microphone access, press **Talk**, say the long request in step 1, then press **Stop — I’m done** once. Report the visible **Heard** text, cart, assistant reply and parser label. Expected: one complete submission, $16.00, `gemini`, and no later duplicate.

Then say the cross-turn correction in step 2; try `remove the burger` with two separate burgers and answer `the second one`. Test **Cancel** halfway through speech and **New order** before an old result arrives: neither should introduce a stale item. Start another utterance while a reply is being read; reply speech should stop before listening. Record browser/OS, successes and failures. Until these observations are supplied, describe voice as implemented with automated lifecycle checks, not verified on the human's microphone.

### V2 limits

At most five cart lines, ten total units, quantity 1–5 per line, eight operations per proposal and three offered choices. Open clarification may have no buttons. Transcript limit: 1,500 characters; recent conversation: eight turns of up to 1,000 characters; questions/messages: 300 characters; HTTP body: 32,768 bytes. The server bounds the complete request lifecycle to 15 seconds and the client to 17 seconds, with no automatic network retry. Model line references and pending resolutions are checked against bounded context before engine validation.

## Historical A verification — V1 baseline

- Fresh `npm ci`: pass on Node 22.23.2 / npm 10.9.8; dependency audit reported zero vulnerabilities.
- Typecheck and ESLint: pass.
- Unit/contract tests: **89 passed** across contracts, engine and controller.
- Property evidence: **1,000 sequences up to 50 events, seed 20260912**, including invalid late operations, malformed quantities, stale/duplicate events, atomicity, invariants and replay. Reproduce: `npm test -- tests/core/engine.property.test.ts`. These tests are evidence, not formal proof.
- Production build: pass. App routes: `/`, `/api/health`, `/api/interpret`, plus Next's standard not-found page.
- Playwright: typed real rules journey through review and simulated receipt passes against a fresh production server.
- Live HTTP smoke: health and real rules response pass; invalid request 400, menu mismatch 409, oversized body 413 pass.
- Visual inspection: kiosk layout and $13.50 cart checked in the in-app browser.
- **Physical Wi-Fi-off demonstration passed** around 10:04 p.m.: verified the Mac's Wi-Fi switch was off; typed `make the burger a double` in the preloaded production app; observed $16.00; reviewed and confirmed a simulated receipt. Restored Wi-Fi and verified connected status.

An intermediate browser test hit stale assets while the visible server was being rebuilt. Tests were changed to start their own fresh server on port 3100; that rerun passed. These results describe the V1 checkpoint, not the final V2 gate.

Follow-up evidence, September 11 around 10:44 p.m.: downloaded **Export audit** from the real deployed rules-based three-item receipt and replayed the exact downloaded bytes. Its five audit entries, receipt ID, cart and $13.50 total matched the displayed history/receipt; the live page was unchanged. Two new fixture-labelled React hook integration tests passed for StrictMode lifecycle, cancellation plus unchanged export after late response, and replay/remount isolation. One new targeted test rejected a tampered audit whose replacement error code was itself valid. Typecheck/lint passed. No production code changed and no existing property-suite rerun was needed for this follow-up.

## Historical deployment and integration record

**Last recorded public baseline:** `dpl_GDNrzEtG26wcxEUF9H2r6JEmBmUF` served https://tartan-order.vercel.app after A restored it following an automatic deployment of concurrently merged B code. Rules health and a fresh logged-out browser passed 11 HTTP utterances, edits, repeated words, ambiguity, undo, review invalidation, explicit receipt and offline local-only typed confirmation. At that checkpoint the public UI was the typed A/C starter, while main included B's `f9ed637` and a reproduced Stop-to-cloud-fallback defect. That historical hold is superseded by coordinated V2 fixes and release checks; it does not establish V2 production or human-speech success. Rollback paused automatic promotion, so A must deliberately verify and promote the release.

Earlier, Vercel sign-in was verified for `cadensolomon07-8134`. Implementation `3ca392b219b90d24574bca21aa3f77cba51eb8b5`, deployment `dpl_B1nB1ppEWiriuZMQm8QUdgWziWeE`, was READY on Node 22.x with `npm ci`. No purchase was made. Its health reported rules; this is historical configuration, not the new Gemini release.

Public health returned HTTP 200 with `{v:1,menuVersion:'demo-v1',parser:'rules'}`. The deployed receipt journey passed in a fresh logged-out Chromium context; the public page was also visually inspected in the in-app browser. Share the primary public URL above: Vercel's alternate deployment/team URLs require sign-in.

A second deployed browser check also passed the $13.50 → $16.00 → undo journey, second-burger ambiguity and row choice, huge-quantity rejection without cart changes, immediate review invalidation on input, and final explicit receipt. No browser page errors were observed.

B/C received their temporary files with `1676b3d`. Subsequent integrations added the HTTP client, cancellation-aware fallback, grammar, provider validation, kiosk/voice and `npm run eval`. Historical rules development/adversarial evaluations are documented in [evaluation.md](evaluation.md); their counts are not Gemini accuracy. Default evaluation does not use the network; `EVAL_BASE_URL` opts into an HTTP target. Keep held-out evaluation separate and do not tune on it after inspection.

Remaining release gates: deploy the verified V2 candidate to the existing project, verify actual production Gemini responses and the receipt journey in a fresh browser, and collect the human microphone observations above. The current browser-offline backup has passed; rehearse recovery on the demo laptop before presenting. Record exact deployed SHA/URL and results before claiming completion. Cut optional import/replay UI and presentation effects before weakening atomicity or confirmation.
