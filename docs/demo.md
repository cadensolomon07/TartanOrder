# TartanOrder demo · about 2 minutes 45 seconds

Open https://tartan-order.vercel.app in Google Chrome. The menu is a seeded demonstration; every ticket is simulated. Keep a prebuilt local production tab ready using [the runbook](runbook.md). Do not overwrite an existing `.env.local`.

Online is the default. **Local only** in the engineering panel deliberately skips HTTP and selects the simpler local rules parser. Old saved browser preferences do not change the default. The parser badge reports the last response's actual mode; `none` means no response yet. A badge or mocked test alone is not proof of a real Gemini call. Check the integration report for real-provider evidence on the release being shown.

## Before presenting

- Use the exact deployed revision that passed the release checks. Run the human microphone trial below on this laptop, browser and network.
- Check that **Read replies aloud** works at a comfortable volume. It can be switched off; the complete response and review remain visible.
- Close the engineering panel for the customer demonstration. Know how to open it and select **Local only** if the provider fails.
- Say the current mode aloud: “Gemini with browser speech recognition,” “typed Gemini,” “local rules,” or “recorded local rules.” Announce any switch.

## Live script

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
- **Presentation fallback:** generate and inspect the [real typed Gemini backup](../public/demo/README.md#real-typed-gemini-backup-explicit-opt-in) after live acceptance. Its named output is `test-results/demo-recording/tartanorder-gemini.webm`; the workflow alone is not an existing recording. Keep “RECORDED DEMO — not live” visible and say it is recorded. A separate clearly labelled local-rules recording is also available. Existing screenshots may show older revisions.

Orders live in memory. Export the audit before reload or New order if evidence is needed. An export is a record for inspection, not a live-cart recovery file. See [runbook.md](runbook.md) for production recovery and rollback.
