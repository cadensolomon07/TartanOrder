# Campus dining data

The public kiosk shows **eleven locations in the user's requested order**, with **237 priced configurations across eight locations** and **50 unavailable menu previews**. This order is a requested shortlist, not a measured popularity ranking. TartanOrder remains a simulation with no purchase, payment, POS call, or kitchen dispatch.

The complete source archive retains **45 dining-directory entries and 495 campus configurations**. Of those configurations, 258 belong to locations outside the public shortlist and remain only for historical provenance and internal regression/replay fixtures. Archived locations and the seeded Demo Counter are not selectable or orderable through the public controller. The archive does not imply that any location is currently open or operating.

## Public catalog and provenance

The canonical released data is the active catalog version in the Supabase project TartanOrder: version `cmu-shortlist-2026-09-12`, seeded on September 12, 2026 with 506 items (495 campus configurations plus the 11 internal Demo Counter items), 46 locations (45 directory rows plus the internal Demo Counter; the eleven public venues carry `active_rank` 1–11 in the requested order), 50 unavailable previews and 7 modifiers. The application loads that version at request time and reports it in `/api/health`; published rows cannot be updated or deleted, so a correction is a new version. [src/contracts/campus.ts](../src/contracts/campus.ts) is the generator input for that seed and the labelled `CATALOG_SOURCE=bundled` fallback, not a runtime data source: `ACTIVE_LOCATION_IDS` and `ACTIVE_DINING_LOCATIONS` define the public order, `ACTIVE_CAMPUS_ITEMS` selects priced configurations from `CAMPUS_ITEMS`, and `UNPRICED_MENU_ITEMS` contains disabled previews, including eight Hunan entrees whose published base prices are known but whose complete side configurations are unresolved.

The [ScottyLabs dining API](https://api.cmueats.com/v2/locations), maintained in [ScottyLabs/dining-api](https://github.com/ScottyLabs/dining-api), supplies directory metadata and some menu links. It does not supply item prices. Each stored directory row preserves `directoryMenuUrl`, the actual API link or null at the baseline. Its separate `menuUrl` identifies the menu source used by this catalog. These can differ: supplied CMU-hosted PDFs may be reachable even when the current directory has no menu link. `sourceSha256`, source notes and per-item PDF page numbers retain provenance; prices are integer cents.

| Public location | ID | Priced configurations | Unavailable previews | Menu source |
| --- | --- | ---: | ---: | --- |
| Hunan Express | 110 | 27 | 8 | Supplied CMU-hosted PDF; not directory-linked |
| The Exchange | 92 | 35 | 0 | Directory-linked CMU PDF |
| Revolution Noodle | 174 | 21 | 0 | Supplied CMU-hosted 2025–26 PDF; not directory-linked |
| Tahini | 82 | 25 | 0 | Supplied CMU-hosted PDF; not directory-linked |
| Stack'd Underground | 188 | 52 | 0 | Directory-linked CMU PDF |
| Capital Grains | 179 | 0 | 6 | Directory-linked CMU PDF; complete item prices unresolved |
| Au Bon Pain at Skibo Café | 113 | 0 | 30 | Supplied CMU-hosted PDF; no item prices printed |
| Taste of India | 114 | 8 | 0 | Directory-linked CMU PDF |
| Wild Blue Sushi — Ruge Atrium | 155 | 12 | 0 | Supplied CMU-hosted 2025–26 PDF; not directory-linked |
| The Grill at Scotty's | 109 | 57 | 0 | Directory-linked CMU PDF |
| Schatz Dining Room | 108 | 0 | 6 | Directory-linked web menu; entry prices unverified |
| **Total** | | **237** | **50** | |

All 50 previews are informational and disabled, with no ADD action. Forty-two have no verified price and display “Price unavailable.” The eight Hunan entree previews show the verified PDF base price followed by “Ordering unavailable”; that price is not used to invent a complete order. Unknown prices never become zero. Source links remain available for review.

Configurations count explicitly priced sizes, temperatures, flavors, fillings, sauces or bread choices separately; 237 does not mean 237 unique recipes. The consolidation added 85 configurations from Hunan, Tahini, Revolution Noodle and Wild Blue to the previously reviewed archive. Image-only PDFs were rendered and inspected visually; lack of extractable text does not by itself make their printed prices unverified. Off-campus delivery prices and the pasted Oakland Stack'd proxy prices were not imported.

## Required choices and source limitations

Hunan's [supplied menu](https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/110/Hunan%20Visix%20(7).pdf) states that entrees come with one side. A separate side list gives individual prices, but it does not explicitly establish which sides are included at the cash entree price or whether upgrades apply. The eight entrees therefore remain previews rather than fabricated entree-and-side combinations. Its meal-block lunch/dinner box is not treated as cash combo pricing or current meal-plan eligibility. The 27 orderable configurations are seven standalone sides, three named smoothie flavors, bottled water, and sixteen named tea flavors at their base prices with no added bubbles. Paid bubble additions, unspecified extra meat, dessert, and specialty bottled varieties remain unresolved.

Tahini's [supplied menu](https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/82/Tahini_22x28-final-web2.pdf) explicitly offers pita or a gluten-free wrap for sandwiches and hummus bowls. The catalog represents those choices as separate labeled configurations at the printed category price; it never silently selects bread. Sharing platters requiring an unidentified eligible side remain unavailable. Published generic names such as seasonal fruit or chips retain their limited descriptions; no specific fruit variety, chip flavor or package size is invented. Naming a gluten-free wrap or reproducing a dietary term does not establish an allergy guarantee.

Fresh research on September 12, 2026 found no menu link in either Hunan's or Tahini's current concept-page HTML or live directory row, although both supplied PDF URLs returned valid documents. PDF creation metadata is February 3, 2023 for Hunan and August 25, 2022 for Tahini; this is provenance, not an effective-price date. Tahini's printed operating hours differ substantially from the current concept page, and its PDF rice bowls differ from the current description's mention of couscous. The app labels these sources as older published snapshots and does not import their hours or assert that recipes are current.

Capital Grains' starting-price heading does not resolve a complete configured bowl. Au Bon Pain's source supplies item names without prices. Schatz returned HTTP 403 during earlier menu research and has no verified entry price in the catalog; its station previews do not create orderable meals or meal-plan entitlements. Other unresolved mandatory choices, unexplained price conflicts and unpriced add-ons remain unavailable.

The inactive archive still contains earlier observations such as Millie's conflicting 12 oz drip-coffee prices, Redhawk's unlabeled slash-separated drink sizes, and Salem's/Scotty's shared PDF. Preserving these historical sources does not add them back to the public kiosk. Salem's hot-bar portions and Scotty's grill items are not treated as interchangeable counters.

These are **published snapshot prices**, not current register verification. Current stock, opening hours, serving periods, tax, discounts, meal-plan eligibility, portions and checkout totals are not verified. The application does not calculate or claim them. Source dietary labels and ingredient descriptions do not establish an allergy guarantee. See [wait-data.md](wait-data.md) for the separately labeled seeded wait-time demonstration.

## Read-only source check

After installing the pinned Node 22 runtime and running `npm ci`:

```sh
npm run dining:check
```

The equivalent direct command is `node scripts/check-dining.mjs`. It imports `campus.ts` using Node 22's native TypeScript support, with no duplicate catalog or source-text parsing. A harmless Node module-type warning may appear on stderr; the JSON report is written to stdout.

The checker performs two independent comparisons. It validates the current API directory with Zod and compares all 45 stored concept IDs, `directoryMenuUrl` values and detail links. The intentional public shortlist does not count as deleted directory rows. It then checks only the eleven active `menuUrl` sources: ten PDFs, including the five supplied CMU-hosted documents, plus the Schatz web menu which remains explicitly unchecked and needs manual review. Inactive menu PDFs are outside this run's scope.

PDF downloads use at most two simultaneous requests, a 15-second deadline per request and a 32 MiB limit. The checker makes no authenticated or model requests, performs no retry, writes no files itself, and never edits the catalog. Output identifies each source as `directory-linked` or `supplied-cmu-hosted`, preserves both link fields, and reports active/archived configuration counts and unavailable-preview counts. Curated display names are not compared.

Exit status `0` means compared sources matched, `1` means changes need review, and `2` means a requested check failed. Added/missing directory rows, changed links, unbaselined/changed PDF hashes and failed downloads are reported separately. An unchanged hash establishes unchanged bytes only; a changed hash does not prove a price changed. Neither establishes current availability, current register prices, source freshness or measured popularity.

With `.env.local` configured, `npm run db:verify` reads the deployed catalog through the publishable key and exits `1` unless it finds exactly one active version, 46 locations, 7 modifiers, 506 items and 50 previews, and zero visible rows in each order table.

Historical verification at **2026-09-12 07:33 UTC**, before the eleven-location consolidation, returned 45 directory rows, 14 menu links, zero added/missing/changed directory links and 13 matching PDF hashes with no failed downloads. That earlier command exited `0`; its scope included the then-current directory-linked PDFs and left Schatz's web menu unchecked. It is historical evidence for the earlier catalog, not a check of the subsequently supplied documents.

Consolidated verification at **2026-09-12T15:57:37.774Z** exited `0`: 45 directory rows, 14 live menu links, eleven active menu sources (five supplied), ten matching PDF hashes, and zero directory changes or failed checks. The output confirmed 237 active priced configurations, 258 archived configurations, and 50 unavailable previews, including eight with known base prices. Schatz remained the one unchecked web menu. The report was saved outside the source tree as `work/consolidation-source-check.json`; focused checker lint and Node syntax checks passed.

For updates, inspect changed sources visually and resolve sizes, required choices and prices before editing the generator input in `campus.ts` or `menu.ts`. Preserve the live-directory baseline separately from supplied menu provenance and record PDF hashes/pages. Then give the release a **new** version id in `BUNDLED_VERSION_ID` (`src/catalog/bundled.ts`), regenerate `supabase/seed.sql` with `npm run db:seed:sql`, apply it with `npm run db:seed:apply`, which inserts the new version's rows idempotently and activates it, and confirm with `npm run db:verify`. Never edit or delete rows of a published version: the database trigger refuses, and a live cart, review or replay must keep the prices it was recorded with. Run the relevant contract, parser, engine and interface checks before release. A missing link or failed source check must not silently delete or reprice the catalog, reactivate archived locations, or turn unavailable previews into orderable items.
