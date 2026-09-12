# TartanOrder — engineering overview

TartanOrder is a campus-food prototype built around a reversible transaction. A parser proposes edits; a deterministic engine validates the entire edit. Explicit confirmation of the current review creates a **simulated receipt**. There is no payment, purchase, POS connection or kitchen dispatch.

## Architecture

One Next.js App Router app uses React, TypeScript, ordinary CSS and strict Zod schemas. Local development and CI pin Node 22.23.2 and exact npm dependencies; Vercel hosts the app. The page composes B's kiosk with A's controller. C owns local rules and the optional Gemini adapter.

`Input → controller → interpreter → validated proposal → pure engine → review → explicit confirmation`

The controller owns capture, requests and cancellation. Starting input invalidates review and pending choices; capture and parsing block confirmation. The engine receives IDs/events as data, with no network, clock or random operations. Shared contracts/menu define IDs, modifiers, bounds and integer-cent prices. Parsers cannot create reviews, receipts or prices.

## Guarantees exercised by tests

| Boundary | Behavior checked |
| --- | --- |
| Atomic edits | Validate sequentially on a temporary cart; invalid quantities, modifier pairings or later operations reject the whole batch. |
| Ambiguity | Every ADD creates a separate line. Repeated matches produce targeted choices and revalidation; multiple ambiguities or more than three matches reject. |
| Undo and requests | Undo restores cart and referent while revision/audit advance. Cancelled, stale, duplicate and mismatched responses cannot change the order. |
| Confirmation | Review copies every line, modifier, quantity and total. Exact ID/revision and idle input are required; repeated confirmation returns one receipt. Committed orders cannot be edited. |
| Replay | Recorded events reconstruct a detached view without recognition, API calls or live confirmation. Late cancelled responses leave exported bytes unchanged. |

## Evidence available to judges

The combined A/B/C candidate has **422 passing default tests** (including A's 92) and **18 passing browser tests**; eight optional checks skip without live Gemini/HTTP settings. The browser HTTP 503 fallback check ran and passed. A separate targeted mocked-speech test exposed the Stop defect described below; the passing suite does not cover every lifecycle. The previous deployed evaluation passed all 12 integrity checks. The engine runs **1,000 generated sequences of up to 50 events, seed `20260912`**, including invalid/stale events. This is evidence, not formal proof. Fresh installation, typecheck, lint, build and typed browser journeys passed; see the [integration record](integration.md).

The deployed rules demo passed in a fresh logged-out browser: three items at $13.50 → double burger at $16.00 → undo at $13.50; second-burger ambiguity; input invalidating review; explicit confirmation. Typed ordering worked on a prebuilt local production server with physical Wi-Fi disabled. An actual downloaded audit reproduced the receipt without changing the page.

On 36 labelled development cases, rules matched 12/12 expected carts and 24/24 clarification/rejection outcomes, with 5/5 labelled choices completing. After fixing two measured repeated-word cases, four of 24 separate adversarial outcomes differ from labels; all four are rejections with different codes, and none produces an unexpected accepted cart. These development results do not establish accuracy on unseen language. [Evaluation evidence](evaluation.md) keeps denominators, transports and failures visible.

## Current limits and integration status

Prices are illustrative, not official CMU prices. The seeded menu has three items and burger-only modifiers. Bounds: five lines, ten units, quantities 1–5, eight operations and one ambiguity per batch. State lives in browser memory; export/replay is neither persistence nor a tamper-proof ledger. Browser validation establishes prototype correctness, not production security.

**At this checkpoint:** C's corrected parser is live in rules mode. B's V1 kiosk/voice is on main; its draft fix passes, but an on-device error can restart cloud recognition after Stop. A reproduced and reported that blocker and restored the public typed starter after an automatic deployment. Gemini and human microphone success remain unverified. The evaluation command is `npm run eval`; held-out cases have not run, and no voice or model-comparison performance is claimed. Fixture tests are labelled `fixture` and are not real parser success.
