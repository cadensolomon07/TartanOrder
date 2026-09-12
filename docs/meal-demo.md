# Build my meal and dietary requirements

This script passed on the final local production build with real Gemini text interpretation. [Meal evidence](meal-goal.md) distinguishes that result from publication, automated fixtures and a human microphone trial.

## Budget demonstration

1. Choose **Demo Counter · fictional recipes** in the separate fictional-demo group. This uses sample prices and fictional ingredient/preparation fixtures, not CMU food facts.
2. Type, or press **Talk** and say: “I have twelve dollars. Get me a main, a side, and a drink. Keep the fries and lemonade.” Press **Stop — I’m done** after speaking.
3. The accepted meal should be grilled cheese, fries and lemonade, **$12.00**. Show the menu-budget/component chips and the two kept choices.
4. Say: “Actually, make it a chicken sandwich.” The accepted meal should remain **$12.00**, with a separate **$14.00** proposal. No budget is raised automatically.
5. Choose **Keep current $12.00 order**, or say “Increase my budget to fourteen dollars” to accept the displayed calculated alternative. The latter produces chicken, fries and lemonade at **$14.00**.
6. **Undo** restores the prior meal and its $12 budget. Otherwise use **Review order**, inspect the complete snapshot, then **Confirm simulated order**. Nothing is purchased or sent.

Manual recovery: turn on **Build my meal**, set **Maximum menu subtotal** to 12 and apply it. Select fries and lemonade with **Choose for meal**, then lock each. Use the chicken card to request the conflicting replacement and the displayed buttons to decide. Ordinary ordering remains available by explicitly leaving meal mode.

Budgets apply to the menu subtotal only. Tax, fees, meal-plan discounts and current register prices are not calculated. Changing counter while a meal is active asks whether to leave meal mode; dietary requirements persist until explicitly changed or New order.

## Dietary demonstrations

Use **New order** between examples so restrictions do not carry between fictional customers.

- Say “I’m vegan.” Supported fictional matches move first; excluded/uncertain items remain inspectable. Request grilled cheese: it contains fictional dairy ingredients, so the cart stays unchanged pending an explicit preference decision. A preference exception is limited to the displayed item/configuration and named preferences/dislikes; it never waives an allergy.
- Say “I have a sesame allergy. Add a burger.” The fictional burger's declared sesame bun prevents addition. Show the staff summary. It contacts nobody and provides no automatic safety override.
- Enter “nuts” as an allergy. The restriction stays unresolved until peanuts, tree nuts, or both are explicitly selected; the app does not guess.
- Select a real campus counter while a restriction is active. The catalog's published names/prices do not establish complete ingredient or preparation evidence, so uncertain items are not recommended as compatible. Campus cards now show marks inferred from the published wording: a detected meat or allergen is a conflict, while the absence of a mark still reads **Needs verification**.
- Add an ordinary grilled cheese first, then select **Vegan**. The existing cart stays visible but is flagged and cannot be confirmed. Remove or explicitly repair the conflict. Declaring an allergy does not get undone by ordinary cart Undo.

A fictional vegan wrap plus fries and water can satisfy a $12 menu budget. An extra-cheese customization introduces a dairy conflict. Food evidence includes an unknown-preparation example; a lack of a listed allergen is never described as a safety guarantee.

## Explain the implementation honestly

Gemini converts language into proposed item edits, explicit requirement changes, or a choice ID. Our code stores the requirements, checks configured ingredients/evidence, enumerates meal combinations, calculates cents and differences, and requires an explicit current decision before relaxing a budget/lock/preference. The existing engine owns atomic edits, Undo, stale-response rejection, immutable review and idempotent simulated receipts. Replay reconstructs structured decisions without calling Gemini or live speech.

The reliable offline path is **Engineering → Local only**, manual requirement controls, menu cards, current decision buttons, review and simulated confirmation. Narrow rules support simple declarations and exact menu requests; complex conversational meal requests require Gemini. A new microphone trial is a human check, separate from fixture speech tests and real typed-provider evidence.

Dietary details remain in the browser session and are excluded from routine server telemetry. **New order** clears the previous profile/conversation. An explicitly downloaded audit contains requirements; do not share it unintentionally. Shared test evidence uses labelled fictional cases, not a customer's medical information.
