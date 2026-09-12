# TartanOrder — engineering overview

TartanOrder turns typed or spoken campus-food requests into a reversible, **simulated** order. A parser proposes edits; a deterministic engine validates the entire batch. Explicit confirmation of the current review creates one simulated receipt. There is no payment, purchase, POS integration or kitchen dispatch.

## Architecture

One Next.js App Router app uses React, TypeScript, ordinary CSS and strict Zod contracts. The kiosk sends a browser speech transcript or typed input through the request controller, the server-side Gemini interpreter, and the pure order engine. Responses describing successful edits come from accepted before/after carts. Browser speech recognition and speech synthesis remain separate from Gemini's text interpretation.

`Transcript → controller → selected-menu interpretation → atomic engine → review snapshot → explicit confirmation`

The [ScottyLabs API](https://api.cmueats.com/v2/locations) supplies location metadata and menu links, **not item prices**. The released catalog contains 410 fixed-price configurations transcribed from CMU's linked PDFs across 12 locations, plus 45 directory listings. Each item records its location and source page; each source PDF records its hash. Prices are integer cents in an immutable, versioned catalog shared by server, engine and browser. Live API updates never reprice an existing cart or replay. See [dining-data.md](dining-data.md) for exact coverage and omissions.

Gemini receives the selected location's menu and bounded current cart/conversation. It cannot supply prices, invent accepted item IDs or confirm an order. Existing cart items remain editable after switching locations; new additions are interpreted against the selected location. For campus calls, short provider-only item codes are translated through an exact per-request dictionary before validation; this avoids a verified provider schema-size refusal. All accepted IDs/options are checked with the shared schemas and the engine. The original eleven-item sample menu remains separately labelled Demo Counter. Local rules provide offline recovery; campus rules accept one exact item/quantity at a time and basic remove, quantity-edit and undo commands.

## Tested guarantees

- **Atomicity and ambiguity:** every ADD creates a separate row. All operations validate on a temporary cart; one invalid operation rejects the entire batch. Ambiguous rows require a targeted choice, revalidated before application. Unavailable independent items/options can be explanatory notices alongside valid edits; conditional requests clarify first.
- **Cancellation and Undo:** the controller owns capture, parsing, request IDs, revisions and cancellation. New input invalidates review; capture and parsing block confirmation. Cancelled, duplicate or stale replies cannot edit the cart. Location changes retain cart contents and discard old clarification context. Undo restores the accepted batch and referent while audit/revision advance.
- **Review and confirmation:** review copies the full order and total. Confirmation requires its exact ID/revision and idle input. Repeated confirmation returns the same receipt. Committed orders require a new session before editing.
- **Replay:** recorded events and IDs reconstruct a detached order without recognition, HTTP calls or live confirmation. Catalog versions must match; older menu logs are rejected instead of silently repriced. Pure engine code has no clock, network or randomness.

## Evidence and limits

[Integration records](integration.md) distinguish unit/property tests, mocked browser speech/HTTP tests, real Gemini requests and user-reported microphone behavior. The [campus browser run](../evals/runs/campus-browser-gemini-2026-09-12T07-46-33-814Z.json) passed 14 real Gemini requests across all 12 priced locations and a combined-order/edit/Undo/receipt journey; no fallback or page errors occurred. The engine property suite runs 1,000 generated sequences of up to 50 events with seed `20260912`. These checks are evidence, not formal proof or an accuracy benchmark. The user reported successful microphone operation on the preceding demo release; that does not establish recognition accuracy for every campus item.

The campus catalog uses published snapshot prices. Some linked PDFs are marked F25/S26; current register prices, stock, serving hours, tax and meal-plan discounts are not verified. Unpriced/conflicting entries, starting prices and unresolved required choices are omitted. Campus add-ons are unsupported until their validity and prices are verified. A directory row does not mean that location can accept a simulated cart item.

API 2 / menu `cmu-published-2026-09-12`; Node 22.23.2 with exact npm dependencies, deployed on Vercel. The active server configuration uses verified `gemini-3.6-flash`; 2.5 Flash generation was unavailable for the configured key. Limits remain five lines, ten units, quantities 1–5, eight operations and 1,500 transcript characters. Server/client deadlines are 15/17 seconds, with no automatic network retry. State lives in browser memory; replay is not persistence or a tamper-proof ledger. Browser validation is prototype correctness, not a production security boundary.
