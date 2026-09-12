# Demo and release runbook

Main now combines API 3 with sidebar, notes and language selection. The GitHub merge itself does not deploy the database-backed application. For a database-free local rehearsal of main, explicitly run with `CATALOG_SOURCE=bundled ORDER_PERSISTENCE=off`; the source and saving badges disclose that mode. Confirm the public health response before using any historical deployment instructions below.

## Gemini microphone transcription — September 12

Select **Español** or **简体中文**, press Talk, speak, then press Stop. Gemini transcribes the recorded audio; the usual parser and atomic engine process the native-language text. English keeps browser recognition. Microphone permission and internet are required for the Gemini path. Clips are limited to 30 seconds and 2 MB; reaching the time limit discards the clip rather than submitting an incomplete order. Cancel, language/location changes and Local only discard capture and ignore late replies. Review and confirmation remain blocked during capture/transcription.

Recovery: if transcription fails, type the order or use menu buttons. There is no automatic audio retry. Offline, use translated menu buttons or English local rules. TartanOrder holds raw audio in memory only for the request and does not save or log it; the normal order transcript can appear in the order audit. Audio is sent to Google's Gemini service for processing. The existing protected `GEMINI_API_KEY` and verified `GEMINI_MODEL` are used server-side; no new environment variable is needed.

Human check: choose Demo Counter and Español; say **“Un agua con hielo extra, por favor.”** Stop, check water with the extra-ice note at **$1.50 (demo price)**, then Review and explicitly confirm. Mandarin equivalent: **“请给我一杯加冰的水。”** The two synthetic real-provider journeys passed, but they are not human microphone or language-accuracy evidence.

## Language selector — September 12 release

The header offers English, Español and 简体中文. Select a language before pressing the microphone or typing. English uses browser speech recognition. Español and 简体中文 record microphone audio and send it to Gemini for native-language transcription; spoken reviews use a matching installed voice. If no matching voice exists, read the full review on screen. Microphone support varies by browser; typing always remains available. Changing language cancels capture/drafts and parsing, keeps accepted cart contents, and invalidates an uncommitted review. Review again before confirming. Mandarin composition Enter does not submit unfinished text.

The primary controls, demo item labels and review/receipt labels are translated. Campus menu names, detailed source/evidence descriptions, some dynamic requirement explanations and engineering diagnostics may remain English. Prices and canonical item IDs never change with language. Gemini receives the selected locale and can return native-language questions and special requests. Local rules remain English-only: in an offline Spanish/Chinese session use the translated menu buttons, or select English for simple typed rules. No translation quality or live microphone accuracy metric is claimed.

For a short check, select Demo Counter, Español, and type `Un agua con hielo extra y unas papas fritas, por favor.` Or select 简体中文 and type `请给我一杯加冰的水和一份薯条。` Both local real-Gemini browser journeys produced water with its ice note plus fries at $4.50, then a reviewed simulated receipt. Evidence: `evals/runs/languages-live-2026-09-12.json`. The Gemini audio release also passed real-provider journeys with synthetic Spanish and Mandarin speech injected into Chromium’s microphone. Have a person repeat one utterance before claiming human multilingual microphone verification.

## Current meal and dietary milestone — September 12

The consolidated menu uses API 3 / catalog version `cmu-dietary-2026-09-12`, loaded from the Supabase project and shown in the kiosk footer badges as `Menu: Supabase · cmu-dietary-2026-09-12`; the ranked campus shortlist and the fictional Demo Counter are the selectable locations. Details and omissions: [dining-data.md](dining-data.md).

The catalog version `cmu-dietary-2026-09-12` keeps the eight campus venues with orderable menus, stores inferred ingredient marks and removal options for campus items, and keeps a separate **Demo Counter · fictional recipes** for the requested meal/recipe demonstration. The complete script is [meal-demo.md](meal-demo.md). Start with “I have twelve dollars. Get me a main, a side, and a drink. Keep the fries and lemonade.” The calculated accepted subtotal is $12. Requesting chicken proposes $14 while preserving the accepted meal; only an explicit current choice raises the budget. Review and confirm a simulated receipt.

Dietary preferences, dislikes and allergies also apply to ordinary ordering. Campus cards and cart lines show marks inferred from the published wording (“from menu wording”); a detected ingredient can block a choice, but the absence of a mark is not allergy evidence, and preparation remains unknown. The staff summary is on screen only and contacts nobody. The Demo recipes/preparation are fictional. Budgets exclude uncalculated taxes and fees.

**Meal recovery:** on the prebuilt local server, select **Engineering → Local only**, then use Build my meal, budget/component controls, menu cards and decision buttons. The new browser-offline check completed a $12 vegan meal through review and receipt with zero interpret requests. This disables browser networking, not the physical Wi-Fi adapter. Complex conversational meal requests require Gemini; manual controls are the dependable offline path. Finish or discard budget/allergy/dislike drafts before review. Cancelling capture restores fresh pending-decision buttons, never an old review. Undo restores the meal/cart while retaining the current dietary profile; **New order** clears profile and conversation. Explicit exported logs contain requirements and must not be casually shared.

Current candidate checks: 697 default tests passed, 29 opt-in checks skipped; typecheck, lint and production build passed. Nine real Gemini adapter cases and the seven-request complete local browser journey passed without fallback. These are synthetic typed checks, not a new human microphone trial. Publication/CI evidence is reported separately; older release entries below are historical.

## Consolidated campus menu

The campus menu lists eight venues with 237 published fixed-price configurations. Choose a location with the **Order from** list; the initial location is **Stack’d Underground**. Au Bon Pain, Capital Grains and Schatz were removed from the selector on September 12, 2026 because they have no complete prices; their previews remain archived. Hunan's main entrées also remain previews because the included-side choices are unresolved. Prices come from dated published PDFs, not a live register. Details and omissions: [dining-data.md](dining-data.md).

Demo path: press **Talk**, say “One Smash’d Burger and fresh cut fries,” then **Stop — I’m done**. With a successful Gemini response the total should be **$12.65**. Review lists the location, items and prices; **Confirm simulated order** creates a receipt without sending anything. Use exact names and sizes when several variants are offered. No newly recorded campus microphone success is claimed until a person performs this test.

Recovery: select **Engineering → Local only**, then type `a smashd burger` and submit; type `fresh cut fries` and submit separately. Expect $12.65, then review and confirm. Campus local rules accept one exact menu item/quantity per input plus remove, quantity edits and undo; menu buttons also work offline. The prebuilt local server at http://127.0.0.1:3000 remains the offline fallback. Discard unfinished text or cancel capture before review. **New order** clears a committed session; changing location keeps existing cart items and cancels unfinished input/review.

Restaurants outside the shortlist remain unavailable in public selection and new orders. The separate fictional Demo Counter is restored only for the new meal demonstration, with explicit recipe provenance; it is not a campus restaurant. Earlier videos do not prove current campus prices. Export logs are catalog-version-bound: earlier `demo-v2` and `cmu-published-2026-09-12` logs are rejected rather than repriced. `npm run dining:check` checks directory links/PDF bytes without changing the released catalog.

The notes below retain historical release evidence and setup instructions. The meal and campus sections supersede their old default-menu instructions.

## Supabase persistence

The catalog and every simulated order live in the Supabase project **TartanOrder** (organization TartanHacks, ref `rdjcqtpusbjxgigprpns`, region us-west-2, Postgres 17). There is no local database stack and no Docker: the hosted project is the only database, migrations are applied to it directly, and checks run against it.

**Environment.** `.env.local` (and the Vercel project settings, for Production and Preview) hold `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` (an `sb_publishable_…` key) and `SUPABASE_SECRET_KEYS` (an `sb_secret_…` key), taken from the project's **Settings → API Keys** page. Only these current formats are accepted; `src/db/config.ts` refuses the legacy `anon`/`service_role` JWT keys and any non-project URL at first use, and the failure message never includes a value. `CATALOG_SOURCE=supabase` and `ORDER_PERSISTENCE=supabase` are the defaults; `CATALOG_SOURCE=bundled` serves the in-repo catalog for offline work and is labelled everywhere, and `ORDER_PERSISTENCE=off` disables server saving with a visible "Server saving off" badge. Never paste a key into chat, code, logs or Git.

**Schema.** `supabase/migrations/20260912000001_init.sql` creates eight tables (`catalog_versions`, `locations`, `modifiers`, `items`, `menu_previews`, `sessions`, `audit_events`, `receipts`), enables Row Level Security on all of them, grants anonymous `select` on the five catalog tables only, and installs the immutability triggers; `20260912000002_items_ordinal.sql` adds the display order. They were applied on September 12, 2026 and are recorded in the project's migration history as `20260912164718 init_catalog_and_orders` and `20260912164935 items_ordinal`. To apply a new migration file, use the Supabase MCP `apply_migration` with the file's content, or `supabase link --project-ref rdjcqtpusbjxgigprpns` followed by `supabase db push --linked` from the CLI. Never hand-edit the remote schema.

**Seed and verify.** `npm run db:seed:sql` regenerates `supabase/seed.sql` from the bundled catalog; `npm run db:seed:apply` inserts the version's rows through the secret key with `ON CONFLICT DO NOTHING` semantics (safe to re-run; the immutability trigger is never hit) and then activates the version. `npm run db:verify` reads the counts back through the publishable key and exits `1` unless it finds one active version, 46 locations, 7 modifiers, 506 items, 50 previews and zero visible rows in every order table. Read-only SQL through the MCP `execute_sql` gives the same counts; an `update` on `items` must fail with `catalog rows are immutable; publish a new catalog version instead`.

**Roll back a bad catalog version.** Rows are never deleted or edited. Publish the corrected data as a new version (see [dining-data.md](dining-data.md)), or re-activate the previous one with two statements in this order, because at most one version may be active: `update public.catalog_versions set is_active = false where is_active;` then `update public.catalog_versions set is_active = true where id = '<previous version id>';`. Sessions keep the `catalog_version_id` they were recorded with, so their exports still replay against that version.

**Rotate a key.** In **Settings → API Keys** create a new secret (or publishable) key, put its value into `.env.local` and the Vercel environment, redeploy, confirm `/api/health` and one simulated order, then delete the old key. The application reads keys only at first use, so a redeploy (or restart) is required.

**Health check.** `GET /api/health` returns `{ "v": 3, "menuVersion": "cmu-shortlist-2026-09-12", "parser": "gemini", "catalog": { "source": "supabase", "versionId": "cmu-shortlist-2026-09-12" }, "orderPersistence": "supabase" }` when everything is configured. `catalog.source` is `bundled` when the fallback is deliberately selected and `unavailable` (with `menuVersion: null`) when the database load failed; the page then shows a labelled panel with no menu instead of silently serving bundled data.

**During a demo.** The kiosk header shows the catalog badge and a save-state badge: "Saved to server", "Saving to server…", "Not saved to server" with **Retry**, or "Server saving off". A failed save never changes the cart; keep ordering and press Retry when the network is back. The engineering panel's **Fetch server copy (JSON)** downloads the stored session as a replayable export; **Export full log (JSON)** still exports the in-kiosk copy without any network call.


## Historical V2 release evidence — superseded by the campus menu

The local candidate uses **API 2 / `demo-v2`**, an eleven-item demonstration menu and online Gemini by default. Real local generation is verified with **`gemini-3.6-flash`**. Gemini 2.5 Flash generation was unavailable for the configured key; do not label this release as using 2.5. The key remains server-only in ignored local configuration and the existing Vercel environment.

**V2 is now live at https://tartan-order.vercel.app.** Verified application SHA: `3bb09ba2ae0a8409f84bd22803b3266f18b2a918`; promoted Vercel deployment: `dpl_8ou8KnrR6r6tbP6rGbhBmRY5eoFV`. Public health reports V2/demo-v2/Gemini. A real hosted burger/lemonade request returned correct operations with Gemini/no fallback; server logs contain actual provider usage. The first V2 candidate failed hosting configuration and was not promoted; the working local key/settings were securely synchronized before the verified rebuild. Final C changes were reconciled and its older evidence preserved separately. Old ownership holds and the V1 freeze are superseded by coordinated end-to-end completion.

The current candidate passed fresh `npm ci` (zero reported vulnerabilities), typecheck, lint, production build, **476 default tests / 18 optional skips**, and **19/19 Playwright tests with no skips**. The HTTP 503 browser recovery test observed an injected failure; it is not a real provider call. Generated engine evidence remains **1,000 sequences up to 50 events, seed `20260912`**. GitHub CI also passed the full suite. These checks do not replace the pending human microphone trial. Public fresh-browser Gemini ordering, review and receipt verification passed; the 149.92-second backup video is recorded and visually inspected.

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

[Official Devpost](https://hack-cmu-2026.devpost.com/) confirms the September 12, **4 p.m. EDT** cutoff and asks for a project description, track selection and approximately 50 words explaining track fit. Start from [the verified Devpost project-entry page](https://devpost.com/submit-to/31074-hack-cmu/manage/submissions); its logged-out view requires hackathon registration, so the actual participant fields have not been inspected. The public schedule also mentions a Google submission form without linking it.

[Official rules](https://hack-cmu-2026.devpost.com/rules) judge practical value, implementation difficulty, originality and demonstration quality; original work must begin during the event. The [Gemini prize listing](https://hack-cmu-2026.devpost.com/#prizes) lists one winner receiving Google swag for a project using its API. No additional public Gemini submission requirements were found; this is eligibility information, not a prize claim.

**Still needed from the participant account or on-site organizer:** the final track names and confirmation of the actual submission destination/Google Form. The [organizer site](https://www.acmatcmu.com/hackcmu2026/) still shows five placeholder tracks; its linked registration/signup forms are not verified project-submission forms. Public Devpost updates/discussions did not resolve this. No submission, registration or outsider message has been sent.

## Local production fallback

Prepare this before the demo while internet is available. Preserve an existing `.env.local`; the conditional copy below does not overwrite it. For the online demo, it must contain `PARSER_MODE=gemini` and `GEMINI_MODEL=gemini-3.6-flash`, with the key entered securely in that ignored file, plus the three Supabase variables above. For a fully offline rehearsal set `CATALOG_SOURCE=bundled` and `ORDER_PERSISTENCE=off` in that file before building; the kiosk then labels the menu as the bundled fallback. Never paste a key into chat, browser code, logs or Git. Missing/unavailable Gemini has a visibly labelled rules recovery path.

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

Playwright starts a fresh production server on port 3100, separate from the visible demo on port 3000. Build first. `npm run test:e2e` is keyless: the server under test runs the labelled bundled catalog with server saving off, as in CI. `npm run test:e2e:live` loads `.env.local` into the process so the server keeps its Supabase defaults and the database-backed journeys run against the project. Set `PLAYWRIGHT_BASE_URL` to test a deployment.

## Recover during the demo

- **Internet or provider unavailable:** keep the loaded page open, select **Local only**, and use short typed orders or menu buttons. Availability failures may already fall back with an explicit notice. Show the actual parser mode; a Gemini configuration flag or health response alone is not proof of successful Gemini interpretation.
- **Unfinished typed draft:** press **Discard** or erase the field. Typing holds the input active and blocks review/confirmation until submitted or discarded. Switching parser mode does not silently finish a draft.
- **Microphone capture stuck:** **Stop — I’m done** finishes the current utterance; **Cancel** discards it. Cancel a failed/stalled capture and use typing. Do not expect browser speech to work offline. An optional on-device pack depends on browser support and should be prepared before the demo.
- **Parsing stuck:** press the **Cancel** beside “Working on”. It aborts the active request and invalidates the old review; late responses cannot apply. Then select Local only and retry a short typed request if needed. Mode switching also aborts parsing, but any unfinished draft still needs Discard.
- **Review or confirmation disappeared:** this is expected after starting input or attempting an edit, even if the edit was rejected. Finish or cancel input, resolve any item choice, select **Review order**, inspect the complete snapshot, then confirm again. An old confirmation cannot be reused.
- **Wrong accepted edit:** use **Undo** to restore the previous accepted cart batch and its reference. Review again afterward. **New order** abandons the whole session, clears its history and receipt, and starts empty; use it after a completed simulated receipt or when intentionally restarting.
- **Before reload, closing the tab, or New order:** the session, its audit entries and the receipt are saved to the server behind the engine while the badge reads "Saved to server"; if it reads "Not saved to server", press **Retry** or use **Export full log (JSON)** in the engineering panel before leaving. **Fetch server copy (JSON)** downloads what the server holds. Export/replay supports detached inspection, not restoration into a live order; it never enables confirmation or makes parser/voice calls. V1, V2 and other-catalog-version logs are rejected by the V3 schema rather than silently converted; keep their original build if historical replay is needed.
- **Deployed page fails:** use the primary public URL, https://tartan-order.vercel.app, rather than a sign-in-protected team/deployment URL. If it remains broken, switch to the prebuilt local page at http://localhost:3000 with **Local only**. If its server stopped, use the runtime setup above and run `npm run start`; keep that terminal open. Reuse the existing production build during the demo. Installation/rebuilding needs a separate preparation window, and moving between deployed/local pages starts a separate order.

### A-only deployment recovery

The verified baseline recorded below is implementation `3ca392b219b90d24574bca21aa3f77cba51eb8b5`, deployment `dpl_B1nB1ppEWiriuZMQm8QUdgWziWeE`. Treat it as historical evidence, not a claim about the latest deployment. A first checks which deployment currently serves the primary URL.

In Vercel, open the correct project's Production Deployment tile and choose **Instant Rollback**. Select an eligible deployment already known to work; verify its commit/deployment identity and the `tartan-order.vercel.app` domain before confirming. Hobby accounts can roll back only to the immediately previous production deployment. If the verified baseline is unavailable, continue the local demo while A investigates; do not select an unverified build or purchase an upgrade. After rollback, A checks `/api/health` and the typed review/receipt journey in a fresh logged-out browser. Rollback uses the earlier build/environment and pauses automatic production-domain assignment; A must deliberately restore normal promotion after verifying a fix. [Vercel rollback instructions](https://vercel.com/docs/instant-rollback)

## Demonstration

Use the verified public V2 release, with the prebuilt local server ready as backup. Leave **Local only** unchecked; verify the first completed request shows `gemini` with no fallback notice. For a two-to-three-minute demo:

1. Say or type: `Hi I would like to order a burger and um also some fries and a lemonade too, actually wait can you make it a double burger with no lettuce.` Show exactly three lines and $16.00; no regular burger remains.
2. Continue: `Actually make that two lemonades and put the lettuce back on the burger`. Show $18.50, quantity two on lemonade and restored lettuce. Use **Undo** to demonstrate one accepted-batch reversal, then repeat the correction if time permits.
3. Review the complete cart. Begin a draft to show confirmation disappearing; **Discard**, review again and explicitly confirm. Show the simulated receipt, then start **New order**.
4. Type: `Can I get a pizza, a burger, and a lemonade?` Show the $10.50 supported order and honest unavailable-pizza response.
5. If time allows, add another burger, request `remove the burger`, then answer `the second one`. Show that only the selected line is removed.
6. Explain: “Gemini understands the request; our engine validates the edits, prices the menu and requires confirmation.” Show the actual mode and **Export full log (JSON)**. The replay engine is read-only; no on-page import viewer is wired, so do not promise one.

The eleven seeded items span mains, sides and drinks; burger “double” and “no lettuce” are supported, and pizza is deliberately unavailable. Proposed available edits apply atomically; unavailable items are explanatory notices. An ambiguous replacement asks before changing the cart. A pending question can be answered by typing or a captured utterance; current real-Gemini evidence used typing. Prices are demonstration data, not official CMU prices. There is no payment, POS call or kitchen dispatch.

The [fresh public Chromium recording run](../evals/runs/production-browser-gemini-2026-09-12.json) passed with **five real Gemini responses, no fallback, and zero page errors**. It exercised the exact long order, across-turn correction, Undo, supported pizza subset, targeted ambiguity and natural answer, then a full review and explicit $10.50 simulated receipt. The silent, visibly labelled backup is saved locally at `test-results/demo-recording/tartanorder-gemini.webm` (**149.92 seconds**, 1280×800); playback frames at 25/65/110/140 seconds were inspected. It is a recorded typed demonstration, not live speech evidence. The final receipt remains visible for the presenter's architecture explanation.

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

Remaining release gate: collect the actual human microphone observations above. The current browser-offline backup has passed; rehearse recovery on the demo laptop before presenting. Record exact deployed SHA/URL and results before claiming completion. Cut optional import/replay UI and presentation effects before weakening atomicity or confirmation.


## Wait demonstration recovery

`WAIT_TIME_MODE=seeded` is the default server-only setting. It loads fixed, labelled simulated waits; no live queue feed exists in the verified dining API. Leave this setting for the demo. Setting `api` explicitly produces unavailable waits and no suggestions, never an automatic seeded/live substitution.

Refresh the public kiosk after release, keep Stack’d Underground selected, and order “a Nashville sandwich.” If Gemini is unavailable, open Engineering, enable Local only, and type the exact published label “Nashville Sandwich - Southern-style Fried Chicken” or use its menu button. The menu button and wait offer work without a network once the page is loaded. Accept Switch to The Grill at Scotty’s; the single-item total becomes $9.99 and simulated preparation estimate becomes 4 min. Undo restores $9.20 / 14 min. Keep it or starting another input dismisses the offer. New order starts a clean session.

For a multi-item demonstration, add Fresh Cut Fries at Stack’d first, then the Nashville sandwich. The switch raises the total from $12.65 to $13.44, while the whole-cart preparation estimate stays 14 min because the fries remain at Stack’d. This excludes walking and pickup travel. Unknown vendor waits make the complete estimate unavailable.

If the network or provider fails, use the already-built local production server and Local only/menu buttons. Do not rebuild while that server is serving the demo. Keep the previous verified production deployment available for Vercel rollback. Export the engineering log to retain the fixed wait configuration and exact swap actions; replay remains a detached simulation. Nothing is dispatched to a real restaurant.


## Consolidated campus catalog (September 12, noon update)

Refresh the kiosk after deployment to load menu `cmu-shortlist-2026-09-12`. Only Hunan, The Exchange, Revolution Noodle, Tahini, Stack’d Underground, Capital Grains, ABP, Taste of India, Wild Blue Sushi, The Grill at Scotty’s and Schatz appear. The default remains Stack’d for the existing sandwich wait demo. Demo Counter and other retired counters are no longer selectable or orderable. Old-version exports reject instead of silently being repriced; keep the old release if examining those historical logs.

For new data, select Tahini and order “one falafel pita” ($9.95); select Revolution Noodle and order “one steamed pork bao bun” ($4.19). Exact published names work in Local only, one item per input. The menu buttons always use the same validated cart path. ABP/Capital Grains/Schatz have no complete verified fixed-price items; their previews cannot be added. Hunan entrée previews show the published base price but need included-side eligibility confirmed. No proxy, approximate, starting-at or invented price becomes an orderable total.

The source documents are snapshots, including older CMU-hosted PDFs. Do not describe them as live register prices or the requested order as a measured popularity ranking. Use the current campus demo below; the old recorded Demo Counter video is historical and does not show this catalog.

## Item note recovery

- If a note draft is holding review, choose **Save note** or **Cancel** on that cart row. Empty saved text removes its note. **Undo** restores the prior accepted cart and note together.
- If speech wording is not understood, use the item's **Add note / Edit note** control. It works without the network parser. For duplicate items, choose the specific cart row.
- Check the note beneath the correct item in review before confirming. Notes are unverified counter requests; they do not establish ingredient/allergy safety or include possible extra charges. Use the separate food requirements controls for dietary declarations.
- Refresh the page after a new release to load the matching client and server. Export an order you wish to retain first; refreshing starts a new local session.
