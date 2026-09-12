# Demo and release runbook

## Timing (America/New_York)

The supplied start is Friday September11,2026 at9p.m.; cutoff is Saturday September12 at4p.m.EDT: **19 hours**. Feature freeze is Saturday11a.m.; target submission3:15p.m.; protect11a.m.–3:15p.m. for stabilization/presentation. No twentieth coding hour.

- H0.5 Friday9:30p.m.: bootstrap/contracts (session implementation actually began about9:50p.m.; earlier milestones are already compressed).
- H1.5 Friday10:30p.m.: controller/minimal engine, first B/C integration.
- H3 Saturdaymidnight: deployed real rules typed-to-receipt slice.
- H5.5 Saturday2:30a.m.: full transaction semantics.
- H8 Saturday5a.m.: property/replay evidence and local offline typed flow; contract freeze.
- H11 Saturday8a.m.: integration checkpoint.
- H14 Saturday11a.m.: release candidate and feature freeze.

Official organizer verification on September11: [Devpost](https://hack-cmu-2026.devpost.com/) lists September12 at4p.m.EDT, project description and track selection, plus a50-word track-fit explanation. Judging covers usefulness, technical complexity, originality and demo quality. Gemini API has a sponsor prize, contingent on actually using it. [Organizer site](https://www.acmatcmu.com/hackcmu2026/) still contains placeholder tracks; its visible Google Forms are signup forms. **The actual submission form and final track names remain unverified. Ask the on-site organizer for these before submission.** Do not substitute an old year's form.

## Local production fallback

```sh
nvm use
npm ci
cp .env.example .env.local # only if .env.local does not already exist
npm run build
npm run start
```

Open http://localhost:3000. Select Local only. Once the production page is loaded, disable Wi-Fi using the computer's network control and run the typed demo. All local assets are bundled; no remote fonts/images are required. Re-enable Wi-Fi after the demonstration. Browser network-offline testing is separate evidence, not a claim that the physical Wi-Fi switch was exercised.

## Demonstration

1. New order; type `a burger, fries and lemonade`: three separate lines, $13.50.
2. Type `make the burger a double`: $16.00. Type `undo`: $13.50.
3. Add another burger; type `remove burger`: show both choices. Select the second burger; only that line disappears.
4. Review all items, quantities, modifiers and total. Begin editing the input; confirmation must disappear immediately.
5. Cancel input, review again, explicitly confirm. Show simulated-only receipt. New order is required before editing.
6. Engineering panel shows actual parser mode. Export the append-only audit. Replay tests reconstruct the same state without any live action.

The starter is **typed input + local rules only**, with a limited grammar. Unsupported language is rejected; no fixtures stand in for parser success. B owns Web Speech/speechSynthesis. C owns provider verification and full rules/client/server behavior. Keep PARSER_MODE=rules until C verifies Gemini credentials/model. Never commit .env.local or output secrets.

## Deployment

Vercel login is currently required on A's computer. Do not purchase a plan. Import the existing GitHub repository or deploy this root using Vercel with Node22 and the default Next.js preset. Keep parser environment server-only. Initial health route honestly reports rules until the C integration verifies Gemini.

After deployment, check `/api/health`, then test `/` in a second logged-out browser context. Save the URL, commit SHA and actual mode here. An HTTP200 alone is insufficient UI evidence.

## Release gates

Fresh npm ci; typecheck; ESLint; unit/contract tests; build; relevant Playwright tests. Property checks must run1000 sequences of up to50 events with a recorded seed and invalid/stale inputs. Cover atomic late failures, invalid pairings/quantities, missing/multiple references, stale/reset/duplicate responses, undo referent/revisions, review invalidation, confirmation gates/idempotency and replay equivalence. These tests are evidence, not formal proof.
