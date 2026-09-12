# TartanOrder demo · ordering and simulated preparation waits

Open https://tartan-order.vercel.app in Google Chrome using the release identified in the integration report. Campus items use published menu prices; the separate Demo Counter uses sample prices. Every ticket is simulated. Keep a prebuilt local production tab ready using [the runbook](runbook.md). Do not overwrite an existing `.env.local`.

Online is the default. **Local only** in the engineering panel deliberately skips HTTP and selects the simpler local rules parser. Old saved browser preferences do not change the default. The parser badge reports the last response's actual mode; `none` means no response yet. A badge or mocked test alone is not proof of a real Gemini call. Check the integration report for real-provider evidence on the release being shown.

## Before presenting

- Use the exact deployed revision that passed the release checks. Run the human microphone trial below on this laptop, browser and network.
- Check that **Read replies aloud** works at a comfortable volume. It can be switched off; the complete response and review remain visible.
- Close the engineering panel for the customer demonstration. Know how to open it and select **Local only** if the provider fails.
- Say the current mode aloud: “Gemini with browser speech recognition,” “typed Gemini,” “local rules,” or “recorded local rules.” Announce any switch.

## Live script

For this original 2 minute 45 second ordering script, select **Demo Counter — sample prices** in **Order from** first. The campus wait demonstration below uses actual configured campus entries instead.

| Time | Action and words | Expected result |
|---|---|---|
| 0:00 | “This campus counter understands corrections and asks before it guesses. This is our demo menu; nothing is purchased.” | Empty cart, eleven menu items in mains, sides and drinks. |
| 0:12 | Talk: “Hi I would like to order a burger and um also some fries and a lemonade too, actually wait can you make it a double burger with no lettuce.” Press **Stop — I’m done**. | One double burger with no lettuce, one fries, one lemonade. Three lines, **$16.00**. The complete heard text and an accurate response appear. |
| 0:42 | Talk: “Actually make that two lemonades and put the lettuce back on the burger.” Stop. | Same three lines; burger stays double, No lettuce disappears, lemonade quantity becomes two. **$18.50**. |
| 1:05 | Add another burger from the menu, then Talk: “Remove the burger.” Stop. | A specific choice appears; neither burger disappears yet. Answer “the second one” or tap the second choice. |
| 1:25 | Press **Undo**. “That change is reversible.” | The selected burger returns. |
| 1:35 | **New order**, then type: “Can I get a pizza, a burger, and a lemonade?” | Burger and lemonade, **$10.50**. The reply explains pizza is unavailable. No pizza line. |
| 2:00 | Press **Review order**. Let the snapshot read-back finish. | Every item, quantity, modifier and total are visible. No ticket exists yet. |
| 2:20 | Press **Confirm simulated order**. | One simulated ticket matching the reviewed snapshot. |
| 2:30 | “Gemini proposes menu edits. The application checks the whole accepted batch, owns prices and undo, and requires this explicit confirmation.” | Optionally open the audit panel, then finish. |

Provider timing varies. If the slot is tight, drop the second fresh order; preserve correction, ambiguity and explicit confirmation.

## Wait recommendation milestone · about 60 seconds

Say: **“These are simulated preparation waits, not measured queues or guaranteed pickup times. The food and published prices come from campus menus.”** `WAIT_TIME_MODE=seeded` is the default. The fixed session snapshot is `config/wait-times.seed.json`; deterministic equivalence and nearby-counter choices are in `config/equivalents.json`. The inspected ScottyLabs directory contains no wait fields. API mode has no verified live wait source and must show unavailable estimates.

1. Press **New order** and select **Stack'd Underground** in **Order from**. Type **“one Nashville Sandwich - Southern-style Fried Chicken”** and submit to exercise the current parser, or click that exact menu card for the deterministic button demonstration. Verify the actual parser badge if typing. The item ID is `cmu_188_nashville_sandwich_southern_style_fried_chicken`: **$9.20**, simulated preparation wait **14 min**.
2. Read the offer for **Fried Chicken Sandwich at The Grill at Scotty's** (`cmu_109_fried-chicken-sandwich`): **$9.99**, simulated wait **4 min**, **$0.79 more** for one. The original has coleslaw, pickles and comeback sauce on a potato bun; the alternative's published menu does not specify toppings, bread or portion. The offer must disclose that the recipe may differ. These are curated alternatives, not a promise of identical food or allergy compatibility.
3. Press **Switch to The Grill at Scotty's**. The same cart line should change item and vendor together, total **$9.99**, complete estimated preparation wait **4 min**. The choice is explicit; nothing is sent to either counter. Press **Undo** to demonstrate restoration to **$9.20 / 14 min**, or continue directly to **Review order → Confirm simulated order** and check the switched item, vendor, price and estimate in the simulated ticket.

The offer and ordinary acknowledgment share one spoken reply when **Read replies aloud** is enabled. Pressing Talk or beginning a typed draft dismisses the offer immediately. **Keep it** leaves the cart unchanged. A dismissed offer cannot be accepted with its old action, and should not reappear for that same line.

For the multi-item example, start a new Stack'd order and add **Fresh Cut Fries** first (`cmu_188_fresh_cut_fries`, **$3.45**), then the same **$9.20** Nashville sandwich. The initial total is **$12.65**. Accepting the sandwich switch makes the total **$13.44**, but the complete estimate stays **14 min** because the fries still have Stack'd's simulated 14-minute wait. The sandwich itself drops **14 → 4 min**; the offer must explicitly avoid claiming the whole order is faster. The estimate is the **maximum vendor wait**, assumes parallel preparation, and excludes walking and pickup travel.

A second curated example is a **12 oz Latte** from **La Prima — Rohr Café** (`cmu_115_la-prima-rohr-latte-12-oz`) to **La Prima Espresso — Wean** (`cmu_94_la-prima-wean-latte-12-oz`): both published at **$5.00**, simulated waits **14 → 4 min**. The counter changes; the listed drink and size match. Other vendors have unknown seeded waits, so adding one of their items makes the complete estimate unavailable, not zero.

## Human microphone trial — still required

Automated recognition and speech-output tests use mocks. They do **not** establish microphone accuracy, audible playback, or a successful spoken Gemini journey. On the final deployment, do these five short checks and report the actual heard text without correcting it:

1. **Long request:** allow microphone access, speak the exact long sentence above at normal speed, then press Stop. Check that the entire correction appears in Heard and that exactly one double/no-lettuce burger remains. One capture should create one parse response. Note the response's parser mode.
2. **Across turns:** speak the two-lemonades/lettuce-restored correction. Check **$18.50** and the same three cart lines. The assistant must describe the actual change.
3. **Clarification:** add another burger, ask to remove the burger, then answer the follow-up naturally. Check that only the selected line is removed. Undo should restore it.
4. **Cancel and Stop:** begin a request and cancel it; its later words must never reach the cart. Start another request, speak a full sentence and press Stop once. It must submit once or show a recoverable failure, never reopen the microphone. Also start a capture, press New order, and verify the fresh cart remains empty.
5. **Speech and review:** review an order, then press Talk while its read-back is playing. Read-back must stop before recording. Confirm must disappear as soon as input starts. Cancel, review again, and explicitly confirm. No self-echo may appear in Heard.

Record browser/OS, release SHA, quiet or noisy room, raw transcript, actual parser mode, expected/actual cart, duplicate submissions, time from Stop to reply, and whether the reply was audible. Repeat the long request once with nearby conversation. Report failures honestly; switch to typing if capture is unreliable. `/demo/mic-check.html` is an optional raw browser diagnostic, separate from this kiosk trial.

## Recovery during the demo

- **Speech failed or denied:** type the same request. Typed input uses the same online interpretation path.
- **Gemini/network unavailable:** select **Local only** and announce the switch. Use simple requests such as “a burger, fries and lemonade,” then menu controls for complex corrections. The rules parser has narrower language support.
- **Input stuck:** use the capture's **Cancel**, a typed draft's **Discard**, or the parsing row's **Cancel**. They release different input stages. A cancelled review stays cancelled; review again after input ends.
- **Site unavailable:** use the already running local production tab with Local only selected. An existing loaded page supports local typed ordering without HTTP; reloading the hosted site while offline is not guaranteed.
- **Presentation fallback:** generate and inspect the [real typed Gemini backup](../public/demo/README.md#real-typed-gemini-backup-explicit-opt-in) after live acceptance. The current public V2 release was recorded successfully: `test-results/demo-recording/tartanorder-gemini.webm`, 149.92 seconds, five actual Gemini responses, no fallback and no page errors. Playback was visually inspected. It is silent; narrate the final receipt hold to explain deterministic validation, Undo and explicit confirmation. Keep “RECORDED DEMO — not live” visible and say it is recorded. A separate clearly labelled local-rules recording is also available. Existing screenshots may show older revisions.

Orders live in memory. Export the audit before reload or New order if evidence is needed. An export is a record for inspection, not a live-cart recovery file. See [runbook.md](runbook.md) for production recovery and rollback.
