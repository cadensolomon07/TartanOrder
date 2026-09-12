# TartanOrder demo · selected campus menus and simulated waits

This is a simulated ordering prototype: no purchase, payment or restaurant dispatch. Gemini interprets typed/browser-speech transcripts; deterministic code owns menu validation, prices, quantity limits, ambiguity, Undo, wait alternatives and confirmation. The customer sees only the requested eleven venues. Published menu snapshots provide237 complete priced choices across8 venues; unavailable previews never become zero-price cart entries.

## Two-to-three-minute current demo

1. Refresh https://tartan-order.vercel.app. Keep **Stack’d Underground** selected. Leave Local only off for real Gemini; check the actual response badge.
2. Press Talk and say **“I’d like one Nashville sandwich, southern-style fried chicken, please.”** Press Stop when finished. Typing the same sentence is the recovery path. Expect the precise sandwich `cmu_188_nashville_sandwich_southern_style_fried_chicken`, **$9.20**, with a clearly simulated **14-minute** preparation wait.
3. Read the alternative’s food differences. Click **Switch to The Grill at Scotty’s** for `cmu_109_fried-chicken-sandwich`: **$9.99 /4minutes**, **79cents more**. Scotty’s published recipe/portion is unspecified, so the app does not promise identical food. Nothing is sent to either counter.
4. Say **“Actually, make that two.”** The replacement row becomes two at **$19.98**. Click Undo to return to **$9.99**. Review the venue/item/quantity/total, then explicitly confirm the simulated receipt. Explain that new input would invalidate the review.
5. Start a new order and select **Tahini**. Say **“One falafel pita.”** Expect `cmu_82_falafel_pita`, **$9.95**. Select **Revolution Noodle** and order **“One steamed pork bao bun.”** Expect `cmu_174_steamed-pork-bao-bun`, **$4.19**. This demonstrates different sourced menus while cart items retain their own vendor and price.
6. Select **Au Bon Pain** to show its menu preview. Prices were not printed in its verified PDF, so those items cannot be added. Say that the prototype uses published prices where available, not invented checkout totals.

For the multi-item wait example, select Stack’d and add **Fresh Cut Fries** (`cmu_188_fresh_cut_fries`, $3.45) before the Nashville sandwich. Accepting the sandwich swap changes **$12.65→$13.44**, but the complete preparation estimate stays **14minutes**, because the fries remain at Stack’d. The maximum vendor wait assumes parallel preparation and excludes walking/pickup travel. Starting any input or pressing Keep it dismisses an offer; Undo restores the prior cart and estimate. No coffee-counter offer remains after consolidation.

## Honest evidence and recovery

Wait values are fixed **simulated** data (`WAIT_TIME_MODE=seeded`), never measured queues. The inspected dining API has no verified wait feed. Menu prices are CMU-hosted snapshots; older files and unverified current register prices are disclosed. The requested venue order is a user-selected shortlist, not a verified numeric popularity ranking. Full source coverage/omissions are in [dining-data.md](dining-data.md).

Automated voice events are mocks. Prior human microphone success was reported by the user; real typed Gemini runs establish interpretation/transaction behavior, not microphone accuracy. Deliberate live checks: `npm run test:campus:live` (one item per priced active venue plus cart journey) and `npm run test:waits:live` (offer/accept/context edit/receipt). Both require real Gemini and write dated evidence; ordinary CI does not make provider calls.

If voice fails, type. If the provider/network fails, enable **Engineering → Local only**, then enter one exact menu item and quantity per input or use menu buttons. The prebuilt local server at http://127.0.0.1:3000 supports this without a network once loaded. Do not rebuild during a demonstration. New order resets; keep confirmation explicit. See [runbook.md](runbook.md).

Previous Demo Counter recordings and screenshots are historical; they do not represent the current shortlist. The current `record:demo` recipes use campus menus and label recording/parser mode. Never present a recorded or rules-mode run as live Gemini.
