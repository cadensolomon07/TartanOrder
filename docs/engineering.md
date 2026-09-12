# TartanOrder — engineering overview

TartanOrder is a campus-food prototype built around a reversible transaction. A parser proposes edits; a deterministic engine validates the entire edit. Explicit confirmation of the current review creates a **simulated receipt**. There is no payment, purchase, POS connection or kitchen dispatch.

## Architecture

One Next.js App Router app uses React, TypeScript, ordinary CSS and strict Zod schemas. Local development and CI pin Node 22.23.2 and exact npm dependencies; Vercel is the deployment target. The kiosk uses browser speech recognition or typed input, a request controller, a server-side Gemini interpreter and a pure order engine.

`Speech transcript / typed input → controller → real Gemini → validated proposal → pure engine → accepted response → review → explicit confirmation`

Online interpretation is the default. Real local generation is verified with **`gemini-3.6-flash`**; Gemini 2.5 Flash generation was unavailable for the configured key. The server supplies the authoritative menu, stable cart line IDs, bounded recent conversation and pending clarification. Gemini returns operations, unavailable-item notices, a question or a pending-choice resolution. The controller describes successful changes only after engine acceptance. Local rules remain an explicitly labelled recovery path.

The controller owns capture, cancellation and request identity. New input invalidates review while retaining bounded clarification context for an answer. Capture and parsing block confirmation. The engine receives IDs/events as data, with no network, clock or random operations. Prices and valid options come solely from the shared menu; Gemini cannot invent prices or confirm an order.

## Guarantees exercised by tests

| Boundary | Behavior checked |
| --- | --- |
| Atomic edits | Validate all proposed operations on a temporary cart. Independent unavailable items are notices, never invalid cart operations; invalid accepted-operation batches still reject in full. |
| Ambiguity | Every ADD creates a separate line. Repeated matches produce targeted choices; a conversational answer resolves the chosen batch with revalidation. Open questions can ask for intent without inventing edit choices. |
| Undo and requests | Undo restores cart and referent while revision/audit advance. Cancelled, stale, duplicate and mismatched responses cannot change the order. |
| Confirmation | Review copies every line, modifier, quantity and total. Exact ID/revision and idle input are required; repeated confirmation returns one receipt. Committed orders cannot be edited. |
| Replay | V2 session/audit events reconstruct a detached view without recognition, API calls or live confirmation. Late cancelled responses leave exported bytes unchanged. V1 logs are not silently migrated. |

## Evidence available to judges

The V2 candidate passed fresh installation (zero reported dependency vulnerabilities), typecheck, lint, production build, **472 default tests** and **19/19 Playwright tests**. Eighteen optional checks skipped without opt-in settings. The browser HTTP 503 fallback test observed a mocked failure; it is recovery evidence, not live-provider evidence. The engine checks **1,000 generated sequences of up to 50 events, seed `20260912`**. These tests are evidence, not formal proof.

The [local real-Gemini run](../evals/runs/live-app-gemini-2026-09-12T06-14-45-051Z.json) passed **9/9 scenarios using 14 sequential HTTP requests**, all HTTP 200 with `parser="gemini"` and no fallback. It exercised the exact long order ($16.00), correction across turns ($18.50), mixed pizza/available items ($10.50), ambiguity and natural resolution, new menu options, invalid quantities/options, conditional replacement and three unused correction phrasings. The controller applied results and produced accurate responses; review/receipt and detached replay were also checked. No automatic retries were used.

Those were synthetic typed utterances through real HTTP and Gemini, not human microphone trials or an accuracy benchmark. A fresh Chromium context with browser networking disabled also completed Local only ordering on the prebuilt local production server: $13.50 receipt, zero interpret HTTP requests and zero page errors. This was browser-offline simulation; the physical Wi-Fi-off check in the [runbook](runbook.md) is historical V1 evidence. Neither establishes that V2 is deployed.

## Current limits and integration status

API **2**, menu **`demo-v2`**: eleven demonstration items across mains, sides and drinks, with item-specific options; pizza remains unavailable. Prices are illustrative, not official CMU prices. Bounds remain five lines, ten units, quantities 1–5 and eight operations. Input allows 1,500 characters; context holds up to eight 1,000-character turns; HTTP bodies are capped at 32,768 bytes. Server/client deadlines are 15/17 seconds. State lives in browser memory; replay is neither persistence nor a tamper-proof ledger. Browser validation establishes prototype correctness, not production security.

**Release status:** the V2 conversational candidate is verified locally and awaits production deployment/fresh-browser verification. The final C evaluation delta has passed targeted checks and is reviewed. Human microphone success is still unverified. Voice lifecycle tests use mocks, and speech recognition is browser/service dependent. No voice accuracy, generalization rate or model-comparison performance is claimed. Fixture tests remain labelled `fixture`.
