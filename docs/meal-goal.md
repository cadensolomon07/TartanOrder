# Meal and dietary milestone

This milestone adds an optional menu-subtotal budget and persistent dietary requirements to the existing simulated order. The eleven selected campus restaurants remain; a separate fictional Demo Counter provides the complete recipe/customization example requested for this milestone. Nothing is purchased or sent to a kitchen.

## Implementation boundary

Gemini interprets the customer's explicit requirements and choices. Strict shared schemas describe requirement changes; Gemini supplies no authoritative prices, nutritional judgments, ingredient evidence, cheapest claims or permission to waive a requirement. The application stores accepted requirements independently of conversation history.

A pure solver enumerates combinations at the selected counter for the requested components. Valid requirements rank first, then preservation of the accepted meal, then integer-cent subtotal and stable item IDs. Feasible results use the existing atomic engine. An infeasible proposal keeps the accepted cart/meal and presents a calculated decision with at most two choices. A larger budget does not repair unavailable ingredients or missing evidence.

The same evidence-based compatibility function serves menu browsing, solving, edits, customizations, swaps and final review. Preferences, dislikes and allergies remain separate. Exact preference exceptions do not waive allergies or future restrictions. Unknown ingredients/preparation stay unknown. Fictional recipes and preparation are explicitly distinguished from campus data. The on-page staff summary contacts nobody and cannot certify safety.

## Required completion evidence

The milestone is incomplete until each group below has implementation and executed evidence recorded.

- Solver: exact and below-budget solutions; budget below minimum; impossible locked selections; exhaustive independently known fixture; stable ties; preservation; missing components; supported modifiers; no silent relaxation.
- Transactions: $12 meal, $14 requested chicken correction, explicit keep/raise choices (click and interpreted answer), stale/duplicate decisions, manual requirement violations, locks, accepted cart retained, requirement/cart Undo, current allergy retained through Undo, reset and replay.
- Dietary checks: vegan menu filtering, known dairy conflict, declared allergen before addition, incomplete ingredient/preparation evidence, modifier introducing a conflict, restrictions added to existing carts, compatible solver or concrete failure, ordinary manual and interpreted ordering, unresolved/custom allergens, scoped preference exceptions and staff summary.
- Controller: capture/input invalidates review/decisions, cancellation and late responses, context passes accepted state/proposals, counter/meal-mode changes require explicit resolution, reset clears prior profile and conversation, no overlapping speech.
- UI: optional mode, manual budget/components and dietary controls, readable editable chips, accepted/proposed separation, calculated subtotal/remainder, inspectable exclusions/uncertainty, current review and explicit simulated receipt.
- Privacy: no customer profile/text/identifiers in routine server telemetry. Synthetic fixture/provider test data clearly labelled. Export is an explicit local user action; no automatic sharing of dietary details.
- Integration: current typecheck, lint, focused/full tests, production build, ordinary ordering and relevant browser tests, real Gemini varied phrasings and public end-to-end meal/conflict/decision/receipt. Human microphone results remain separate.
- Handoff: deployed link, exact demo script, provenance/limitations, and recovery instructions. Preserve target submission September 12 at 3:15 p.m. EDT and official cutoff 4 p.m.

## Executed candidate evidence — September 12, 12:54 p.m. EDT

The implementation covers each group above. This evidence is separate from the preceding 607-test/26-browser menu release:

| Requirement group | Implementation and executed checks |
| --- | --- |
| Exhaustive calculation | `src/core/meal.ts`; seven `tests/core/meal.test.ts` cases, including eight independently enumerated combinations with literal expected totals, exact/below/impossible budgets, locks, preservation and deterministic configuration ties. |
| Atomic requirements and dietary lifecycle | `src/core/engine.ts`; 15 `tests/core/meal-lifecycle.test.ts` cases cover accepted/proposed separation, explicit decisions, manual violations, quantities, Undo/current profile, reset, stale choices, abandoned-input continuation and replay. |
| Shared food evidence | `src/contracts/food.ts`, `src/core/compatibility.ts`; seven compatibility cases plus engine/UI coverage for declared allergens, extra-cheese conflicts, ambiguous/custom allergens, scoped exceptions and unknown campus/preparation data. |
| Controller and strict boundaries | Eight `tests/requirements/controller.test.ts` cases and five `tests/requirements/contracts.test.ts` cases cover capture, cancellation, context, review, choice renewal, retired-item boundaries and telemetry redaction. |
| Interface and offline recovery | Nine requirements UI cases, six catalog UI cases, desktop/390px visual inspection, and browser journeys for budget decisions, later dietary restrictions, draft invalidation and an offline manual vegan meal through review/receipt with zero interpret requests. |

Typecheck, lint and the production build passed. The full default suite passed **697 tests**, with **29 opt-in network/recording checks skipped**. The existing property suite still runs 1,000 generated sequences of up to 50 events, seed `20260912`; it is engine regression evidence, not new dietary property coverage or formal proof. The full browser suite passed 30 checks; after final input/layout/quantity corrections, seven relevant checks passed, followed by the newly added offline meal check. CI will run the resulting 31-check suite on publication.

Real provider evidence uses synthetic typed requests: **9/9 direct Gemini adapter cases**, then **7/7 real requests and 9/9 browser checkpoints** on the final local production build, without retries, fallback or page errors. The latter completed the $12 meal → unchanged accepted cart with $14 proposal → explicit interpreted approval → review → $14 simulated receipt, plus known preference/allergy conflicts and unknown-allergen handling. The initial browser harness run failed a text-comparison assertion; it remains recorded separately and is not counted as success. The corrected harness and final run are reproducible with `npm run test:meal:live` against a prepared local server.

Raw customer profiles, transcripts and model responses are not saved in these routine reports. Local synthetic reports are in the sibling `work/` directory (`meal-provider-evidence.json` and `meal-browser-2026-09-12T16-50-09-336Z.json`). A fresh public run and CI/deployment identity are recorded separately after publication; these local results do not establish deployment or human microphone success. Presenter and recovery instructions are in [meal-demo.md](meal-demo.md).
