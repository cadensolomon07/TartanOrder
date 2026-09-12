# TartanOrder demo · reversible meals and dietary requirements

This prototype creates simulated orders only: no payment, purchase or restaurant dispatch. Gemini interprets requests; deterministic code owns prices, compatibility, meal selection, ambiguity, Undo and confirmation. The eleven selected campus venues retain 237 priced configurations across eight venues and 50 unavailable previews. A separate **Demo Counter · fictional recipes** supplies the complete, clearly fictional recipes used below.

**Choose the verified build:** this milestone is API 2 / `cmu-meal-2026-09-12`. Before demonstrating https://tartan-order.vercel.app, verify that its `/api/health` reports this menu version and consult [the release handoff](integration.md) for the executed public result. Use the prebuilt local production page at http://127.0.0.1:3000 as the fallback. Do not present an older public page as this milestone.

## Finding the controls in the new kiosk

On desktop, **Your food requirements** is in the left sidebar, below the category buttons and before **Order from** and the location details. The main column starts immediately with the menu; the accepted cart and active requirement summary remain on the right. On narrow screens these sections stack, and the cart's **Edit requirements** link jumps to the existing controls. A pending decision appears first in the requirements panel. The microphone icon visibly changes to **Stop — I’m done** while listening; **Submit** also accepts dietary declarations and corrections.

## Two-to-three-minute meal and dietary demonstration

1. Select **Demo Counter · fictional recipes** under Order from. Explain: “These recipes and prices are fictional; the campus menu snapshots remain separate.” Keep Local only off for Gemini and show the actual parser badge. Type, or use Talk followed by **Stop — I’m done**: **“I have twelve dollars. Get me a main, a side, and a drink. Keep the fries and lemonade.”** Expect Grilled Cheese + Fries + Lemonade, **$12.00**, with the budget, required parts and locked items visible.
2. Say/type **“Actually, make it a chicken sandwich.”** The accepted cart stays **$12.00**. The separate, unapplied proposal lists Chicken Sandwich + Fries + Lemonade for **$14.00**, a **$2.00 increase**. Point out that nothing was silently removed or repriced.
3. Choose **Increase menu budget to $14.00**, or say/type **“Yes, increase the budget to fourteen dollars.”** The accepted cart becomes $14. Click **Undo** to restore the accepted $12 meal and requirements. Review every item and total; explicitly confirm the simulated receipt. New input would invalidate that review.
4. Start **New order**, select the fictional Demo Counter, and set **Dietary preference → Vegan**. Enable **Build my meal**, enter a **$12** menu budget and keep Main + Side + Drink. Expect Veggie Wrap + Fries + Water for **$12.00**. Inspect the excluded choices. Adding extra cheese to the wrap must ask for an explicit preference choice rather than silently changing the active preference. An allergy could not be waived this way.
5. Start **New order** and add **sesame** under Food allergy. The fictional Burger is a declared conflict. Choose Stack’d Underground: campus items become **Needs verification**, with no automatic matches, because complete ingredient and preparation evidence is missing. Open the staff summary: it contacts nobody and cannot certify safety. Conclude with the distinction between verified menu prices and verified dietary evidence. Stack’d cards carry inferred marks (“Contains: milk, wheat”, “from menu wording”); a detected allergen conflicts, an undetected one is still unverified.

Typing any budget/allergy/dislike change cancels a current review immediately. Apply/Add commits the intended change; **Discard this draft** releases it without restoring review. Switching to ordinary text or microphone input clears the abandoned requirement draft. Budget means **menu subtotal**, excluding tax, fees and meal-plan exchanges. Ordinary cart Undo retains the current dietary profile and rechecks restored items; New order clears it.

## Campus and wait example, if time remains

At **Stack’d Underground**, order **one Nashville sandwich, southern-style fried chicken**: $9.20 and a clearly **simulated 14-minute** wait. With no conflicting requirements, the offered Grill at Scotty’s fried-chicken sandwich is $9.99 / **simulated 4 minutes**, 79 cents more. Read its food differences before accepting; the published recipes/portions are not promised identical. Existing dietary, meal and lock constraints still apply. Adding Stack’d Fresh Cut Fries before the swap leaves the whole-cart estimate at 14 minutes because that vendor remains. Waits are fixed seeded examples, not measured queues or walking/pickup estimates.

For sourced menu breadth, Tahini's **Falafel Pita** is $9.95 and Revolution Noodle's **Steamed Pork Bao Bun** is $4.19. Au Bon Pain's preview items have no verified printed prices and cannot be added. The venue order is the user's shortlist, not a measured popularity ranking. [Dining sources](dining-data.md) document old snapshots and unresolved configurations.

## Evidence and recovery

The milestone passed **697 default tests / 29 opt-in skipped**, typecheck, lint and production build. The earlier full browser pass had 30 checks; the final relevant seven checks and an additional offline manual meal/dietary receipt check passed. Real Gemini checks passed **nine direct adapter cases** and **seven local browser requests with nine checkpoints**, with no fallback/page errors. Those inputs were synthetic typed or supplied transcripts, not a new human microphone trial. Previous human microphone success is historical and does not establish recognition accuracy for this milestone.

Deliberate live checks are opt-in: `npm run test:meal:live` exercises the real browser/HTTP/Gemini meal and dietary journey against the rebuilt local app; `MEAL_APP_URL` can target a verified deployment. The direct adapter test requires `RUN_REQUIREMENTS_LIVE=1`. Ordinary `npm test` skips live provider tests. Reports omit personal profiles/transcripts and live outside Git in the sibling `work/` directory. Do not rerun provider checks during the presentation merely to refresh a badge.

If voice fails, type. If the network/provider fails, use **Engineering → Local only**, then the manual requirement controls/menu buttons or simple rules-supported text. Campus local rules accept one exact menu item and quantity per input plus basic edits. The prebuilt local server supports the manual meal/dietary journey without HTTP; do not rebuild during the demonstration. Keep a fresh review and explicit confirmation. [Runbook](runbook.md) has recovery details.

Requirements and conversation are held in session memory. Export only through an explicit local download; exported logs contain food requirements and transcripts and must not be shared unintentionally. Reload/reset is not recoverable through importing into the live cart. Previous recordings are historical; no new meal/dietary microphone recording is claimed. Never present recorded, fixture or rules output as live Gemini.

## Special requests on individual items

At the Demo Counter, say or type: “A water with extra ice and fries with extra salt.” Each request appears beneath its own cart item. Use **Add note** or **Edit note** on a cart row for other wording; **Save note** applies it, **Cancel** discards the draft, and saving empty text clears the note. Undo restores the previous accepted note.

Review shows each note before confirmation and reads it back as a special request. The simulated receipt retains it. Notes do not confirm that the counter can fulfill a request or waive an extra charge; listed customizations such as a double burger still use their menu price. Dietary restrictions stay separate and are not overridden by note text.

Offline, use the row editor, or explicit local wording such as “water with extra ice,” “fries, note: extra sauce if available,” and “add note to my fries: put in a separate bag.” Local wording is intentionally narrower than Gemini. Nothing is sent to a counter.
