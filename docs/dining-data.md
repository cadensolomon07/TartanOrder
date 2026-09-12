# Campus dining data

The campus catalog contains **410 published configurations from 12 locations**, alongside a **45-location directory snapshot checked September 12, 2026**. The directory and priced catalog have different coverage: a directory listing does not mean an orderable item was verified there. TartanOrder remains a simulation with no purchase, payment, POS, or kitchen dispatch.

The [ScottyLabs dining API](https://api.cmueats.com/v2/locations), maintained in [ScottyLabs/dining-api](https://github.com/ScottyLabs/dining-api), supplies location metadata and menu links. Prices were transcribed from the linked CMU-hosted PDFs and checked against rendered pages. The directory response itself does not provide item prices. At the snapshot, 14 of 45 rows had menu links: 13 PDF links and one Schatz web menu; 31 rows had no menu link. Schatz returned HTTP 403 during research. Capital Grains supplied a readable PDF, but its starting-price heading did not establish exact item prices, so it contributes no orderable variants.

[src/contracts/campus.ts](../src/contracts/campus.ts) is the canonical released data. `DINING_SNAPSHOT` identifies the source and snapshot date; `DINING_LOCATIONS` records each concept ID, menu/detail links, location, and downloaded PDF SHA-256 where available; `CAMPUS_ITEMS` records integer-cent prices and one-based PDF page numbers. Item IDs retain the source concept ID. Display names are shortened for the kiosk. The three working extraction files—`stackd-items.json`, `coffee-items.json`, and `food-items.json`—were research inputs, not runtime dependencies or alternative production catalogs.

| Location | Concept ID | Configurations |
| --- | --- | ---: |
| Stack'd Underground | 188 | 52 |
| Stack'd Dessert Bar | 190 | 10 |
| Millie's Coffee 'n' Creamery | 136 | 24 |
| La Prima — Rohr Café | 115 | 68 |
| La Prima Espresso — Wean | 94 | 50 |
| Redhawk Coffee | 186 | 13 |
| Maggie Murph Café by De Fer | 204 | 55 |
| Taste of India | 114 | 8 |
| El Gallo de Oro | 91 | 14 |
| The Exchange | 92 | 35 |
| Salem's Hot Bar | 201 | 24 |
| The Grill at Scotty's | 109 | 57 |

Configurations include explicitly priced sizes and explicitly named temperature, filling, or sauce choices. Those variants are counted separately; 410 is not a count of unique recipes. Only standard published configurations are represented. Paid additions, discounts, or substitutions were not used to calculate new prices. Generic build-your-own items and unexplained mandatory choices were omitted, as were unpriced items, unspecified rotating selections, and unresolved price conflicts.

Specific omissions include Millie's 12 oz drip coffee ($3.25 on one page, $3.50 on another), Redhawk's slash-separated drink prices without size labels, Capital Grains' “starting at” bowls, the Exchange's conflicting Gatorade prices and unresolved daypart variants, and meals requiring unidentified sides or rotating entrees. Salem's and Scotty's link identical PDFs: only the named hot-bar portions map to Salem's, while the selected lunch/dinner grill items map to Scotty's. They are not treated as interchangeable counters.

These are **published snapshot prices**, not live register verification. F25 and S26 filenames can describe older menus even when the link is still active. Current stock, opening hours, serving periods, tax, discounts, meal-plan eligibility, and checkout totals have not been verified. The application does not calculate or claim them. Source dietary labels and ingredient descriptions do not establish an allergy guarantee.

To check the sources after installing the pinned Node 22 runtime and running `npm ci`:

```sh
npm run dining:check
```

The equivalent direct command is `node scripts/check-dining.mjs`. It imports `campus.ts` using Node 22's native TypeScript support, so there is no duplicate baseline or source-text parsing. A harmless Node module-type warning may appear on stderr because the application package does not declare an ESM type; the JSON report is written to stdout.

The check validates the public directory's minimal shape with Zod, compares concept IDs and menu/detail links, and downloads linked PDFs with at most two simultaneous requests, a 15-second deadline per request, and a 32 MiB PDF limit. It makes no authenticated or model requests, performs no retry, writes no files, and never edits the catalog. Curated display names are not compared. Non-PDF menu pages remain explicitly unchecked and need manual review.

The report lists added/missing directory rows, changed links, unchanged/changed/unbaselined PDF hashes, and failed downloads. Exit status `0` means the compared sources matched, `1` means changes need review, and `2` means a requested check failed. An unchanged hash only establishes unchanged bytes; a changed hash does not prove a price changed. Neither outcome establishes current availability or current register prices.

Live verification at **2026-09-12 07:33 UTC** returned 45 directory rows, 14 menu links, zero added/missing/changed directory links, and 13 matching PDF hashes with no failed downloads; the Schatz web menu remained unchecked. The command exited `0`. Focused script lint and Node syntax checks also passed.

For an update, inspect changed sources visually and resolve their sizes, choices, and prices before editing the canonical catalog. Preserve provenance, update the snapshot/hash/page records, and bump `MENU_VERSION` when the orderable catalog changes. Update affected fixtures and run the relevant contract, parser, engine, and interface checks before release. Missing links or a failed source check must not silently delete or reprice the released catalog.
