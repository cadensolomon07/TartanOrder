# Wait-time demonstration data

Waits in this prototype are **seeded demonstration values, not measured queues or predictions**. The app still makes no purchase or dispatch. Published menu prices and the seeded wait fixture are different data sources.

The server loads `WAIT_TIME_MODE=seeded` by default. `config/wait-times.seed.json` is a fixed snapshot with ID `seeded-waits-shortlist-v1` and `asOf=2026-09-12T14:00:00.000Z`. Stack'd Underground (188) has a demonstration wait of 14 minutes; The Grill at Scotty's (109) has 4 minutes. The removed coffee counters have unknown values and cannot be recommended. Every other vendor, including the Demo Counter, is `null` (unknown), never zero. This timestamp identifies a fixture; it is not a queue observation or a claim that any counter is open. The UI must retain the seeded label.

`SeededWaitTimes.getSnapshot()` validates the fixed file and gives each caller a separate copy. `loadWaitConfiguration()` runs in the server page bootstrap, reads the server-only mode, and validates the entire configuration before handing it to the client. `evaluatedAt` is sampled outside the pure engine. A live session uses its recorded snapshot; parser calls and replay do not fetch or refresh waits.

## Verified API limitation

On September 12, 2026, the documented [live location endpoint](https://api.cmueats.com/v2/locations) returned 45 locations. Its fields were `id`, `name`, `shortDescription`, `description`, `url`, `menu`, `location`, `coordinateLat`, `coordinateLng`, `acceptsOnlineOrders`, `times`, `conceptId`, ratings, soups, specials, and report count. There were no wait-time, queue-length, crowding, or preparation-time fields. The [live OpenAPI document](https://api.cmueats.com/openapi/json) likewise exposed location, review, report, and identity routes; it did not define a wait-time endpoint or field. The [ScottyLabs repository](https://github.com/ScottyLabs/dining-api) describes a location-data API and links its upstream mirror.

`WAIT_TIME_MODE=api` uses `DiningApiWaitTimes`. It checks only the documented location endpoint once, with a 2-second deadline covering response reading and a 256 KiB body limit. A valid directory response produces an all-`null`, `source='api'` snapshot and the explicit reason that this API does not publish wait times. A failed, oversized, malformed, or timed-out response also produces unknown waits and an explanatory unavailable state. No seeded values substitute for API failures. Unknown fields named like waits are ignored until a real, documented schema is integrated. There is no invented wait endpoint, polling, automatic retry, queue prediction, or freshness claim. The API snapshot's `asOf` records the directory check, not a queue measurement; no swap is offered from unavailable API data.

## Curated comparisons

`config/equivalents.json` contains one explicit sandwich group after the eleven-venue consolidation. These are potentially comparable purchases, not identical recipes or allergy guarantees. The engine also checks the recorded permitted-venue policy, selected source line, current prices, modifiers, nearby vendor pair, and wait difference. The configured maximum price difference is 100 cents and minimum wait improvement is 5 minutes. Travel time is not included in the seeded wait savings.

| Group | Published source item | Published alternative | Difference |
| --- | --- | --- | --- |
| Southern fried-chicken sandwich | Stack'd Nashville Sandwich — Southern-style Fried Chicken, $9.20 | The Grill at Scotty's Fried Chicken Sandwich, $9.99 | 79¢ more per unit; recipes and portion may differ |

The sandwich IDs are `cmu_188_nashville_sandwich_southern_style_fried_chicken` and `cmu_109_fried-chicken-sandwich`. Stack'd's [published menu, page 1](https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/188/Menu%20Boards%20wNew%20Items.pdf) lists southern-style fried chicken, coleslaw, pickles, comeback sauce, and a potato bun. Scotty's [published menu, page 5](https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/109/SM%20Full%20S26.pdf) lists a $9.99 fried-chicken sandwich without specifying toppings, bread, or portion. Those limitations appear in the alternative's difference description.

The previous release also tested a latte pair, now removed from active recommendations with the excluded coffee counters. Its archived latte IDs are `cmu_115_la-prima-rohr-latte-12-oz` and `cmu_94_la-prima-wean-latte-12-oz`. Their prices and sizes come from the CMU-hosted [Gates menu](https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/115/LP%20Full%20F25.pdf) and [Wean menu](https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/94/LP%20Wean%20Full%20F25.pdf). The canonical catalog retains source page and PDF hash provenance; this configuration never supplies or overrides prices.

Nearby eligibility is deliberately curated, not inferred by a model. The verified directory coordinates place Stack'd at `(40.44532597670513, -79.94331579056744)` and Scotty's at `(40.44426593979831, -79.9389700251861)`, approximately 386 metres apart in a straight line. Gates `(40.44347617300122, -79.94480928001676)` and Wean `(40.442669, -79.945686)` are approximately 116 metres apart. These are approximate Haversine distances from published coordinates, not walking distances, accessibility routes, building-entry guidance, or travel times. Opening hours, current stock, portion equivalence, and current register prices remain unverified; see [dining-data.md](dining-data.md).

## Verification and updates

Run `npm test -- tests/waits/providers.test.ts` for mocked provider boundaries and curated configuration checks. These tests make no real queue observations. They cover immutable seeded snapshots, unknown versus zero, no invented API values, no retries, malformed/oversized responses, whole-request timeout, and fail-closed mode selection.

To change the demo, edit the fixed seed file and give a changed scenario a new snapshot ID. To add an equivalent, verify both canonical items, price difference, recipe/size differences and location pair from primary sources before editing the group. A future real wait integration needs a documented endpoint, value units, observation timestamp and explicit freshness policy. Validate that adapter and preserve source/as-of information before enabling offers; never rename seeded values as API data.
