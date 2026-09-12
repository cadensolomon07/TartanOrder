// Published facts transcribed from CMU-hosted menus linked by ScottyLabs.
// See docs/dining-data.md. Update prices only after source review and bump MENU_VERSION.
// Public shortlist in the user's requested order, minus the venues whose published
// menus carry no complete prices (Capital Grains 179, Au Bon Pain 113, Schatz 108 were
// removed on 2026-09-12; their rows and previews stay archived below). Other snapshot
// entries are retained only for internal regression fixtures and price provenance.
export const ACTIVE_LOCATION_IDS = ["110", "92", "174", "82", "188", "114", "155", "109"] as const;
export const DINING_SNAPSHOT = {
  "checkedAt": "2026-09-12",
  "directoryUrl": "https://api.cmueats.com/v2/locations",
  "sourceRepository": "https://github.com/ScottyLabs/dining-api"
} as const;

export const DINING_LOCATIONS = [
  {
    "id": "113",
    "name": "Au Bon Pain At Skibo Café",
    "location": "Cohon Center, Second floor",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/113",
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc",
    "directoryMenuUrl": null,
    "sourceNote": "Older CMU-hosted menu; current counter prices are unverified."
  },
  {
    "id": "210",
    "name": "Baroque Toast - Rohr Commons",
    "location": "Tepper Building, 1st Floor",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/210",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "179",
    "name": "Capital Grains",
    "location": "Tepper Building, 2nd Floor, Rohr Commons Eatery",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/179/Capital Grains Menu F25.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/179",
    "sourceSha256": "8831f0672b1202be58aaa5eb131eeae30bb73d23131820376cc8b42f0dd300d6",
    "directoryMenuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/179/Capital Grains Menu F25.pdf"
  },
  {
    "id": "184",
    "name": "Ciao Bella",
    "location": "Cohon Center, 2nd Floor Marketplace",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/184",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "193",
    "name": "Crisp And Crust",
    "location": "Cohon Center, Marketplace, 2nd floor",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/193",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "95",
    "name": "De Fer Coffee & Tea @ Resnik",
    "location": "Resnik House, DeFer",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/95",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "134",
    "name": "E.A.T. (Evenings At Tepper) - Rohr Commons",
    "location": "Tepper Building, 2nd Floor",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/134",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "91",
    "name": "El Gallo de Oro",
    "location": "Cohon Center, Ground Floor",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/91/EG Full F25.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/91",
    "sourceSha256": "13073a41aa062f682003d00ca9ab2415adae6b9e950984a79473b81d56485681",
    "directoryMenuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/91/EG Full F25.pdf"
  },
  {
    "id": "103",
    "name": "Entropy+",
    "location": "Cohon Center, Ground Floor",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/103",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "202",
    "name": "Fire And Stone",
    "location": "Resnik House, Resnik House",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/202",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "173",
    "name": "Forbes Avenue Subs - Rohr Commons",
    "location": "Tepper Building, 2nd Floor",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/173",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "110",
    "name": "Hunan Express",
    "location": "Newell-Simon Atrium",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/110/Hunan%20Visix%20(7).pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/110",
    "sourceSha256": "4bf1831be09d95e45026bb0f4dbcae32b6fb1779b617b3c0eec988f454431202",
    "directoryMenuUrl": null,
    "sourceNote": "Older CMU-hosted menu; current counter prices are unverified."
  },
  {
    "id": "206",
    "name": "K-Station At Tartan Express Food Truck",
    "location": "Legacy Plaza, LEGACY PLAZA",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/206",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "115",
    "name": "La Prima - Rohr Café",
    "location": "Gates Hillman Centers, Third floor",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/115/LP Full F25.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/115",
    "sourceSha256": "a7c4a76a37d3b66c833a975b4a1cec8f725f9bbee6b0e9122bf6fa833598aa00",
    "directoryMenuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/115/LP Full F25.pdf"
  },
  {
    "id": "94",
    "name": "La Prima Espresso - Wean",
    "location": "Wean Hall, 5th Floor",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/94/LP Wean Full F25.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/94",
    "sourceSha256": "01f0ad0bf8f5ced768b60dfec52602c596c53e0f570486a50a3315188cff875a",
    "directoryMenuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/94/LP Wean Full F25.pdf"
  },
  {
    "id": "204",
    "name": "Maggie Murph Café by De Fer",
    "location": "Hunt Library, Hunt Library",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/204/De Fer Hunt Menu.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/204",
    "sourceSha256": "2922d0cb3e3709b9dd8e514e31f80c21addee96bf0b5ceddd90ca6edb2213061",
    "directoryMenuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/204/De Fer Hunt Menu.pdf"
  },
  {
    "id": "211",
    "name": "Market C At Heinz Cafe",
    "location": "Hamburg Hall, A108",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/211",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "208",
    "name": "Mercato A Mano - Rohr Commons",
    "location": "Tepper Building, 1st Floor",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/208",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "136",
    "name": "Millie's Coffee 'n' Creamery",
    "location": "Tepper Building, Second floor",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/136/MM Full F25.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/136",
    "sourceSha256": "efae560f1792c90fd208a5367620a4b80c9a7ecbc2b4b9367df119b0951df29b",
    "directoryMenuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/136/MM Full F25.pdf"
  },
  {
    "id": "127",
    "name": "Nourish",
    "location": "Cohon Center, Second floor",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/127",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "138",
    "name": "Ola Ola",
    "location": "Cohon Center, Second Floor",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/138",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "207",
    "name": "Parrilla Del Sol",
    "location": "Cohon Center, Cohon University Center",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/207",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "186",
    "name": "Redhawk Coffee",
    "location": "Scaife Hall, First Floor",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/186/RH Full S26.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/186",
    "sourceSha256": "7a14ef8bdb3cfca74eee1d4e08cc3ac4a41d84fc3a904db27efd0bb5e964fc0b",
    "directoryMenuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/186/RH Full S26.pdf"
  },
  {
    "id": "174",
    "name": "Revolution Noodle",
    "location": "Cohon Center, 2nd Floor, Marketplace",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/174/Revolution Noodle Menu 2025-2026.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/174",
    "sourceSha256": "3188d9606ba86488f90445bd71ff7a9f7d90a0358042f965858132eedd79a2f1",
    "directoryMenuUrl": null,
    "sourceNote": "Published 2025–26 menu; current counter prices may differ."
  },
  {
    "id": "201",
    "name": "Salem's Hot Bar",
    "location": "Forbes Beeler Apartments, Scotty's Market",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/201/SM Full S26.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/201",
    "sourceSha256": "0a32cc57586f6b78a3221828828d5e9923b2089c4949a941e8743397c3ef73b0",
    "directoryMenuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/201/SM Full S26.pdf"
  },
  {
    "id": "108",
    "name": "Schatz Dining Room",
    "location": "Cohon Center, Second floor",
    "menuUrl": "https://dineoncampus.com/cmu/whats-on-the-menu/schatz-dining-room/",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/108",
    "sourceSha256": null,
    "directoryMenuUrl": "https://dineoncampus.com/cmu/whats-on-the-menu/schatz-dining-room/"
  },
  {
    "id": "180",
    "name": "Scotty'S Market By Salem'S",
    "location": "Forbes Beeler Apartments, Forbes and Beeler",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/180",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "191",
    "name": "Shake Smart",
    "location": "Highmark Center for Health, Wellness and Athletics",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/191",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "190",
    "name": "Stack'd Dessert Bar",
    "location": "Morewood Gardens, Lower Level",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/190/Dessert (1).pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/190",
    "sourceSha256": "f1f695665023b424c15e212d9655204f10bb3e7fd0dc5ea0b8b9e764a0cbfd60",
    "directoryMenuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/190/Dessert (1).pdf"
  },
  {
    "id": "188",
    "name": "Stack'd Underground",
    "location": "Morewood Gardens, Lower level",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/188/Menu Boards wNew Items.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/188",
    "sourceSha256": "ae3780beaa9296061a752eba88edc4f48676e3c87f6047b7ca967f98eaa74434",
    "directoryMenuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/188/Menu Boards wNew Items.pdf"
  },
  {
    "id": "148",
    "name": "Stephanie'S - Market C",
    "location": "Mellon Institute, Fourth Floor, Room 401",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/148",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "205",
    "name": "Summer Cafe At Marketplace",
    "location": "Cohon Center, Cohon University Center",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/205",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "194",
    "name": "Sweet Plantain",
    "location": "Resnik House, Tartans Pavilion, Tahini space",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/194",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "82",
    "name": "Tahini",
    "location": "Resnik House, Tartans Pavilion",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/82/Tahini_22x28-final-web2.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/82",
    "sourceSha256": "6023976adc6279dd071460ebe0b42284cf49643ebca46573da1cb007a626c5cf",
    "directoryMenuUrl": null,
    "sourceNote": "Older CMU-hosted menu; current counter prices are unverified."
  },
  {
    "id": "168",
    "name": "Tartan Express Food Truck",
    "location": "Legacy Plaza, Legacy Plaza",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/168",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "114",
    "name": "Taste of India",
    "location": "Resnik House, Resnik Servery",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/114/TOI Full S26.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/114",
    "sourceSha256": "44636bcf4a5e1cf5ec0ad62e1fc4bfac2e31196e628eb53a248bddf83233e2e8",
    "directoryMenuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/114/TOI Full S26.pdf"
  },
  {
    "id": "154",
    "name": "Tepper Eatery At Rohr Commons",
    "location": "Tepper Building, 2nd Floor Eatery",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/154",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "185",
    "name": "Tepper Taqueria",
    "location": "Tepper Building, Second Floor",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/185",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "192",
    "name": "Tepper Taqueria Express",
    "location": "Tepper Building, Second Floor",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/192",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "178",
    "name": "The Edge Cafe & Market",
    "location": "Resnik House",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/178",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "92",
    "name": "The Exchange",
    "location": "Posner Hall, 1st Floor",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/92/EX Full S26.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/92",
    "sourceSha256": "3a256a65bf3aeb0db14b3c9770b67de989f0f4ff3e4badafe39accf2b29c54c0",
    "directoryMenuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/92/EX Full S26.pdf"
  },
  {
    "id": "109",
    "name": "The Grill at Scotty's",
    "location": "Forbes Beeler Apartments, Servery",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/109/SM Full S26.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/109",
    "sourceSha256": "0a32cc57586f6b78a3221828828d5e9923b2089c4949a941e8743397c3ef73b0",
    "directoryMenuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/109/SM Full S26.pdf"
  },
  {
    "id": "155",
    "name": "Wild Blue Sushi - Ruge Atrium",
    "location": "Scott Hall, Lower level",
    "menuUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/155/Wild Blue Sushi Menu 2025-2026.pdf",
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/155",
    "sourceSha256": "42a831ab27266e5bea765fab53fe195856729d6c73f5706a46e28496b76efad8",
    "directoryMenuUrl": null,
    "sourceNote": "Published 2025–26 menu; current counter prices may differ."
  },
  {
    "id": "209",
    "name": "Yella'S",
    "location": "Cohon Center, Cohon University Center",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/209",
    "sourceSha256": null,
    "directoryMenuUrl": null
  },
  {
    "id": "84",
    "name": "Zebra Lounge",
    "location": "College of Fine Arts, First Floor",
    "menuUrl": null,
    "detailUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/84",
    "sourceSha256": null,
    "directoryMenuUrl": null
  }
] as const;

export const CAMPUS_ITEMS = [
  {
    "id": "cmu_188_smash_d_burger",
    "locationId": "188",
    "label": "Smash'd Burger",
    "category": "mains",
    "priceCents": 920,
    "description": "Standard published menu item.",
    "aliases": [
      "smashd burger"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_smash_d_bacon_burger",
    "locationId": "188",
    "label": "Smash'd Bacon Burger",
    "category": "mains",
    "priceCents": 1050,
    "description": "Standard published menu item.",
    "aliases": [
      "smashd bacon burger"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_bbq_bacon_burger",
    "locationId": "188",
    "label": "BBQ Bacon Burger",
    "category": "mains",
    "priceCents": 1050,
    "description": "Standard published menu item.",
    "aliases": [
      "bbq bacon burger"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_smash_d_deluxe_burger",
    "locationId": "188",
    "label": "Smash'd Deluxe Burger",
    "category": "mains",
    "priceCents": 1050,
    "description": "Standard published menu item.",
    "aliases": [
      "smashd deluxe burger"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_smash_d_veggie_burger",
    "locationId": "188",
    "label": "Smash'd Veggie Burger",
    "category": "mains",
    "priceCents": 920,
    "description": "Standard published menu item.",
    "aliases": [
      "smashd veggie burger"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_impossible_burger",
    "locationId": "188",
    "label": "Impossible Burger",
    "category": "mains",
    "priceCents": 1050,
    "description": "Standard published menu item.",
    "aliases": [
      "impossible burger"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_korean_bbq_chicken_sandwich",
    "locationId": "188",
    "label": "Korean BBQ Chicken Sandwich",
    "category": "mains",
    "priceCents": 920,
    "description": "Standard published menu item.",
    "aliases": [
      "korean bbq chicken sandwich"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_nashville_sandwich_medium_heat_fried_chicken",
    "locationId": "188",
    "label": "Nashville Sandwich - Medium-heat Fried Chicken",
    "category": "mains",
    "priceCents": 920,
    "description": "Standard published menu item.",
    "aliases": [
      "nashville sandwich mediumheat fried chicken"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_nashville_sandwich_southern_style_fried_chicken",
    "locationId": "188",
    "label": "Nashville Sandwich - Southern-style Fried Chicken",
    "category": "mains",
    "priceCents": 920,
    "description": "Standard published menu item.",
    "aliases": [
      "nashville sandwich southernstyle fried chicken"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_deluxe_chicken_sandwich_grilled_chicken",
    "locationId": "188",
    "label": "Deluxe Chicken Sandwich - Grilled Chicken",
    "category": "mains",
    "priceCents": 1050,
    "description": "Standard published menu item.",
    "aliases": [
      "deluxe chicken sandwich grilled chicken"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_deluxe_chicken_sandwich_southern_style_fried_chicken",
    "locationId": "188",
    "label": "Deluxe Chicken Sandwich - Southern-style Fried Chicken",
    "category": "mains",
    "priceCents": 1050,
    "description": "Standard published menu item.",
    "aliases": [
      "deluxe chicken sandwich southernstyle fried chicken"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_hot_honey_chicken_sandwich_medium_heat_fried_chicken",
    "locationId": "188",
    "label": "Hot Honey Chicken Sandwich - Medium-heat Fried Chicken",
    "category": "mains",
    "priceCents": 1050,
    "description": "Standard published menu item.",
    "aliases": [
      "hot honey chicken sandwich mediumheat fried chicken"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_hot_honey_chicken_sandwich_southern_style_fried_chicken",
    "locationId": "188",
    "label": "Hot Honey Chicken Sandwich - Southern-style Fried Chicken",
    "category": "mains",
    "priceCents": 1050,
    "description": "Standard published menu item.",
    "aliases": [
      "hot honey chicken sandwich southernstyle fried chicken"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_pittsburgh_chicken_salad_grilled_chicken",
    "locationId": "188",
    "label": "Pittsburgh Chicken Salad - Grilled Chicken",
    "category": "mains",
    "priceCents": 1185,
    "description": "Standard published menu item.",
    "aliases": [
      "pittsburgh chicken salad grilled chicken"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_pittsburgh_chicken_salad_southern_style_fried_chicken",
    "locationId": "188",
    "label": "Pittsburgh Chicken Salad - Southern-style Fried Chicken",
    "category": "mains",
    "priceCents": 1185,
    "description": "Standard published menu item.",
    "aliases": [
      "pittsburgh chicken salad southernstyle fried chicken"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_3_piece_chicken_tenders_ranch",
    "locationId": "188",
    "label": "3 Piece Chicken Tenders - Ranch",
    "category": "mains",
    "priceCents": 920,
    "description": "Standard published menu item.",
    "aliases": [
      "3 piece chicken tenders ranch"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_3_piece_chicken_tenders_bbq",
    "locationId": "188",
    "label": "3 Piece Chicken Tenders - BBQ",
    "category": "mains",
    "priceCents": 920,
    "description": "Standard published menu item.",
    "aliases": [
      "3 piece chicken tenders bbq"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_3_piece_chicken_tenders_comeback_sauce",
    "locationId": "188",
    "label": "3 Piece Chicken Tenders - Comeback Sauce",
    "category": "mains",
    "priceCents": 920,
    "description": "Standard published menu item.",
    "aliases": [
      "3 piece chicken tenders comeback sauce"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_3_piece_chicken_tenders_buffalo",
    "locationId": "188",
    "label": "3 Piece Chicken Tenders - Buffalo",
    "category": "mains",
    "priceCents": 920,
    "description": "Standard published menu item.",
    "aliases": [
      "3 piece chicken tenders buffalo"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_3_piece_chicken_tenders_sweet_chili",
    "locationId": "188",
    "label": "3 Piece Chicken Tenders - Sweet Chili",
    "category": "mains",
    "priceCents": 920,
    "description": "Standard published menu item.",
    "aliases": [
      "3 piece chicken tenders sweet chili"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_188_grilled_cheese",
    "locationId": "188",
    "label": "Grilled Cheese",
    "category": "mains",
    "priceCents": 780,
    "description": "Standard published menu item.",
    "aliases": [
      "grilled cheese"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_philly_cheesesteak_grilled_cheese",
    "locationId": "188",
    "label": "Philly Cheesesteak Grilled Cheese",
    "category": "mains",
    "priceCents": 1050,
    "description": "Standard published menu item.",
    "aliases": [
      "philly cheesesteak grilled cheese"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_buffalo_chicken_grilled_cheese",
    "locationId": "188",
    "label": "Buffalo Chicken Grilled Cheese",
    "category": "mains",
    "priceCents": 1050,
    "description": "Standard published menu item.",
    "aliases": [
      "buffalo chicken grilled cheese"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_cali_grilled_cheese",
    "locationId": "188",
    "label": "Cali Grilled Cheese",
    "category": "mains",
    "priceCents": 920,
    "description": "Standard published menu item.",
    "aliases": [
      "cali grilled cheese"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_portobello_mushroom_grilled_cheese",
    "locationId": "188",
    "label": "Portobello Mushroom Grilled Cheese",
    "category": "mains",
    "priceCents": 920,
    "description": "Standard published menu item.",
    "aliases": [
      "portobello mushroom grilled cheese"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_chicken_parmesan_grilled_cheese",
    "locationId": "188",
    "label": "Chicken Parmesan Grilled Cheese",
    "category": "mains",
    "priceCents": 1050,
    "description": "Standard published menu item.",
    "aliases": [
      "chicken parmesan grilled cheese"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_avocado_blt_grilled_cheese",
    "locationId": "188",
    "label": "Avocado BLT Grilled Cheese",
    "category": "mains",
    "priceCents": 1050,
    "description": "Standard published menu item.",
    "aliases": [
      "avocado blt grilled cheese"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_fresh_cut_fries",
    "locationId": "188",
    "label": "Fresh Cut Fries",
    "category": "sides",
    "priceCents": 345,
    "description": "Standard published menu item.",
    "aliases": [
      "fresh cut fries"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_cajun_fries",
    "locationId": "188",
    "label": "Cajun Fries",
    "category": "sides",
    "priceCents": 345,
    "description": "Standard published menu item.",
    "aliases": [
      "cajun fries"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_coleslaw",
    "locationId": "188",
    "label": "Coleslaw",
    "category": "sides",
    "priceCents": 345,
    "description": "Standard published menu item.",
    "aliases": [
      "coleslaw"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_pasta_salad",
    "locationId": "188",
    "label": "Pasta Salad",
    "category": "sides",
    "priceCents": 345,
    "description": "Standard published menu item.",
    "aliases": [
      "pasta salad"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_side_house_salad",
    "locationId": "188",
    "label": "Side House Salad",
    "category": "sides",
    "priceCents": 345,
    "description": "Standard published menu item.",
    "aliases": [
      "side house salad"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_side_caesar_salad",
    "locationId": "188",
    "label": "Side Caesar Salad",
    "category": "sides",
    "priceCents": 345,
    "description": "Standard published menu item.",
    "aliases": [
      "side caesar salad"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_cookies",
    "locationId": "188",
    "label": "Cookies",
    "category": "sides",
    "priceCents": 345,
    "description": "Standard published menu item.",
    "aliases": [
      "cookies"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_fresh_fruit",
    "locationId": "188",
    "label": "Fresh Fruit",
    "category": "sides",
    "priceCents": 435,
    "description": "Standard published menu item.",
    "aliases": [
      "fresh fruit"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_curly_fries",
    "locationId": "188",
    "label": "Curly Fries",
    "category": "sides",
    "priceCents": 435,
    "description": "Standard published menu item.",
    "aliases": [
      "curly fries"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_sweet_potato_fries",
    "locationId": "188",
    "label": "Sweet Potato Fries",
    "category": "sides",
    "priceCents": 435,
    "description": "Standard published menu item.",
    "aliases": [
      "sweet potato fries"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_mozzarella_sticks_6_pieces",
    "locationId": "188",
    "label": "Mozzarella Sticks (6 pieces)",
    "category": "sides",
    "priceCents": 920,
    "description": "Standard published menu item.",
    "aliases": [
      "mozzarella sticks 6 pieces"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_mac_n_cheese_wedges_6_pieces",
    "locationId": "188",
    "label": "Mac N Cheese Wedges (6 pieces)",
    "category": "sides",
    "priceCents": 920,
    "description": "Standard published menu item.",
    "aliases": [
      "mac n cheese wedges 6 pieces"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_chicken_wings_8_pieces_bbq",
    "locationId": "188",
    "label": "Chicken Wings (8 pieces) - BBQ",
    "category": "mains",
    "priceCents": 1249,
    "description": "Standard published menu item.",
    "aliases": [
      "chicken wings 8 pieces bbq"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_chicken_wings_8_pieces_blazin_bbq",
    "locationId": "188",
    "label": "Chicken Wings (8 pieces) - Blazin BBQ",
    "category": "mains",
    "priceCents": 1249,
    "description": "Standard published menu item.",
    "aliases": [
      "chicken wings 8 pieces blazin bbq"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_chicken_wings_8_pieces_buffalo",
    "locationId": "188",
    "label": "Chicken Wings (8 pieces) - Buffalo",
    "category": "mains",
    "priceCents": 1249,
    "description": "Standard published menu item.",
    "aliases": [
      "chicken wings 8 pieces buffalo"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_chicken_wings_8_pieces_buffalo_cajun",
    "locationId": "188",
    "label": "Chicken Wings (8 pieces) - Buffalo Cajun",
    "category": "mains",
    "priceCents": 1249,
    "description": "Standard published menu item.",
    "aliases": [
      "chicken wings 8 pieces buffalo cajun"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_chicken_wings_8_pieces_buffalo_habanero",
    "locationId": "188",
    "label": "Chicken Wings (8 pieces) - Buffalo Habanero",
    "category": "mains",
    "priceCents": 1249,
    "description": "Standard published menu item.",
    "aliases": [
      "chicken wings 8 pieces buffalo habanero"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_chicken_wings_8_pieces_buffalo_ranch",
    "locationId": "188",
    "label": "Chicken Wings (8 pieces) - Buffalo Ranch",
    "category": "mains",
    "priceCents": 1249,
    "description": "Standard published menu item.",
    "aliases": [
      "chicken wings 8 pieces buffalo ranch"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_chicken_wings_8_pieces_cajun",
    "locationId": "188",
    "label": "Chicken Wings (8 pieces) - Cajun",
    "category": "mains",
    "priceCents": 1249,
    "description": "Standard published menu item.",
    "aliases": [
      "chicken wings 8 pieces cajun"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_chicken_wings_8_pieces_garlic_parm",
    "locationId": "188",
    "label": "Chicken Wings (8 pieces) - Garlic Parm",
    "category": "mains",
    "priceCents": 1249,
    "description": "Standard published menu item.",
    "aliases": [
      "chicken wings 8 pieces garlic parm"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_chicken_wings_8_pieces_korean_bbq",
    "locationId": "188",
    "label": "Chicken Wings (8 pieces) - Korean BBQ",
    "category": "mains",
    "priceCents": 1249,
    "description": "Standard published menu item.",
    "aliases": [
      "chicken wings 8 pieces korean bbq"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_chicken_wings_8_pieces_lemon_pepper",
    "locationId": "188",
    "label": "Chicken Wings (8 pieces) - Lemon Pepper",
    "category": "mains",
    "priceCents": 1249,
    "description": "Standard published menu item.",
    "aliases": [
      "chicken wings 8 pieces lemon pepper"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_chicken_wings_8_pieces_old_bay",
    "locationId": "188",
    "label": "Chicken Wings (8 pieces) - Old Bay",
    "category": "mains",
    "priceCents": 1249,
    "description": "Standard published menu item.",
    "aliases": [
      "chicken wings 8 pieces old bay"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_chicken_wings_8_pieces_cranch",
    "locationId": "188",
    "label": "Chicken Wings (8 pieces) - Cranch",
    "category": "mains",
    "priceCents": 1249,
    "description": "Standard published menu item.",
    "aliases": [
      "chicken wings 8 pieces cranch"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_188_chicken_wings_8_pieces_sweet_chili",
    "locationId": "188",
    "label": "Chicken Wings (8 pieces) - Sweet Chili",
    "category": "mains",
    "priceCents": 1249,
    "description": "Standard published menu item.",
    "aliases": [
      "chicken wings 8 pieces sweet chili"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_190_vanilla_milkshake",
    "locationId": "190",
    "label": "Vanilla Milkshake",
    "category": "drinks",
    "priceCents": 755,
    "description": "Standard published menu item.",
    "aliases": [
      "vanilla milkshake"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_190_chocolate_milkshake",
    "locationId": "190",
    "label": "Chocolate Milkshake",
    "category": "drinks",
    "priceCents": 755,
    "description": "Standard published menu item.",
    "aliases": [
      "chocolate milkshake"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_190_strawberry_milkshake",
    "locationId": "190",
    "label": "Strawberry Milkshake",
    "category": "drinks",
    "priceCents": 755,
    "description": "Standard published menu item.",
    "aliases": [
      "strawberry milkshake"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_190_oreo_milkshake",
    "locationId": "190",
    "label": "Oreo Milkshake",
    "category": "drinks",
    "priceCents": 755,
    "description": "Standard published menu item.",
    "aliases": [
      "oreo milkshake"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_190_banana_split_sundae",
    "locationId": "190",
    "label": "Banana Split Sundae",
    "category": "sides",
    "priceCents": 755,
    "description": "Standard published menu item.",
    "aliases": [
      "banana split sundae"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_190_hot_fudge_brownie_sundae",
    "locationId": "190",
    "label": "Hot Fudge Brownie Sundae",
    "category": "sides",
    "priceCents": 755,
    "description": "Standard published menu item.",
    "aliases": [
      "hot fudge brownie sundae"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_190_chocolate_chip_cookie_sundae",
    "locationId": "190",
    "label": "Chocolate Chip Cookie Sundae",
    "category": "sides",
    "priceCents": 755,
    "description": "Standard published menu item.",
    "aliases": [
      "chocolate chip cookie sundae"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_190_root_beer_ice_cream_float",
    "locationId": "190",
    "label": "Root Beer Ice Cream Float",
    "category": "drinks",
    "priceCents": 755,
    "description": "Standard published menu item.",
    "aliases": [
      "root beer ice cream float"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_190_cherry_ice_cream_float",
    "locationId": "190",
    "label": "Cherry Ice Cream Float",
    "category": "drinks",
    "priceCents": 755,
    "description": "Standard published menu item.",
    "aliases": [
      "cherry ice cream float"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_190_orange_ice_cream_float",
    "locationId": "190",
    "label": "Orange Ice Cream Float",
    "category": "drinks",
    "priceCents": 755,
    "description": "Standard published menu item.",
    "aliases": [
      "orange ice cream float"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_136_millies-hot-latte-12-oz",
    "locationId": "136",
    "label": "Hot Latte (12 oz)",
    "category": "drinks",
    "priceCents": 500,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "hot latte 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_136_millies-iced-latte-12-oz",
    "locationId": "136",
    "label": "Iced Latte (12 oz)",
    "category": "drinks",
    "priceCents": 500,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "iced latte 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_136_millies-hot-latte-16-oz",
    "locationId": "136",
    "label": "Hot Latte (16 oz)",
    "category": "drinks",
    "priceCents": 590,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "hot latte 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_136_millies-iced-latte-16-oz",
    "locationId": "136",
    "label": "Iced Latte (16 oz)",
    "category": "drinks",
    "priceCents": 590,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "iced latte 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_136_millies-hot-drip-coffee-16-oz",
    "locationId": "136",
    "label": "Hot Drip Coffee (16 oz)",
    "category": "drinks",
    "priceCents": 400,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "hot drip coffee 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_136_millies-iced-drip-coffee-16-oz",
    "locationId": "136",
    "label": "Iced Drip Coffee (16 oz)",
    "category": "drinks",
    "priceCents": 400,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "iced drip coffee 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_136_millies-draft-cold-brew-12-oz",
    "locationId": "136",
    "label": "Draft Cold Brew (12 oz)",
    "category": "drinks",
    "priceCents": 465,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "draft cold brew 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_136_millies-draft-cold-brew-16-oz",
    "locationId": "136",
    "label": "Draft Cold Brew (16 oz)",
    "category": "drinks",
    "priceCents": 515,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "draft cold brew 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_136_millies-millie-s-cold-brew-shake",
    "locationId": "136",
    "label": "Millie's Cold Brew Shake",
    "category": "drinks",
    "priceCents": 1075,
    "description": "Coffee Break ice cream, cold brew, whipped cream and chocolate chips; size not stated.",
    "aliases": [
      "millies cold brew shake"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_136_millies-espresso",
    "locationId": "136",
    "label": "Espresso",
    "category": "drinks",
    "priceCents": 350,
    "description": "Single listed preparation; size not stated.",
    "aliases": [
      "espresso"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_136_millies-macchiato",
    "locationId": "136",
    "label": "Macchiato",
    "category": "drinks",
    "priceCents": 400,
    "description": "Single listed preparation; size not stated.",
    "aliases": [
      "macchiato"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_136_millies-cortado",
    "locationId": "136",
    "label": "Cortado",
    "category": "drinks",
    "priceCents": 390,
    "description": "Single listed preparation; size not stated.",
    "aliases": [
      "cortado"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_136_millies-cappuccino",
    "locationId": "136",
    "label": "Cappuccino",
    "category": "drinks",
    "priceCents": 450,
    "description": "Single listed preparation; size not stated.",
    "aliases": [
      "cappuccino"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_136_millies-hot-mocha-12-oz",
    "locationId": "136",
    "label": "Hot Mocha (12 oz)",
    "category": "drinks",
    "priceCents": 590,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "hot mocha 12 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_136_millies-iced-mocha-12-oz",
    "locationId": "136",
    "label": "Iced Mocha (12 oz)",
    "category": "drinks",
    "priceCents": 590,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "iced mocha 12 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_136_millies-hot-mocha-16-oz",
    "locationId": "136",
    "label": "Hot Mocha (16 oz)",
    "category": "drinks",
    "priceCents": 680,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "hot mocha 16 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_136_millies-iced-mocha-16-oz",
    "locationId": "136",
    "label": "Iced Mocha (16 oz)",
    "category": "drinks",
    "priceCents": 680,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "iced mocha 16 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_136_millies-hot-americano-12-oz",
    "locationId": "136",
    "label": "Hot Americano (12 oz)",
    "category": "drinks",
    "priceCents": 400,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "hot americano 12 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_136_millies-iced-americano-12-oz",
    "locationId": "136",
    "label": "Iced Americano (12 oz)",
    "category": "drinks",
    "priceCents": 400,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "iced americano 12 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_136_millies-hot-americano-16-oz",
    "locationId": "136",
    "label": "Hot Americano (16 oz)",
    "category": "drinks",
    "priceCents": 450,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "hot americano 16 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_136_millies-iced-americano-16-oz",
    "locationId": "136",
    "label": "Iced Americano (16 oz)",
    "category": "drinks",
    "priceCents": 450,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "iced americano 16 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_136_millies-bottled-water",
    "locationId": "136",
    "label": "Bottled Water",
    "category": "drinks",
    "priceCents": 200,
    "description": "Listed packaged drink; container size not stated.",
    "aliases": [
      "bottled water"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_136_millies-twin-brook-milk",
    "locationId": "136",
    "label": "Twin Brook Milk",
    "category": "drinks",
    "priceCents": 275,
    "description": "Listed packaged drink; container size not stated.",
    "aliases": [
      "twin brook milk"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_136_millies-twin-brook-chocolate-milk",
    "locationId": "136",
    "label": "Twin Brook Chocolate Milk",
    "category": "drinks",
    "priceCents": 275,
    "description": "Listed packaged drink; container size not stated.",
    "aliases": [
      "twin brook chocolate milk"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-espresso-1-oz",
    "locationId": "115",
    "label": "Espresso (1 oz)",
    "category": "drinks",
    "priceCents": 295,
    "description": "1 oz; listed base preparation.",
    "aliases": [
      "espresso 1 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-espresso-2-oz",
    "locationId": "115",
    "label": "Espresso (2 oz)",
    "category": "drinks",
    "priceCents": 375,
    "description": "2 oz; listed base preparation.",
    "aliases": [
      "espresso 2 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-macchiato-2-oz",
    "locationId": "115",
    "label": "Macchiato (2 oz)",
    "category": "drinks",
    "priceCents": 315,
    "description": "2 oz; listed base preparation.",
    "aliases": [
      "macchiato 2 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-macchiato-4-oz",
    "locationId": "115",
    "label": "Macchiato (4 oz)",
    "category": "drinks",
    "priceCents": 400,
    "description": "4 oz; listed base preparation.",
    "aliases": [
      "macchiato 4 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-filter-coffee-8-oz",
    "locationId": "115",
    "label": "Filter Coffee (8 oz)",
    "category": "drinks",
    "priceCents": 230,
    "description": "8 oz; listed base preparation.",
    "aliases": [
      "filter coffee 8 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-filter-coffee-12-oz",
    "locationId": "115",
    "label": "Filter Coffee (12 oz)",
    "category": "drinks",
    "priceCents": 305,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "filter coffee 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-filter-coffee-16-oz",
    "locationId": "115",
    "label": "Filter Coffee (16 oz)",
    "category": "drinks",
    "priceCents": 380,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "filter coffee 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-cappuccino-6-oz",
    "locationId": "115",
    "label": "Cappuccino (6 oz)",
    "category": "drinks",
    "priceCents": 410,
    "description": "6 oz; listed base preparation.",
    "aliases": [
      "cappuccino 6 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-cappuccino-8-oz",
    "locationId": "115",
    "label": "Cappuccino (8 oz)",
    "category": "drinks",
    "priceCents": 425,
    "description": "8 oz; listed base preparation.",
    "aliases": [
      "cappuccino 8 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-cappuccino-12-oz",
    "locationId": "115",
    "label": "Cappuccino (12 oz)",
    "category": "drinks",
    "priceCents": 550,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "cappuccino 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-latte-12-oz",
    "locationId": "115",
    "label": "Latte (12 oz)",
    "category": "drinks",
    "priceCents": 500,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "latte 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-latte-16-oz",
    "locationId": "115",
    "label": "Latte (16 oz)",
    "category": "drinks",
    "priceCents": 620,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "latte 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-americano-8-oz",
    "locationId": "115",
    "label": "Americano (8 oz)",
    "category": "drinks",
    "priceCents": 340,
    "description": "8 oz; listed base preparation.",
    "aliases": [
      "americano 8 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-americano-12-oz",
    "locationId": "115",
    "label": "Americano (12 oz)",
    "category": "drinks",
    "priceCents": 410,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "americano 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-cortado-4-oz",
    "locationId": "115",
    "label": "Cortado (4 oz)",
    "category": "drinks",
    "priceCents": 400,
    "description": "4 oz; listed base preparation.",
    "aliases": [
      "cortado 4 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-cold-brew-20-oz",
    "locationId": "115",
    "label": "Cold Brew (20 oz)",
    "category": "drinks",
    "priceCents": 515,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "cold brew 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-nitro-cold-brew-20-oz",
    "locationId": "115",
    "label": "Nitro Cold Brew (20 oz)",
    "category": "drinks",
    "priceCents": 520,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "nitro cold brew 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-iced-latte-20-oz",
    "locationId": "115",
    "label": "Iced Latte (20 oz)",
    "category": "drinks",
    "priceCents": 675,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "iced latte 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-iced-americano-20-oz",
    "locationId": "115",
    "label": "Iced Americano (20 oz)",
    "category": "drinks",
    "priceCents": 470,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "iced americano 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-iced-chai-latte-20-oz",
    "locationId": "115",
    "label": "Iced Chai Latte (20 oz)",
    "category": "drinks",
    "priceCents": 660,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "iced chai latte 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-iced-matcha-latte-20-oz",
    "locationId": "115",
    "label": "Iced Matcha Latte (20 oz)",
    "category": "drinks",
    "priceCents": 675,
    "description": "20 oz iced drink; matcha is listed as unsweetened.",
    "aliases": [
      "iced matcha latte 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-fresh-brewed-iced-tea-20-oz",
    "locationId": "115",
    "label": "Fresh Brewed Iced Tea (20 oz)",
    "category": "drinks",
    "priceCents": 375,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "fresh brewed iced tea 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-iced-tea-latte-20-oz",
    "locationId": "115",
    "label": "Iced Tea Latte (20 oz)",
    "category": "drinks",
    "priceCents": 450,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "iced tea latte 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-iced-tea-lemonade-20-oz",
    "locationId": "115",
    "label": "Iced Tea Lemonade (20 oz)",
    "category": "drinks",
    "priceCents": 400,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "iced tea lemonade 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-blood-orange-espresso-seltzer-20-oz",
    "locationId": "115",
    "label": "Blood Orange Espresso Seltzer (20 oz)",
    "category": "drinks",
    "priceCents": 430,
    "description": "20 oz; named flavor from the published espresso-seltzer choices.",
    "aliases": [
      "blood orange espresso seltzer 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-lemon-espresso-seltzer-20-oz",
    "locationId": "115",
    "label": "Lemon Espresso Seltzer (20 oz)",
    "category": "drinks",
    "priceCents": 430,
    "description": "20 oz; named flavor from the published espresso-seltzer choices.",
    "aliases": [
      "lemon espresso seltzer 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-strawberry-espresso-seltzer-20-oz",
    "locationId": "115",
    "label": "Strawberry Espresso Seltzer (20 oz)",
    "category": "drinks",
    "priceCents": 430,
    "description": "20 oz; named flavor from the published espresso-seltzer choices.",
    "aliases": [
      "strawberry espresso seltzer 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_115_la-prima-rohr-matcha-latte-8-oz",
    "locationId": "115",
    "label": "Matcha Latte (8 oz)",
    "category": "drinks",
    "priceCents": 365,
    "description": "8 oz; listed base preparation.",
    "aliases": [
      "matcha latte 8 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-matcha-latte-12-oz",
    "locationId": "115",
    "label": "Matcha Latte (12 oz)",
    "category": "drinks",
    "priceCents": 490,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "matcha latte 12 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-matcha-latte-16-oz",
    "locationId": "115",
    "label": "Matcha Latte (16 oz)",
    "category": "drinks",
    "priceCents": 625,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "matcha latte 16 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-chai-tea-latte-8-oz",
    "locationId": "115",
    "label": "Chai Tea Latte (8 oz)",
    "category": "drinks",
    "priceCents": 335,
    "description": "8 oz; listed base preparation.",
    "aliases": [
      "chai tea latte 8 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-chai-tea-latte-12-oz",
    "locationId": "115",
    "label": "Chai Tea Latte (12 oz)",
    "category": "drinks",
    "priceCents": 465,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "chai tea latte 12 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-chai-tea-latte-16-oz",
    "locationId": "115",
    "label": "Chai Tea Latte (16 oz)",
    "category": "drinks",
    "priceCents": 590,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "chai tea latte 16 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-hot-chocolate-8-oz",
    "locationId": "115",
    "label": "Hot Chocolate (8 oz)",
    "category": "drinks",
    "priceCents": 310,
    "description": "8 oz; listed base preparation.",
    "aliases": [
      "hot chocolate 8 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-hot-chocolate-12-oz",
    "locationId": "115",
    "label": "Hot Chocolate (12 oz)",
    "category": "drinks",
    "priceCents": 395,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "hot chocolate 12 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-hot-chocolate-16-oz",
    "locationId": "115",
    "label": "Hot Chocolate (16 oz)",
    "category": "drinks",
    "priceCents": 480,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "hot chocolate 16 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-milk-8-oz",
    "locationId": "115",
    "label": "Milk (8 oz)",
    "category": "drinks",
    "priceCents": 190,
    "description": "8 oz; listed base preparation.",
    "aliases": [
      "milk 8 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-milk-12-oz",
    "locationId": "115",
    "label": "Milk (12 oz)",
    "category": "drinks",
    "priceCents": 240,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "milk 12 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-milk-16-oz",
    "locationId": "115",
    "label": "Milk (16 oz)",
    "category": "drinks",
    "priceCents": 285,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "milk 16 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-coffee-box-96-oz",
    "locationId": "115",
    "label": "Coffee Box (96 oz)",
    "category": "drinks",
    "priceCents": 2550,
    "description": "96 oz coffee box; cups and cream are separately priced and excluded.",
    "aliases": [
      "coffee box 96 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-chocolate-croissant",
    "locationId": "115",
    "label": "Chocolate Croissant",
    "category": "sides",
    "priceCents": 515,
    "description": "Named pastry from the published pastry list.",
    "aliases": [
      "chocolate croissant"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-almond-croissant",
    "locationId": "115",
    "label": "Almond Croissant",
    "category": "sides",
    "priceCents": 515,
    "description": "Named pastry from the published pastry list.",
    "aliases": [
      "almond croissant"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-butter-croissant",
    "locationId": "115",
    "label": "Butter Croissant",
    "category": "sides",
    "priceCents": 515,
    "description": "Named pastry from the published pastry list.",
    "aliases": [
      "butter croissant"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-cheese-pocket-danish",
    "locationId": "115",
    "label": "Cheese Pocket Danish",
    "category": "sides",
    "priceCents": 460,
    "description": "Named pastry from the published pastry list.",
    "aliases": [
      "cheese pocket danish"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-ham-swiss-croissant",
    "locationId": "115",
    "label": "Ham & Swiss Croissant",
    "category": "sides",
    "priceCents": 515,
    "description": "Named pastry from the published pastry list.",
    "aliases": [
      "ham swiss croissant"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-schneider-s-x-la-prima-cold-brew",
    "locationId": "115",
    "label": "Schneider's x La Prima Cold Brew",
    "category": "drinks",
    "priceCents": 430,
    "description": "Named bottled drink; container size not stated.",
    "aliases": [
      "schneiders x la prima cold brew"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-frizz",
    "locationId": "115",
    "label": "Frizz",
    "category": "drinks",
    "priceCents": 430,
    "description": "Named bottled drink; container size not stated.",
    "aliases": [
      "frizz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-san-pellegrino",
    "locationId": "115",
    "label": "San Pellegrino",
    "category": "drinks",
    "priceCents": 305,
    "description": "Named bottled drink; container size not stated.",
    "aliases": [
      "san pellegrino"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-orange-juice",
    "locationId": "115",
    "label": "Orange Juice",
    "category": "drinks",
    "priceCents": 215,
    "description": "Named bottled drink; container size not stated.",
    "aliases": [
      "orange juice"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-bottled-water",
    "locationId": "115",
    "label": "Bottled Water",
    "category": "drinks",
    "priceCents": 215,
    "description": "Named bottled drink; container size not stated.",
    "aliases": [
      "bottled water"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-espresso-1-oz",
    "locationId": "94",
    "label": "Espresso (1 oz)",
    "category": "drinks",
    "priceCents": 295,
    "description": "1 oz; listed base preparation.",
    "aliases": [
      "espresso 1 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-espresso-2-oz",
    "locationId": "94",
    "label": "Espresso (2 oz)",
    "category": "drinks",
    "priceCents": 375,
    "description": "2 oz; listed base preparation.",
    "aliases": [
      "espresso 2 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-macchiato-2-oz",
    "locationId": "94",
    "label": "Macchiato (2 oz)",
    "category": "drinks",
    "priceCents": 315,
    "description": "2 oz; listed base preparation.",
    "aliases": [
      "macchiato 2 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-macchiato-4-oz",
    "locationId": "94",
    "label": "Macchiato (4 oz)",
    "category": "drinks",
    "priceCents": 400,
    "description": "4 oz; listed base preparation.",
    "aliases": [
      "macchiato 4 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-filter-coffee-8-oz",
    "locationId": "94",
    "label": "Filter Coffee (8 oz)",
    "category": "drinks",
    "priceCents": 230,
    "description": "8 oz; listed base preparation.",
    "aliases": [
      "filter coffee 8 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-filter-coffee-12-oz",
    "locationId": "94",
    "label": "Filter Coffee (12 oz)",
    "category": "drinks",
    "priceCents": 305,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "filter coffee 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-filter-coffee-16-oz",
    "locationId": "94",
    "label": "Filter Coffee (16 oz)",
    "category": "drinks",
    "priceCents": 380,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "filter coffee 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-cappuccino-6-oz",
    "locationId": "94",
    "label": "Cappuccino (6 oz)",
    "category": "drinks",
    "priceCents": 410,
    "description": "6 oz; listed base preparation.",
    "aliases": [
      "cappuccino 6 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-cappuccino-8-oz",
    "locationId": "94",
    "label": "Cappuccino (8 oz)",
    "category": "drinks",
    "priceCents": 425,
    "description": "8 oz; listed base preparation.",
    "aliases": [
      "cappuccino 8 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-cappuccino-12-oz",
    "locationId": "94",
    "label": "Cappuccino (12 oz)",
    "category": "drinks",
    "priceCents": 550,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "cappuccino 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-latte-12-oz",
    "locationId": "94",
    "label": "Latte (12 oz)",
    "category": "drinks",
    "priceCents": 500,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "latte 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-latte-16-oz",
    "locationId": "94",
    "label": "Latte (16 oz)",
    "category": "drinks",
    "priceCents": 620,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "latte 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-americano-8-oz",
    "locationId": "94",
    "label": "Americano (8 oz)",
    "category": "drinks",
    "priceCents": 340,
    "description": "8 oz; listed base preparation.",
    "aliases": [
      "americano 8 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-americano-12-oz",
    "locationId": "94",
    "label": "Americano (12 oz)",
    "category": "drinks",
    "priceCents": 410,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "americano 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-cortado-4-oz",
    "locationId": "94",
    "label": "Cortado (4 oz)",
    "category": "drinks",
    "priceCents": 400,
    "description": "4 oz; listed base preparation.",
    "aliases": [
      "cortado 4 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-cold-brew-20-oz",
    "locationId": "94",
    "label": "Cold Brew (20 oz)",
    "category": "drinks",
    "priceCents": 515,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "cold brew 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-nitro-cold-brew-20-oz",
    "locationId": "94",
    "label": "Nitro Cold Brew (20 oz)",
    "category": "drinks",
    "priceCents": 520,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "nitro cold brew 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-iced-latte-20-oz",
    "locationId": "94",
    "label": "Iced Latte (20 oz)",
    "category": "drinks",
    "priceCents": 675,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "iced latte 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-iced-americano-20-oz",
    "locationId": "94",
    "label": "Iced Americano (20 oz)",
    "category": "drinks",
    "priceCents": 470,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "iced americano 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-iced-chai-latte-20-oz",
    "locationId": "94",
    "label": "Iced Chai Latte (20 oz)",
    "category": "drinks",
    "priceCents": 660,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "iced chai latte 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-iced-matcha-latte-20-oz",
    "locationId": "94",
    "label": "Iced Matcha Latte (20 oz)",
    "category": "drinks",
    "priceCents": 675,
    "description": "20 oz iced drink; matcha is listed as unsweetened.",
    "aliases": [
      "iced matcha latte 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-fresh-brewed-iced-tea-20-oz",
    "locationId": "94",
    "label": "Fresh Brewed Iced Tea (20 oz)",
    "category": "drinks",
    "priceCents": 375,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "fresh brewed iced tea 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-iced-tea-latte-20-oz",
    "locationId": "94",
    "label": "Iced Tea Latte (20 oz)",
    "category": "drinks",
    "priceCents": 450,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "iced tea latte 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-iced-tea-lemonade-20-oz",
    "locationId": "94",
    "label": "Iced Tea Lemonade (20 oz)",
    "category": "drinks",
    "priceCents": 400,
    "description": "20 oz iced drink; no paid additions included.",
    "aliases": [
      "iced tea lemonade 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-blood-orange-espresso-seltzer-20-oz",
    "locationId": "94",
    "label": "Blood Orange Espresso Seltzer (20 oz)",
    "category": "drinks",
    "priceCents": 430,
    "description": "20 oz; named flavor from the published espresso-seltzer choices.",
    "aliases": [
      "blood orange espresso seltzer 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-lemon-espresso-seltzer-20-oz",
    "locationId": "94",
    "label": "Lemon Espresso Seltzer (20 oz)",
    "category": "drinks",
    "priceCents": 430,
    "description": "20 oz; named flavor from the published espresso-seltzer choices.",
    "aliases": [
      "lemon espresso seltzer 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-strawberry-espresso-seltzer-20-oz",
    "locationId": "94",
    "label": "Strawberry Espresso Seltzer (20 oz)",
    "category": "drinks",
    "priceCents": 430,
    "description": "20 oz; named flavor from the published espresso-seltzer choices.",
    "aliases": [
      "strawberry espresso seltzer 20 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_94_la-prima-wean-matcha-latte-8-oz",
    "locationId": "94",
    "label": "Matcha Latte (8 oz)",
    "category": "drinks",
    "priceCents": 365,
    "description": "8 oz; listed base preparation.",
    "aliases": [
      "matcha latte 8 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-matcha-latte-12-oz",
    "locationId": "94",
    "label": "Matcha Latte (12 oz)",
    "category": "drinks",
    "priceCents": 490,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "matcha latte 12 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-matcha-latte-16-oz",
    "locationId": "94",
    "label": "Matcha Latte (16 oz)",
    "category": "drinks",
    "priceCents": 625,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "matcha latte 16 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-chai-tea-latte-8-oz",
    "locationId": "94",
    "label": "Chai Tea Latte (8 oz)",
    "category": "drinks",
    "priceCents": 335,
    "description": "8 oz; listed base preparation.",
    "aliases": [
      "chai tea latte 8 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-chai-tea-latte-12-oz",
    "locationId": "94",
    "label": "Chai Tea Latte (12 oz)",
    "category": "drinks",
    "priceCents": 465,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "chai tea latte 12 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-chai-tea-latte-16-oz",
    "locationId": "94",
    "label": "Chai Tea Latte (16 oz)",
    "category": "drinks",
    "priceCents": 590,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "chai tea latte 16 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-hot-chocolate-8-oz",
    "locationId": "94",
    "label": "Hot Chocolate (8 oz)",
    "category": "drinks",
    "priceCents": 310,
    "description": "8 oz; listed base preparation.",
    "aliases": [
      "hot chocolate 8 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-hot-chocolate-12-oz",
    "locationId": "94",
    "label": "Hot Chocolate (12 oz)",
    "category": "drinks",
    "priceCents": 395,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "hot chocolate 12 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-hot-chocolate-16-oz",
    "locationId": "94",
    "label": "Hot Chocolate (16 oz)",
    "category": "drinks",
    "priceCents": 480,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "hot chocolate 16 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-milk-8-oz",
    "locationId": "94",
    "label": "Milk (8 oz)",
    "category": "drinks",
    "priceCents": 190,
    "description": "8 oz; listed base preparation.",
    "aliases": [
      "milk 8 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-milk-12-oz",
    "locationId": "94",
    "label": "Milk (12 oz)",
    "category": "drinks",
    "priceCents": 240,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "milk 12 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-milk-16-oz",
    "locationId": "94",
    "label": "Milk (16 oz)",
    "category": "drinks",
    "priceCents": 285,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "milk 16 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-coffee-box-96-oz",
    "locationId": "94",
    "label": "Coffee Box (96 oz)",
    "category": "drinks",
    "priceCents": 2550,
    "description": "96 oz coffee box; cups and cream are separately priced and excluded.",
    "aliases": [
      "coffee box 96 oz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-chocolate-croissant",
    "locationId": "94",
    "label": "Chocolate Croissant",
    "category": "sides",
    "priceCents": 515,
    "description": "Named pastry from the published pastry list.",
    "aliases": [
      "chocolate croissant"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-almond-croissant",
    "locationId": "94",
    "label": "Almond Croissant",
    "category": "sides",
    "priceCents": 515,
    "description": "Named pastry from the published pastry list.",
    "aliases": [
      "almond croissant"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-butter-croissant",
    "locationId": "94",
    "label": "Butter Croissant",
    "category": "sides",
    "priceCents": 515,
    "description": "Named pastry from the published pastry list.",
    "aliases": [
      "butter croissant"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-cheese-pocket-danish",
    "locationId": "94",
    "label": "Cheese Pocket Danish",
    "category": "sides",
    "priceCents": 460,
    "description": "Named pastry from the published pastry list.",
    "aliases": [
      "cheese pocket danish"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-ham-swiss-croissant",
    "locationId": "94",
    "label": "Ham & Swiss Croissant",
    "category": "sides",
    "priceCents": 515,
    "description": "Named pastry from the published pastry list.",
    "aliases": [
      "ham swiss croissant"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-schneider-s-x-la-prima-cold-brew",
    "locationId": "94",
    "label": "Schneider's x La Prima Cold Brew",
    "category": "drinks",
    "priceCents": 430,
    "description": "Named bottled drink; container size not stated.",
    "aliases": [
      "schneiders x la prima cold brew"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-frizz",
    "locationId": "94",
    "label": "Frizz",
    "category": "drinks",
    "priceCents": 430,
    "description": "Named bottled drink; container size not stated.",
    "aliases": [
      "frizz"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-san-pellegrino",
    "locationId": "94",
    "label": "San Pellegrino",
    "category": "drinks",
    "priceCents": 305,
    "description": "Named bottled drink; container size not stated.",
    "aliases": [
      "san pellegrino"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-orange-juice",
    "locationId": "94",
    "label": "Orange Juice",
    "category": "drinks",
    "priceCents": 215,
    "description": "Named bottled drink; container size not stated.",
    "aliases": [
      "orange juice"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_94_la-prima-wean-bottled-water",
    "locationId": "94",
    "label": "Bottled Water",
    "category": "drinks",
    "priceCents": 215,
    "description": "Named bottled drink; container size not stated.",
    "aliases": [
      "bottled water"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_115_la-prima-rohr-egg-cheese-on-english-muffin",
    "locationId": "115",
    "label": "Egg & Cheese on English Muffin",
    "category": "mains",
    "priceCents": 595,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "egg cheese on english muffin"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-turkey-bacon-pepperjack-egg-on-english-muffin",
    "locationId": "115",
    "label": "Turkey Bacon, Pepperjack & Egg on English Muffin",
    "category": "mains",
    "priceCents": 825,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "turkey bacon pepperjack egg on english muffin"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-sausage-egg-cheese-on-english-muffin",
    "locationId": "115",
    "label": "Sausage, Egg & Cheese on English Muffin",
    "category": "mains",
    "priceCents": 705,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "sausage egg cheese on english muffin"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-potato-egg-cheese-burrito",
    "locationId": "115",
    "label": "Potato, Egg & Cheese Burrito",
    "category": "mains",
    "priceCents": 930,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "potato egg cheese burrito"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-bacon-potato-egg-cheese-burrito",
    "locationId": "115",
    "label": "Bacon, Potato, Egg & Cheese Burrito",
    "category": "mains",
    "priceCents": 930,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "bacon potato egg cheese burrito"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-chorizo-potato-egg-cheese-burrito",
    "locationId": "115",
    "label": "Chorizo, Potato, Egg & Cheese Burrito",
    "category": "mains",
    "priceCents": 930,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "chorizo potato egg cheese burrito"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-french-toast-sticks",
    "locationId": "115",
    "label": "French Toast Sticks",
    "category": "mains",
    "priceCents": 650,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "french toast sticks"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-reuben-on-deli-rye",
    "locationId": "115",
    "label": "Reuben on Deli Rye",
    "category": "mains",
    "priceCents": 950,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "reuben on deli rye"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-buffalo-cauliflower-on-ciabatta",
    "locationId": "115",
    "label": "Buffalo Cauliflower on Ciabatta",
    "category": "mains",
    "priceCents": 930,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "buffalo cauliflower on ciabatta"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-mumbai-ciabatta",
    "locationId": "115",
    "label": "Mumbai Ciabatta",
    "category": "mains",
    "priceCents": 845,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "mumbai ciabatta"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-italian-hoagie",
    "locationId": "115",
    "label": "Italian Hoagie",
    "category": "mains",
    "priceCents": 855,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "italian hoagie"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-sun-dried-tomato-panini",
    "locationId": "115",
    "label": "Sun-Dried Tomato Panini",
    "category": "mains",
    "priceCents": 855,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "sundried tomato panini"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-caprese-panini",
    "locationId": "115",
    "label": "Caprese Panini",
    "category": "mains",
    "priceCents": 855,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "caprese panini"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-pork-kimchi-croissant",
    "locationId": "115",
    "label": "Pork & Kimchi Croissant",
    "category": "mains",
    "priceCents": 935,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "pork kimchi croissant"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-pepperoni-pizza-croissant",
    "locationId": "115",
    "label": "Pepperoni Pizza Croissant",
    "category": "mains",
    "priceCents": 935,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "pepperoni pizza croissant"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-turkey-swiss-croissant",
    "locationId": "115",
    "label": "Turkey & Swiss Croissant",
    "category": "mains",
    "priceCents": 935,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "turkey swiss croissant"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-ham-cheddar-croissant",
    "locationId": "115",
    "label": "Ham & Cheddar Croissant",
    "category": "mains",
    "priceCents": 935,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "ham cheddar croissant"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_115_la-prima-rohr-chopped-cheeseburger-croissant",
    "locationId": "115",
    "label": "Chopped Cheeseburger Croissant",
    "category": "mains",
    "priceCents": 935,
    "description": "Named hot food; the menu says daily availability varies.",
    "aliases": [
      "chopped cheeseburger croissant"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_186_redhawk-double-espresso",
    "locationId": "186",
    "label": "Double Espresso",
    "category": "drinks",
    "priceCents": 360,
    "description": "Single listed preparation; size not stated.",
    "aliases": [
      "double espresso"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_186_redhawk-macchiato",
    "locationId": "186",
    "label": "Macchiato",
    "category": "drinks",
    "priceCents": 450,
    "description": "Single listed preparation; size not stated.",
    "aliases": [
      "macchiato"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_186_redhawk-cortado",
    "locationId": "186",
    "label": "Cortado",
    "category": "drinks",
    "priceCents": 450,
    "description": "Single listed preparation; size not stated.",
    "aliases": [
      "cortado"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_186_redhawk-cappuccino",
    "locationId": "186",
    "label": "Cappuccino",
    "category": "drinks",
    "priceCents": 460,
    "description": "Single listed preparation; size not stated.",
    "aliases": [
      "cappuccino"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_186_redhawk-egg-cheese-sandwich",
    "locationId": "186",
    "label": "Egg & Cheese Sandwich",
    "category": "mains",
    "priceCents": 850,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "egg cheese sandwich"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_186_redhawk-bacon-egg-cheese-sandwich",
    "locationId": "186",
    "label": "Bacon, Egg & Cheese Sandwich",
    "category": "mains",
    "priceCents": 950,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "bacon egg cheese sandwich"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_186_redhawk-veggie-breakfast-burrito",
    "locationId": "186",
    "label": "Veggie Breakfast Burrito",
    "category": "mains",
    "priceCents": 850,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "veggie breakfast burrito"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_186_redhawk-chorizo-breakfast-burrito",
    "locationId": "186",
    "label": "Chorizo Breakfast Burrito",
    "category": "mains",
    "priceCents": 950,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "chorizo breakfast burrito"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_186_redhawk-bagel-with-cream-cheese",
    "locationId": "186",
    "label": "Bagel with Cream Cheese",
    "category": "mains",
    "priceCents": 465,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "bagel with cream cheese"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_186_redhawk-pepperoni-roll",
    "locationId": "186",
    "label": "Pepperoni Roll",
    "category": "mains",
    "priceCents": 579,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "pepperoni roll"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_186_redhawk-grilled-cheese",
    "locationId": "186",
    "label": "Grilled Cheese",
    "category": "mains",
    "priceCents": 650,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "grilled cheese"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_186_redhawk-veggie-sandwich",
    "locationId": "186",
    "label": "Veggie Sandwich",
    "category": "mains",
    "priceCents": 1100,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "veggie sandwich"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_186_redhawk-italian-sandwich",
    "locationId": "186",
    "label": "Italian Sandwich",
    "category": "mains",
    "priceCents": 1200,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "italian sandwich"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-double-shot-espresso",
    "locationId": "204",
    "label": "Double Shot Espresso",
    "category": "drinks",
    "priceCents": 360,
    "description": "Two espresso shots; ounce size not stated.",
    "aliases": [
      "double shot espresso"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-macchiato-2-oz",
    "locationId": "204",
    "label": "Macchiato (2 oz)",
    "category": "drinks",
    "priceCents": 420,
    "description": "2 oz; listed base preparation.",
    "aliases": [
      "macchiato 2 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-cortado-4-oz",
    "locationId": "204",
    "label": "Cortado (4 oz)",
    "category": "drinks",
    "priceCents": 475,
    "description": "4 oz; listed base preparation.",
    "aliases": [
      "cortado 4 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-flat-white-6-oz",
    "locationId": "204",
    "label": "Flat White (6 oz)",
    "category": "drinks",
    "priceCents": 480,
    "description": "6 oz; listed base preparation.",
    "aliases": [
      "flat white 6 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-cappuccino-8-oz",
    "locationId": "204",
    "label": "Cappuccino (8 oz)",
    "category": "drinks",
    "priceCents": 490,
    "description": "8 oz; listed base preparation.",
    "aliases": [
      "cappuccino 8 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-small-latte-12-oz",
    "locationId": "204",
    "label": "Small Latte (12 oz)",
    "category": "drinks",
    "priceCents": 500,
    "description": "12 oz; two espresso shots.",
    "aliases": [
      "small latte 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-large-latte-16-oz",
    "locationId": "204",
    "label": "Large Latte (16 oz)",
    "category": "drinks",
    "priceCents": 575,
    "description": "16 oz; three espresso shots.",
    "aliases": [
      "large latte 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-small-americano-12-oz",
    "locationId": "204",
    "label": "Small Americano (12 oz)",
    "category": "drinks",
    "priceCents": 360,
    "description": "12 oz; two espresso shots.",
    "aliases": [
      "small americano 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-large-americano-16-oz",
    "locationId": "204",
    "label": "Large Americano (16 oz)",
    "category": "drinks",
    "priceCents": 435,
    "description": "16 oz; four espresso shots.",
    "aliases": [
      "large americano 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-hot-drip-coffee-12-oz",
    "locationId": "204",
    "label": "Hot Drip Coffee (12 oz)",
    "category": "drinks",
    "priceCents": 350,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "hot drip coffee 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-iced-drip-coffee-12-oz",
    "locationId": "204",
    "label": "Iced Drip Coffee (12 oz)",
    "category": "drinks",
    "priceCents": 350,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "iced drip coffee 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-hot-drip-coffee-16-oz",
    "locationId": "204",
    "label": "Hot Drip Coffee (16 oz)",
    "category": "drinks",
    "priceCents": 375,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "hot drip coffee 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-iced-drip-coffee-16-oz",
    "locationId": "204",
    "label": "Iced Drip Coffee (16 oz)",
    "category": "drinks",
    "priceCents": 375,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "iced drip coffee 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-cookie-butter-latte-12-oz",
    "locationId": "204",
    "label": "Cookie Butter Latte (12 oz)",
    "category": "drinks",
    "priceCents": 600,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "cookie butter latte 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-cookie-butter-latte-16-oz",
    "locationId": "204",
    "label": "Cookie Butter Latte (16 oz)",
    "category": "drinks",
    "priceCents": 675,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "cookie butter latte 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-fig-honey-rosemary-latte-12-oz",
    "locationId": "204",
    "label": "Fig Honey Rosemary Latte (12 oz)",
    "category": "drinks",
    "priceCents": 600,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "fig honey rosemary latte 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-fig-honey-rosemary-latte-16-oz",
    "locationId": "204",
    "label": "Fig Honey Rosemary Latte (16 oz)",
    "category": "drinks",
    "priceCents": 675,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "fig honey rosemary latte 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-spiced-rooibos-tea-latte-16-oz",
    "locationId": "204",
    "label": "Spiced Rooibos Tea Latte (16 oz)",
    "category": "drinks",
    "priceCents": 525,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "spiced rooibos tea latte 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-spiced-rooibos-lemonade-16-oz",
    "locationId": "204",
    "label": "Spiced Rooibos Lemonade (16 oz)",
    "category": "drinks",
    "priceCents": 500,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "spiced rooibos lemonade 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-mocha-12-oz",
    "locationId": "204",
    "label": "Mocha (12 oz)",
    "category": "drinks",
    "priceCents": 575,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "mocha 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-mocha-16-oz",
    "locationId": "204",
    "label": "Mocha (16 oz)",
    "category": "drinks",
    "priceCents": 650,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "mocha 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-matcha-latte-12-oz",
    "locationId": "204",
    "label": "Matcha Latte (12 oz)",
    "category": "drinks",
    "priceCents": 525,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "matcha latte 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-matcha-latte-16-oz",
    "locationId": "204",
    "label": "Matcha Latte (16 oz)",
    "category": "drinks",
    "priceCents": 600,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "matcha latte 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-chai-latte-12-oz",
    "locationId": "204",
    "label": "Chai Latte (12 oz)",
    "category": "drinks",
    "priceCents": 550,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "chai latte 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-chai-latte-16-oz",
    "locationId": "204",
    "label": "Chai Latte (16 oz)",
    "category": "drinks",
    "priceCents": 625,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "chai latte 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-hojicha-12-oz",
    "locationId": "204",
    "label": "Hojicha (12 oz)",
    "category": "drinks",
    "priceCents": 525,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "hojicha 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-hojicha-16-oz",
    "locationId": "204",
    "label": "Hojicha (16 oz)",
    "category": "drinks",
    "priceCents": 600,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "hojicha 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-hot-chocolate-12-oz",
    "locationId": "204",
    "label": "Hot Chocolate (12 oz)",
    "category": "drinks",
    "priceCents": 475,
    "description": "12 oz; listed base preparation.",
    "aliases": [
      "hot chocolate 12 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-hot-chocolate-16-oz",
    "locationId": "204",
    "label": "Hot Chocolate (16 oz)",
    "category": "drinks",
    "priceCents": 550,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "hot chocolate 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-lemonade-16-oz",
    "locationId": "204",
    "label": "Lemonade (16 oz)",
    "category": "drinks",
    "priceCents": 450,
    "description": "16 oz; listed base preparation.",
    "aliases": [
      "lemonade 16 oz"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_204_de-fer-hunt-butternut-sage-scone",
    "locationId": "204",
    "label": "Butternut Sage Scone",
    "category": "sides",
    "priceCents": 450,
    "description": "Named baked good from the published menu.",
    "aliases": [
      "butternut sage scone"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-blackberry-vanilla-scone",
    "locationId": "204",
    "label": "Blackberry Vanilla Scone",
    "category": "sides",
    "priceCents": 450,
    "description": "Named baked good from the published menu.",
    "aliases": [
      "blackberry vanilla scone"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-espresso-chocolate-chip-cookie",
    "locationId": "204",
    "label": "Espresso Chocolate Chip Cookie",
    "category": "sides",
    "priceCents": 315,
    "description": "Named baked good from the published menu.",
    "aliases": [
      "espresso chocolate chip cookie"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-strawberry-matcha-cookie",
    "locationId": "204",
    "label": "Strawberry Matcha Cookie",
    "category": "sides",
    "priceCents": 315,
    "description": "Named baked good from the published menu.",
    "aliases": [
      "strawberry matcha cookie"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-maple-tahini-cookie",
    "locationId": "204",
    "label": "Maple Tahini Cookie",
    "category": "sides",
    "priceCents": 315,
    "description": "Named baked good from the published menu.",
    "aliases": [
      "maple tahini cookie"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-chocolate-chip-cookie",
    "locationId": "204",
    "label": "Chocolate Chip Cookie",
    "category": "sides",
    "priceCents": 315,
    "description": "Named baked good from the published menu.",
    "aliases": [
      "chocolate chip cookie"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-apple-cinnamon-muffin",
    "locationId": "204",
    "label": "Apple Cinnamon Muffin",
    "category": "sides",
    "priceCents": 340,
    "description": "Named baked good from the published menu.",
    "aliases": [
      "apple cinnamon muffin"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-chocolate-hazelnut-crunch-muffin",
    "locationId": "204",
    "label": "Chocolate Hazelnut Crunch Muffin",
    "category": "sides",
    "priceCents": 340,
    "description": "Named baked good from the published menu.",
    "aliases": [
      "chocolate hazelnut crunch muffin"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-brownie",
    "locationId": "204",
    "label": "Brownie",
    "category": "sides",
    "priceCents": 400,
    "description": "Named baked good from the published menu.",
    "aliases": [
      "brownie"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-almond-flax-protein-bar",
    "locationId": "204",
    "label": "Almond Flax Protein Bar",
    "category": "sides",
    "priceCents": 390,
    "description": "Named baked good from the published menu.",
    "aliases": [
      "almond flax protein bar"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-bacon-breakfast-sandwich",
    "locationId": "204",
    "label": "Bacon Breakfast Sandwich",
    "category": "mains",
    "priceCents": 1025,
    "description": "Bacon, egg and cheddar on an English muffin with miso chili crisp sauce.",
    "aliases": [
      "bacon breakfast sandwich"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-mushroom-breakfast-sandwich",
    "locationId": "204",
    "label": "Mushroom Breakfast Sandwich",
    "category": "mains",
    "priceCents": 1025,
    "description": "Mushroom, egg and cheddar on an English muffin with miso chili crisp sauce.",
    "aliases": [
      "mushroom breakfast sandwich"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-grilled-cheese",
    "locationId": "204",
    "label": "Grilled Cheese",
    "category": "mains",
    "priceCents": 780,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "grilled cheese"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-italian-hand-pie",
    "locationId": "204",
    "label": "Italian Hand Pie",
    "category": "mains",
    "priceCents": 845,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "italian hand pie"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-root-vegetable-pot-pie",
    "locationId": "204",
    "label": "Root Vegetable Pot Pie",
    "category": "mains",
    "priceCents": 845,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "root vegetable pot pie"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-spinach-tomato-mushroom-herb-frittata",
    "locationId": "204",
    "label": "Spinach, Tomato, Mushroom & Herb Frittata",
    "category": "mains",
    "priceCents": 675,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "spinach tomato mushroom herb frittata"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-sundried-tomato-bacon-strata",
    "locationId": "204",
    "label": "Sundried Tomato & Bacon Strata",
    "category": "mains",
    "priceCents": 450,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "sundried tomato bacon strata"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-steamed-oatmeal",
    "locationId": "204",
    "label": "Steamed Oatmeal",
    "category": "mains",
    "priceCents": 575,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "steamed oatmeal"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-blood-orange-ginger-chia-pudding",
    "locationId": "204",
    "label": "Blood Orange Ginger Chia Pudding",
    "category": "mains",
    "priceCents": 600,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "blood orange ginger chia pudding"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-cozy-spiced-overnight-oats",
    "locationId": "204",
    "label": "Cozy Spiced Overnight Oats",
    "category": "mains",
    "priceCents": 575,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "cozy spiced overnight oats"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-turkey-brie-spiced-apple-butter-sandwich",
    "locationId": "204",
    "label": "Turkey Brie & Spiced Apple Butter Sandwich",
    "category": "mains",
    "priceCents": 999,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "turkey brie spiced apple butter sandwich"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-chicken-pesto-wrap",
    "locationId": "204",
    "label": "Chicken Pesto Wrap",
    "category": "mains",
    "priceCents": 1040,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "chicken pesto wrap"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-seitan-wrap",
    "locationId": "204",
    "label": "Seitan Wrap",
    "category": "mains",
    "priceCents": 965,
    "description": "Named menu item; no paid additions included.",
    "aliases": [
      "seitan wrap"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-strawberry-banana-smoothie",
    "locationId": "204",
    "label": "Strawberry Banana Smoothie",
    "category": "drinks",
    "priceCents": 800,
    "description": "Strawberry, banana, yogurt and orange juice; size not stated.",
    "aliases": [
      "strawberry banana smoothie"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_204_de-fer-hunt-green-smoothie",
    "locationId": "204",
    "label": "Green Smoothie",
    "category": "drinks",
    "priceCents": 875,
    "description": "Banana, spinach, orange-pineapple juice and oat milk; size not stated.",
    "aliases": [
      "green smoothie"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_114_samosa-2",
    "locationId": "114",
    "label": "Samosa (2)",
    "category": "sides",
    "priceCents": 550,
    "description": "Published sides and sweets item.",
    "aliases": [
      "samosa 2"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_114_kheer-rice-pudding",
    "locationId": "114",
    "label": "Kheer (rice pudding)",
    "category": "sides",
    "priceCents": 400,
    "description": "Published sides and sweets item.",
    "aliases": [
      "kheer rice pudding"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_114_gulab-jaman",
    "locationId": "114",
    "label": "Gulab Jaman",
    "category": "sides",
    "priceCents": 400,
    "description": "Published sides and sweets item.",
    "aliases": [
      "gulab jaman"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_114_extra-naan",
    "locationId": "114",
    "label": "Extra Naan",
    "category": "sides",
    "priceCents": 125,
    "description": "Published sides and sweets item.",
    "aliases": [
      "extra naan"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_114_pepsi-can",
    "locationId": "114",
    "label": "Pepsi Can",
    "category": "drinks",
    "priceCents": 195,
    "description": "Named item on the published menu.",
    "aliases": [
      "pepsi can"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_114_bottled-water",
    "locationId": "114",
    "label": "Bottled Water",
    "category": "drinks",
    "priceCents": 195,
    "description": "Named item on the published menu.",
    "aliases": [
      "bottled water"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_114_mango-juice",
    "locationId": "114",
    "label": "Mango Juice",
    "category": "drinks",
    "priceCents": 325,
    "description": "Named item on the published menu.",
    "aliases": [
      "mango juice"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_114_mango-lassi",
    "locationId": "114",
    "label": "Mango Lassi",
    "category": "drinks",
    "priceCents": 425,
    "description": "Named item on the published menu.",
    "aliases": [
      "mango lassi"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_91_chips",
    "locationId": "91",
    "label": "Chips",
    "category": "sides",
    "priceCents": 190,
    "description": "Named item on the published menu.",
    "aliases": [
      "chips"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_91_chips-salsa",
    "locationId": "91",
    "label": "Chips & Salsa",
    "category": "sides",
    "priceCents": 375,
    "description": "Named item on the published menu.",
    "aliases": [
      "chips salsa"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_91_chips-guacamole",
    "locationId": "91",
    "label": "Chips & Guacamole",
    "category": "sides",
    "priceCents": 490,
    "description": "Named item on the published menu.",
    "aliases": [
      "chips guacamole"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_91_guacamole",
    "locationId": "91",
    "label": "Guacamole",
    "category": "sides",
    "priceCents": 350,
    "description": "Named item on the published menu.",
    "aliases": [
      "guacamole"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_91_salsa",
    "locationId": "91",
    "label": "Salsa",
    "category": "sides",
    "priceCents": 125,
    "description": "Named item on the published menu.",
    "aliases": [
      "salsa"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_91_sour-cream",
    "locationId": "91",
    "label": "Sour Cream",
    "category": "sides",
    "priceCents": 125,
    "description": "Named item on the published menu.",
    "aliases": [
      "sour cream"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_91_12-inch-tortilla",
    "locationId": "91",
    "label": "12-inch Tortilla",
    "category": "sides",
    "priceCents": 50,
    "description": "Named item on the published menu.",
    "aliases": [
      "12inch tortilla"
    ],
    "sourcePage": 3
  },
  {
    "id": "cmu_91_fruit-cup",
    "locationId": "91",
    "label": "Fruit Cup",
    "category": "sides",
    "priceCents": 445,
    "description": "Named item on the published menu.",
    "aliases": [
      "fruit cup"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_91_churro",
    "locationId": "91",
    "label": "Churro",
    "category": "sides",
    "priceCents": 275,
    "description": "Named item on the published menu.",
    "aliases": [
      "churro"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_91_banana",
    "locationId": "91",
    "label": "Banana",
    "category": "sides",
    "priceCents": 165,
    "description": "Named item on the published menu.",
    "aliases": [
      "banana"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_91_brownie",
    "locationId": "91",
    "label": "Brownie",
    "category": "sides",
    "priceCents": 180,
    "description": "Named item on the published menu.",
    "aliases": [
      "brownie"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_91_macaron",
    "locationId": "91",
    "label": "Macaron",
    "category": "sides",
    "priceCents": 185,
    "description": "Named item on the published menu.",
    "aliases": [
      "macaron"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_91_beef-empanada",
    "locationId": "91",
    "label": "Beef Empanada",
    "category": "mains",
    "priceCents": 525,
    "description": "Prepared beef empanada from the express section.",
    "aliases": [
      "beef empanada"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_91_bottled-water",
    "locationId": "91",
    "label": "Bottled Water",
    "category": "drinks",
    "priceCents": 210,
    "description": "Named item on the published menu.",
    "aliases": [
      "bottled water"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_92_the-leonardo",
    "locationId": "92",
    "label": "The Leonardo",
    "category": "mains",
    "priceCents": 840,
    "description": "Cajun turkey and bacon sandwich on whole wheat.",
    "aliases": [
      "the leonardo"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_92_cheezy-beef-melt",
    "locationId": "92",
    "label": "Cheezy Beef Melt",
    "category": "mains",
    "priceCents": 840,
    "description": "Roast beef melt on sourdough.",
    "aliases": [
      "cheezy beef melt"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_92_taste-sensation",
    "locationId": "92",
    "label": "Taste Sensation",
    "category": "mains",
    "priceCents": 840,
    "description": "Corned beef sandwich on marble rye.",
    "aliases": [
      "taste sensation"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_92_the-general-assembly",
    "locationId": "92",
    "label": "The General Assembly",
    "category": "mains",
    "priceCents": 840,
    "description": "Turkey, ham and bacon sandwich on whole wheat.",
    "aliases": [
      "the general assembly"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_92_classic-italian",
    "locationId": "92",
    "label": "Classic Italian",
    "category": "mains",
    "priceCents": 840,
    "description": "Ham and provolone sandwich on sourdough.",
    "aliases": [
      "classic italian"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_92_farnam-tuna-melt",
    "locationId": "92",
    "label": "Farnam Tuna Melt",
    "category": "mains",
    "priceCents": 795,
    "description": "Tuna and cheddar melt on whole wheat.",
    "aliases": [
      "farnam tuna melt"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_92_chicken-salad-melt",
    "locationId": "92",
    "label": "Chicken Salad Melt",
    "category": "mains",
    "priceCents": 795,
    "description": "Chicken salad and cheddar melt on whole wheat.",
    "aliases": [
      "chicken salad melt"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_92_tempeh-wrap",
    "locationId": "92",
    "label": "Tempeh Wrap",
    "category": "mains",
    "priceCents": 800,
    "description": "Tempeh and grilled vegetables in a flour tortilla.",
    "aliases": [
      "tempeh wrap"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_92_buffalo-chicken-wrap",
    "locationId": "92",
    "label": "Buffalo Chicken Wrap",
    "category": "mains",
    "priceCents": 735,
    "description": "Named wrap listed on the published specials board; availability is not verified.",
    "aliases": [
      "buffalo chicken wrap"
    ],
    "sourcePage": 9
  },
  {
    "id": "cmu_92_southwest-chicken-wrap",
    "locationId": "92",
    "label": "Southwest Chicken Wrap",
    "category": "mains",
    "priceCents": 810,
    "description": "Named wrap listed on the published specials board; availability is not verified.",
    "aliases": [
      "southwest chicken wrap"
    ],
    "sourcePage": 9
  },
  {
    "id": "cmu_92_grilled-veggie-wrap",
    "locationId": "92",
    "label": "Grilled Veggie Wrap",
    "category": "mains",
    "priceCents": 760,
    "description": "Named wrap listed on the published specials board; availability is not verified.",
    "aliases": [
      "grilled veggie wrap"
    ],
    "sourcePage": 9
  },
  {
    "id": "cmu_92_chicken-salad",
    "locationId": "92",
    "label": "Chicken Salad",
    "category": "sides",
    "priceCents": 460,
    "description": "Prepared grab-and-go salad.",
    "aliases": [
      "chicken salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_92_tuna-salad",
    "locationId": "92",
    "label": "Tuna Salad",
    "category": "sides",
    "priceCents": 460,
    "description": "Prepared grab-and-go salad.",
    "aliases": [
      "tuna salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_92_broccoli-bacon-salad",
    "locationId": "92",
    "label": "Broccoli Bacon Salad",
    "category": "sides",
    "priceCents": 420,
    "description": "Prepared grab-and-go salad.",
    "aliases": [
      "broccoli bacon salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_92_pasta-salad",
    "locationId": "92",
    "label": "Pasta Salad",
    "category": "sides",
    "priceCents": 410,
    "description": "Prepared grab-and-go salad.",
    "aliases": [
      "pasta salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_92_potato-salad",
    "locationId": "92",
    "label": "Potato Salad",
    "category": "sides",
    "priceCents": 410,
    "description": "Prepared grab-and-go salad.",
    "aliases": [
      "potato salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_92_cole-slaw",
    "locationId": "92",
    "label": "Cole Slaw",
    "category": "sides",
    "priceCents": 410,
    "description": "Prepared grab-and-go salad.",
    "aliases": [
      "cole slaw"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_92_cucumber-feta-kalamata-olives-and-tomato-salad",
    "locationId": "92",
    "label": "Cucumber, Feta, Kalamata Olives and Tomato Salad",
    "category": "sides",
    "priceCents": 400,
    "description": "Prepared grab-and-go salad.",
    "aliases": [
      "cucumber feta kalamata olives and tomato salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_92_quinoa-salad",
    "locationId": "92",
    "label": "Quinoa Salad",
    "category": "sides",
    "priceCents": 440,
    "description": "Prepared grab-and-go salad.",
    "aliases": [
      "quinoa salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_92_sesame-noodle-salad",
    "locationId": "92",
    "label": "Sesame Noodle Salad",
    "category": "sides",
    "priceCents": 390,
    "description": "Prepared grab-and-go salad.",
    "aliases": [
      "sesame noodle salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_92_brownie",
    "locationId": "92",
    "label": "Brownie",
    "category": "sides",
    "priceCents": 165,
    "description": "Named item on the published menu.",
    "aliases": [
      "brownie"
    ],
    "sourcePage": 8
  },
  {
    "id": "cmu_92_cookie",
    "locationId": "92",
    "label": "Cookie",
    "category": "sides",
    "priceCents": 160,
    "description": "Named item on the published menu.",
    "aliases": [
      "cookie"
    ],
    "sourcePage": 8
  },
  {
    "id": "cmu_92_coffee-small",
    "locationId": "92",
    "label": "Coffee - Small",
    "category": "drinks",
    "priceCents": 275,
    "description": "Published cafe beverage; sizes are the menu labels, not inferred volumes.",
    "aliases": [
      "coffee small"
    ],
    "sourcePage": 7
  },
  {
    "id": "cmu_92_coffee-medium",
    "locationId": "92",
    "label": "Coffee - Medium",
    "category": "drinks",
    "priceCents": 310,
    "description": "Published cafe beverage; sizes are the menu labels, not inferred volumes.",
    "aliases": [
      "coffee medium"
    ],
    "sourcePage": 7
  },
  {
    "id": "cmu_92_coffee-large",
    "locationId": "92",
    "label": "Coffee - Large",
    "category": "drinks",
    "priceCents": 325,
    "description": "Published cafe beverage; sizes are the menu labels, not inferred volumes.",
    "aliases": [
      "coffee large"
    ],
    "sourcePage": 7
  },
  {
    "id": "cmu_92_hot-chocolate-small",
    "locationId": "92",
    "label": "Hot Chocolate - Small",
    "category": "drinks",
    "priceCents": 215,
    "description": "Published cafe beverage; sizes are the menu labels, not inferred volumes.",
    "aliases": [
      "hot chocolate small"
    ],
    "sourcePage": 7
  },
  {
    "id": "cmu_92_hot-chocolate-large",
    "locationId": "92",
    "label": "Hot Chocolate - Large",
    "category": "drinks",
    "priceCents": 315,
    "description": "Published cafe beverage; sizes are the menu labels, not inferred volumes.",
    "aliases": [
      "hot chocolate large"
    ],
    "sourcePage": 7
  },
  {
    "id": "cmu_92_hot-tea-small",
    "locationId": "92",
    "label": "Hot Tea - Small",
    "category": "drinks",
    "priceCents": 245,
    "description": "Published cafe beverage; sizes are the menu labels, not inferred volumes.",
    "aliases": [
      "hot tea small"
    ],
    "sourcePage": 7
  },
  {
    "id": "cmu_92_cold-brew-small",
    "locationId": "92",
    "label": "Cold Brew - Small",
    "category": "drinks",
    "priceCents": 370,
    "description": "Published cafe beverage; sizes are the menu labels, not inferred volumes.",
    "aliases": [
      "cold brew small"
    ],
    "sourcePage": 7
  },
  {
    "id": "cmu_92_cold-brew-large",
    "locationId": "92",
    "label": "Cold Brew - Large",
    "category": "drinks",
    "priceCents": 440,
    "description": "Published cafe beverage; sizes are the menu labels, not inferred volumes.",
    "aliases": [
      "cold brew large"
    ],
    "sourcePage": 7
  },
  {
    "id": "cmu_92_bottled-water",
    "locationId": "92",
    "label": "Bottled Water",
    "category": "drinks",
    "priceCents": 235,
    "description": "Published cafe beverage; sizes are the menu labels, not inferred volumes.",
    "aliases": [
      "bottled water"
    ],
    "sourcePage": 7
  },
  {
    "id": "cmu_92_lipton-iced-tea",
    "locationId": "92",
    "label": "Lipton Iced Tea",
    "category": "drinks",
    "priceCents": 240,
    "description": "Published cafe beverage; sizes are the menu labels, not inferred volumes.",
    "aliases": [
      "lipton iced tea"
    ],
    "sourcePage": 7
  },
  {
    "id": "cmu_92_turner-tea",
    "locationId": "92",
    "label": "Turner Tea",
    "category": "drinks",
    "priceCents": 175,
    "description": "Published cafe beverage; sizes are the menu labels, not inferred volumes.",
    "aliases": [
      "turner tea"
    ],
    "sourcePage": 7
  },
  {
    "id": "cmu_92_milk-pint",
    "locationId": "92",
    "label": "Milk Pint",
    "category": "drinks",
    "priceCents": 255,
    "description": "Published cafe beverage; sizes are the menu labels, not inferred volumes.",
    "aliases": [
      "milk pint"
    ],
    "sourcePage": 7
  },
  {
    "id": "cmu_92_vanilla-soy-milk",
    "locationId": "92",
    "label": "Vanilla Soy Milk",
    "category": "drinks",
    "priceCents": 375,
    "description": "Published cafe beverage; sizes are the menu labels, not inferred volumes.",
    "aliases": [
      "vanilla soy milk"
    ],
    "sourcePage": 7
  },
  {
    "id": "cmu_201_lamb-curry-8-oz",
    "locationId": "201",
    "label": "Lamb Curry - 8 oz",
    "category": "mains",
    "priceCents": 899,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "lamb curry 8 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_lamb-curry-16-oz",
    "locationId": "201",
    "label": "Lamb Curry - 16 oz",
    "category": "mains",
    "priceCents": 1699,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "lamb curry 16 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_chicken-curry-8-oz",
    "locationId": "201",
    "label": "Chicken Curry - 8 oz",
    "category": "mains",
    "priceCents": 799,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "chicken curry 8 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_chicken-curry-16-oz",
    "locationId": "201",
    "label": "Chicken Curry - 16 oz",
    "category": "mains",
    "priceCents": 1599,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "chicken curry 16 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_tandoori-chicken-8-oz",
    "locationId": "201",
    "label": "Tandoori Chicken - 8 oz",
    "category": "mains",
    "priceCents": 799,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "tandoori chicken 8 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_tandoori-chicken-16-oz",
    "locationId": "201",
    "label": "Tandoori Chicken - 16 oz",
    "category": "mains",
    "priceCents": 1599,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "tandoori chicken 16 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_chilli-chicken-8-oz",
    "locationId": "201",
    "label": "Chilli Chicken - 8 oz",
    "category": "mains",
    "priceCents": 799,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "chilli chicken 8 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_chilli-chicken-16-oz",
    "locationId": "201",
    "label": "Chilli Chicken - 16 oz",
    "category": "mains",
    "priceCents": 1599,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "chilli chicken 16 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_chicken-tikka-masala-8-oz",
    "locationId": "201",
    "label": "Chicken Tikka Masala - 8 oz",
    "category": "mains",
    "priceCents": 799,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "chicken tikka masala 8 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_chicken-tikka-masala-16-oz",
    "locationId": "201",
    "label": "Chicken Tikka Masala - 16 oz",
    "category": "mains",
    "priceCents": 1599,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "chicken tikka masala 16 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_grilled-chicken-8-oz",
    "locationId": "201",
    "label": "Grilled Chicken - 8 oz",
    "category": "mains",
    "priceCents": 799,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "grilled chicken 8 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_grilled-chicken-16-oz",
    "locationId": "201",
    "label": "Grilled Chicken - 16 oz",
    "category": "mains",
    "priceCents": 1599,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "grilled chicken 16 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_veggie-curry-8-oz",
    "locationId": "201",
    "label": "Veggie Curry - 8 oz",
    "category": "mains",
    "priceCents": 499,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "veggie curry 8 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_veggie-curry-16-oz",
    "locationId": "201",
    "label": "Veggie Curry - 16 oz",
    "category": "mains",
    "priceCents": 999,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "veggie curry 16 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_chana-masala-8-oz",
    "locationId": "201",
    "label": "Chana Masala - 8 oz",
    "category": "mains",
    "priceCents": 499,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "chana masala 8 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_chana-masala-16-oz",
    "locationId": "201",
    "label": "Chana Masala - 16 oz",
    "category": "mains",
    "priceCents": 999,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "chana masala 16 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_spinach-paneer-8-oz",
    "locationId": "201",
    "label": "Spinach & Paneer - 8 oz",
    "category": "mains",
    "priceCents": 599,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "spinach paneer 8 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_spinach-paneer-16-oz",
    "locationId": "201",
    "label": "Spinach & Paneer - 16 oz",
    "category": "mains",
    "priceCents": 1099,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "spinach paneer 16 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_mottor-paneer-8-oz",
    "locationId": "201",
    "label": "Mottor Paneer - 8 oz",
    "category": "mains",
    "priceCents": 599,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "mottor paneer 8 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_mottor-paneer-16-oz",
    "locationId": "201",
    "label": "Mottor Paneer - 16 oz",
    "category": "mains",
    "priceCents": 1099,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "mottor paneer 16 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_meat-gyro-8-oz",
    "locationId": "201",
    "label": "Meat Gyro - 8 oz",
    "category": "mains",
    "priceCents": 999,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "meat gyro 8 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_meat-gyro-16-oz",
    "locationId": "201",
    "label": "Meat Gyro - 16 oz",
    "category": "mains",
    "priceCents": 1799,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "meat gyro 16 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_chicken-gyro-8-oz",
    "locationId": "201",
    "label": "Chicken Gyro - 8 oz",
    "category": "mains",
    "priceCents": 899,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "chicken gyro 8 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_201_chicken-gyro-16-oz",
    "locationId": "201",
    "label": "Chicken Gyro - 16 oz",
    "category": "mains",
    "priceCents": 1599,
    "description": "Hot bar entree portion, a la carte; no meal base included.",
    "aliases": [
      "chicken gyro 16 oz"
    ],
    "sourcePage": 4
  },
  {
    "id": "cmu_109_chicken-burger",
    "locationId": "109",
    "label": "Chicken Burger",
    "category": "mains",
    "priceCents": 799,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "chicken burger"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_cheeseburger",
    "locationId": "109",
    "label": "Cheeseburger",
    "category": "mains",
    "priceCents": 799,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "cheeseburger"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_chicken-gyro-sandwich",
    "locationId": "109",
    "label": "Chicken Gyro Sandwich",
    "category": "mains",
    "priceCents": 899,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "chicken gyro sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_meat-gyro-sandwich",
    "locationId": "109",
    "label": "Meat Gyro Sandwich",
    "category": "mains",
    "priceCents": 899,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "meat gyro sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_falafel-sandwich",
    "locationId": "109",
    "label": "Falafel Sandwich",
    "category": "mains",
    "priceCents": 899,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "falafel sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_fish-sandwich",
    "locationId": "109",
    "label": "Fish Sandwich",
    "category": "mains",
    "priceCents": 999,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "fish sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_fried-chicken-sandwich",
    "locationId": "109",
    "label": "Fried Chicken Sandwich",
    "category": "mains",
    "priceCents": 999,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "fried chicken sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_beef-shawarma-sandwich",
    "locationId": "109",
    "label": "Beef Shawarma Sandwich",
    "category": "mains",
    "priceCents": 999,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "beef shawarma sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_chicken-shawarma-sandwich",
    "locationId": "109",
    "label": "Chicken Shawarma Sandwich",
    "category": "mains",
    "priceCents": 999,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "chicken shawarma sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_cheesesteak",
    "locationId": "109",
    "label": "Cheesesteak",
    "category": "mains",
    "priceCents": 1399,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "cheesesteak"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_chicken-cheesesteak",
    "locationId": "109",
    "label": "Chicken Cheesesteak",
    "category": "mains",
    "priceCents": 1399,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "chicken cheesesteak"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_grill-chicken-breast-sandwich",
    "locationId": "109",
    "label": "Grill Chicken Breast Sandwich",
    "category": "mains",
    "priceCents": 999,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "grill chicken breast sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_chicken-kufta-2-pc-sandwich",
    "locationId": "109",
    "label": "Chicken Kufta (2 pc) Sandwich",
    "category": "mains",
    "priceCents": 999,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "chicken kufta 2 pc sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_lamb-kufta-2-pc-sandwich",
    "locationId": "109",
    "label": "Lamb Kufta (2 pc) Sandwich",
    "category": "mains",
    "priceCents": 999,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "lamb kufta 2 pc sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_ny-strip-steak-sandwich",
    "locationId": "109",
    "label": "NY Strip Steak Sandwich",
    "category": "mains",
    "priceCents": 1499,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "ny strip steak sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_grilled-cheese-sandwich",
    "locationId": "109",
    "label": "Grilled Cheese Sandwich",
    "category": "mains",
    "priceCents": 899,
    "description": "Published lunch/dinner sandwich; no combo add-ons included.",
    "aliases": [
      "grilled cheese sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_buffalo-chicken-deli-sandwich",
    "locationId": "109",
    "label": "Buffalo Chicken Deli Sandwich",
    "category": "mains",
    "priceCents": 999,
    "description": "Published lunch/dinner deli sandwich; breakfast and late-night variants excluded.",
    "aliases": [
      "buffalo chicken deli sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_chicken-salad-deli-sandwich",
    "locationId": "109",
    "label": "Chicken Salad Deli Sandwich",
    "category": "mains",
    "priceCents": 999,
    "description": "Published lunch/dinner deli sandwich; breakfast and late-night variants excluded.",
    "aliases": [
      "chicken salad deli sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_tuna-salad-deli-sandwich",
    "locationId": "109",
    "label": "Tuna Salad Deli Sandwich",
    "category": "mains",
    "priceCents": 999,
    "description": "Published lunch/dinner deli sandwich; breakfast and late-night variants excluded.",
    "aliases": [
      "tuna salad deli sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_italian-deli-sandwich",
    "locationId": "109",
    "label": "Italian Deli Sandwich",
    "category": "mains",
    "priceCents": 999,
    "description": "Published lunch/dinner deli sandwich; breakfast and late-night variants excluded.",
    "aliases": [
      "italian deli sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_turkey-breast-deli-sandwich",
    "locationId": "109",
    "label": "Turkey Breast Deli Sandwich",
    "category": "mains",
    "priceCents": 899,
    "description": "Published lunch/dinner deli sandwich; breakfast and late-night variants excluded.",
    "aliases": [
      "turkey breast deli sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_roast-beef-deli-sandwich",
    "locationId": "109",
    "label": "Roast Beef Deli Sandwich",
    "category": "mains",
    "priceCents": 999,
    "description": "Published lunch/dinner deli sandwich; breakfast and late-night variants excluded.",
    "aliases": [
      "roast beef deli sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_turkey-club-deli-sandwich",
    "locationId": "109",
    "label": "Turkey Club Deli Sandwich",
    "category": "mains",
    "priceCents": 999,
    "description": "Published lunch/dinner deli sandwich; breakfast and late-night variants excluded.",
    "aliases": [
      "turkey club deli sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_caprese-deli-sandwich",
    "locationId": "109",
    "label": "Caprese Deli Sandwich",
    "category": "mains",
    "priceCents": 899,
    "description": "Published lunch/dinner deli sandwich; breakfast and late-night variants excluded.",
    "aliases": [
      "caprese deli sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_blt-deli-sandwich",
    "locationId": "109",
    "label": "BLT Deli Sandwich",
    "category": "mains",
    "priceCents": 899,
    "description": "Published lunch/dinner deli sandwich; breakfast and late-night variants excluded.",
    "aliases": [
      "blt deli sandwich"
    ],
    "sourcePage": 5
  },
  {
    "id": "cmu_109_grill-chicken-breast-a-la-carte",
    "locationId": "109",
    "label": "Grill Chicken Breast - A La Carte",
    "category": "mains",
    "priceCents": 999,
    "description": "Grill item only, from the a la carte section.",
    "aliases": [
      "grill chicken breast a la carte"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_chicken-kufta-1-pc-a-la-carte",
    "locationId": "109",
    "label": "Chicken Kufta (1 pc) - A La Carte",
    "category": "mains",
    "priceCents": 399,
    "description": "Grill item only, from the a la carte section.",
    "aliases": [
      "chicken kufta 1 pc a la carte"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_lamb-kufta-1-pc-a-la-carte",
    "locationId": "109",
    "label": "Lamb Kufta (1 pc) - A La Carte",
    "category": "mains",
    "priceCents": 399,
    "description": "Grill item only, from the a la carte section.",
    "aliases": [
      "lamb kufta 1 pc a la carte"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_ny-strip-steak-a-la-carte",
    "locationId": "109",
    "label": "NY Strip Steak - A La Carte",
    "category": "mains",
    "priceCents": 1399,
    "description": "Grill item only, from the a la carte section.",
    "aliases": [
      "ny strip steak a la carte"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_lamb-chop-1-pc-a-la-carte",
    "locationId": "109",
    "label": "Lamb Chop (1 pc) - A La Carte",
    "category": "mains",
    "priceCents": 599,
    "description": "Grill item only, from the a la carte section.",
    "aliases": [
      "lamb chop 1 pc a la carte"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_house-salad",
    "locationId": "109",
    "label": "House Salad",
    "category": "mains",
    "priceCents": 999,
    "description": "Named salad from the published lunch/dinner menu.",
    "aliases": [
      "house salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_greek-salad",
    "locationId": "109",
    "label": "Greek Salad",
    "category": "mains",
    "priceCents": 999,
    "description": "Named salad from the published lunch/dinner menu.",
    "aliases": [
      "greek salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_ceasar-salad",
    "locationId": "109",
    "label": "Ceasar Salad",
    "category": "mains",
    "priceCents": 999,
    "description": "Named salad from the published lunch/dinner menu.",
    "aliases": [
      "ceasar salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_falafel-salad",
    "locationId": "109",
    "label": "Falafel Salad",
    "category": "mains",
    "priceCents": 1399,
    "description": "Named salad from the published lunch/dinner menu.",
    "aliases": [
      "falafel salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_meat-gyro-salad",
    "locationId": "109",
    "label": "Meat Gyro Salad",
    "category": "mains",
    "priceCents": 1399,
    "description": "Named salad from the published lunch/dinner menu.",
    "aliases": [
      "meat gyro salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_chicken-gyro-salad",
    "locationId": "109",
    "label": "Chicken Gyro Salad",
    "category": "mains",
    "priceCents": 1399,
    "description": "Named salad from the published lunch/dinner menu.",
    "aliases": [
      "chicken gyro salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_chicken-tender-salad",
    "locationId": "109",
    "label": "Chicken Tender Salad",
    "category": "mains",
    "priceCents": 1399,
    "description": "Named salad from the published lunch/dinner menu.",
    "aliases": [
      "chicken tender salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_grill-chicken-breast-salad",
    "locationId": "109",
    "label": "Grill Chicken Breast Salad",
    "category": "mains",
    "priceCents": 1399,
    "description": "Named salad from the published lunch/dinner menu.",
    "aliases": [
      "grill chicken breast salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_chicken-kufta-2-pc-salad",
    "locationId": "109",
    "label": "Chicken Kufta (2 pc) Salad",
    "category": "mains",
    "priceCents": 1399,
    "description": "Named salad from the published lunch/dinner menu.",
    "aliases": [
      "chicken kufta 2 pc salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_lamb-kufta-2-pc-salad",
    "locationId": "109",
    "label": "Lamb Kufta (2 pc) Salad",
    "category": "mains",
    "priceCents": 1399,
    "description": "Named salad from the published lunch/dinner menu.",
    "aliases": [
      "lamb kufta 2 pc salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_ny-strip-steak-salad",
    "locationId": "109",
    "label": "NY Strip Steak Salad",
    "category": "mains",
    "priceCents": 1699,
    "description": "Named salad from the published lunch/dinner menu.",
    "aliases": [
      "ny strip steak salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_lamb-chops-3-pc-salad",
    "locationId": "109",
    "label": "Lamb Chops (3 pc) Salad",
    "category": "mains",
    "priceCents": 2299,
    "description": "Named salad from the published lunch/dinner menu.",
    "aliases": [
      "lamb chops 3 pc salad"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_meat-samosa-2",
    "locationId": "109",
    "label": "Meat Samosa (2)",
    "category": "sides",
    "priceCents": 599,
    "description": "Published lunch/dinner Apps & More item.",
    "aliases": [
      "meat samosa 2"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_chicken-samosa-2",
    "locationId": "109",
    "label": "Chicken Samosa (2)",
    "category": "sides",
    "priceCents": 599,
    "description": "Published lunch/dinner Apps & More item.",
    "aliases": [
      "chicken samosa 2"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_veggie-samosa-2",
    "locationId": "109",
    "label": "Veggie Samosa (2)",
    "category": "sides",
    "priceCents": 499,
    "description": "Published lunch/dinner Apps & More item.",
    "aliases": [
      "veggie samosa 2"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_cheese-fries",
    "locationId": "109",
    "label": "Cheese Fries",
    "category": "sides",
    "priceCents": 899,
    "description": "Published lunch/dinner Apps & More item.",
    "aliases": [
      "cheese fries"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_loaded-fries",
    "locationId": "109",
    "label": "Loaded Fries",
    "category": "sides",
    "priceCents": 1499,
    "description": "Published lunch/dinner Apps & More item.",
    "aliases": [
      "loaded fries"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_chicken-nuggets-6",
    "locationId": "109",
    "label": "Chicken Nuggets (6)",
    "category": "sides",
    "priceCents": 599,
    "description": "Published lunch/dinner Apps & More item.",
    "aliases": [
      "chicken nuggets 6"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_chicken-strips-3",
    "locationId": "109",
    "label": "Chicken Strips (3)",
    "category": "sides",
    "priceCents": 899,
    "description": "Published lunch/dinner Apps & More item.",
    "aliases": [
      "chicken strips 3"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_cut-wings-6",
    "locationId": "109",
    "label": "Cut Wings (6)",
    "category": "sides",
    "priceCents": 899,
    "description": "Published lunch/dinner Apps & More item.",
    "aliases": [
      "cut wings 6"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_hummus-8-oz",
    "locationId": "109",
    "label": "Hummus - 8 oz",
    "category": "sides",
    "priceCents": 499,
    "description": "Published lunch/dinner Apps & More item.",
    "aliases": [
      "hummus 8 oz"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_baba-ghanoush-8-oz",
    "locationId": "109",
    "label": "Baba Ghanoush - 8 oz",
    "category": "sides",
    "priceCents": 599,
    "description": "Published lunch/dinner Apps & More item.",
    "aliases": [
      "baba ghanoush 8 oz"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_chickpea-salad-8-oz",
    "locationId": "109",
    "label": "Chickpea Salad - 8 oz",
    "category": "sides",
    "priceCents": 499,
    "description": "Published lunch/dinner Apps & More item.",
    "aliases": [
      "chickpea salad 8 oz"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_grape-leaves-8-oz",
    "locationId": "109",
    "label": "Grape Leaves - 8 oz",
    "category": "sides",
    "priceCents": 499,
    "description": "Published lunch/dinner Apps & More item.",
    "aliases": [
      "grape leaves 8 oz"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_pasta-salad-8-oz",
    "locationId": "109",
    "label": "Pasta Salad - 8 oz",
    "category": "sides",
    "priceCents": 499,
    "description": "Published lunch/dinner Apps & More item.",
    "aliases": [
      "pasta salad 8 oz"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_potato-salad-8-oz",
    "locationId": "109",
    "label": "Potato Salad - 8 oz",
    "category": "sides",
    "priceCents": 499,
    "description": "Published lunch/dinner Apps & More item.",
    "aliases": [
      "potato salad 8 oz"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_109_macaroni-salad-8-oz",
    "locationId": "109",
    "label": "Macaroni Salad - 8 oz",
    "category": "sides",
    "priceCents": 499,
    "description": "Published lunch/dinner Apps & More item.",
    "aliases": [
      "macaroni salad 8 oz"
    ],
    "sourcePage": 6
  },
  {
    "id": "cmu_110_white_rice",
    "locationId": "110",
    "label": "White Rice",
    "category": "sides",
    "priceCents": 300,
    "description": "Standalone published side; portion size is not specified.",
    "aliases": [
      "white rice"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_110_spring_roll",
    "locationId": "110",
    "label": "Spring Roll",
    "category": "sides",
    "priceCents": 300,
    "description": "Standalone published side; portion size is not specified.",
    "aliases": [
      "spring roll"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_110_pork_dumpling",
    "locationId": "110",
    "label": "Pork Dumpling",
    "category": "sides",
    "priceCents": 300,
    "description": "Standalone published side; portion size is not specified.",
    "aliases": [
      "pork dumpling"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_110_red_bean_rice_cake",
    "locationId": "110",
    "label": "Red Bean Rice Cake",
    "category": "sides",
    "priceCents": 400,
    "description": "Standalone published side; portion size is not specified.",
    "aliases": [
      "red bean rice cake"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_110_green_salad",
    "locationId": "110",
    "label": "Green Salad",
    "category": "sides",
    "priceCents": 450,
    "description": "Standalone published side; portion size is not specified.",
    "aliases": [
      "green salad"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_110_noodles",
    "locationId": "110",
    "label": "Noodles",
    "category": "sides",
    "priceCents": 450,
    "description": "Standalone published side; portion size is not specified.",
    "aliases": [
      "noodles"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_110_fried_rice",
    "locationId": "110",
    "label": "Fried Rice",
    "category": "sides",
    "priceCents": 450,
    "description": "Standalone published side; portion size is not specified.",
    "aliases": [
      "fried rice"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_110_peach_fruit_tea_no_bubbles",
    "locationId": "110",
    "label": "Peach Fruit Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 499,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "peach fruit tea",
      "peach fruit tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_lychee_fruit_tea_no_bubbles",
    "locationId": "110",
    "label": "Lychee Fruit Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 499,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "lychee fruit tea",
      "lychee fruit tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_mango_fruit_tea_no_bubbles",
    "locationId": "110",
    "label": "Mango Fruit Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 499,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "mango fruit tea",
      "mango fruit tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_honeydew_fruit_tea_no_bubbles",
    "locationId": "110",
    "label": "Honeydew Fruit Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 499,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "honeydew fruit tea",
      "honeydew fruit tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_rose_fruit_tea_no_bubbles",
    "locationId": "110",
    "label": "Rose Fruit Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 499,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "rose fruit tea",
      "rose fruit tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_strawberry_fruit_tea_no_bubbles",
    "locationId": "110",
    "label": "Strawberry Fruit Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 499,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "strawberry fruit tea",
      "strawberry fruit tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_original_milk_tea_no_bubbles",
    "locationId": "110",
    "label": "Original Milk Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 529,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "original milk tea",
      "original milk tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_taro_milk_tea_no_bubbles",
    "locationId": "110",
    "label": "Taro Milk Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 529,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "taro milk tea",
      "taro milk tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_matcha_milk_tea_no_bubbles",
    "locationId": "110",
    "label": "Matcha Milk Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 529,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "matcha milk tea",
      "matcha milk tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_mango_milk_tea_no_bubbles",
    "locationId": "110",
    "label": "Mango Milk Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 529,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "mango milk tea",
      "mango milk tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_honeydew_milk_tea_no_bubbles",
    "locationId": "110",
    "label": "Honeydew Milk Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 529,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "honeydew milk tea",
      "honeydew milk tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_rose_milk_tea_no_bubbles",
    "locationId": "110",
    "label": "Rose Milk Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 529,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "rose milk tea",
      "rose milk tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_strawberry_milk_tea_no_bubbles",
    "locationId": "110",
    "label": "Strawberry Milk Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 529,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "strawberry milk tea",
      "strawberry milk tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_brown_sugar_milk_tea_no_bubbles",
    "locationId": "110",
    "label": "Brown Sugar Milk Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 529,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "brown sugar milk tea",
      "brown sugar milk tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_coffee_milk_tea_no_bubbles",
    "locationId": "110",
    "label": "Coffee Milk Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 529,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "coffee milk tea",
      "coffee milk tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_thai_milk_tea_no_bubbles",
    "locationId": "110",
    "label": "Thai Milk Tea (No Added Bubbles)",
    "category": "drinks",
    "priceCents": 529,
    "description": "Published tea flavor, without optional paid bubbles. Cup size is not specified.",
    "aliases": [
      "thai milk tea",
      "thai milk tea no bubbles"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_honeydew_smoothie",
    "locationId": "110",
    "label": "Honeydew Smoothie",
    "category": "drinks",
    "priceCents": 499,
    "description": "Published smoothie flavor; cup size is not specified.",
    "aliases": [
      "honeydew smoothie"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_mango_smoothie",
    "locationId": "110",
    "label": "Mango Smoothie",
    "category": "drinks",
    "priceCents": 499,
    "description": "Published smoothie flavor; cup size is not specified.",
    "aliases": [
      "mango smoothie"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_strawberry_smoothie",
    "locationId": "110",
    "label": "Strawberry Smoothie",
    "category": "drinks",
    "priceCents": 499,
    "description": "Published smoothie flavor; cup size is not specified.",
    "aliases": [
      "strawberry smoothie"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_110_bottled_water",
    "locationId": "110",
    "label": "Bottled Water",
    "category": "drinks",
    "priceCents": 189,
    "description": "Published bottled water; bottle size and brand are not specified.",
    "aliases": [
      "bottled water",
      "water"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_82_lamb_turkey_shawarma_pita",
    "locationId": "82",
    "label": "Lamb and Turkey Shawarma Sandwich (Pita)",
    "category": "mains",
    "priceCents": 1195,
    "description": "Lamb and turkey shawarma with hummus, chopped salad, cabbage, pickles and tahini.",
    "aliases": [
      "lamb and turkey shawarma pita",
      "lamb and turkey shawarma sandwich pita"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_lamb_turkey_shawarma_gluten_free_wrap",
    "locationId": "82",
    "label": "Lamb and Turkey Shawarma Sandwich (Gluten-Free Wrap)",
    "category": "mains",
    "priceCents": 1195,
    "description": "Lamb and turkey shawarma with hummus, chopped salad, cabbage, pickles and tahini.",
    "aliases": [
      "lamb and turkey shawarma gluten-free wrap",
      "lamb and turkey shawarma sandwich gluten-free wrap"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_vegan_eggplant_shawarma_pita",
    "locationId": "82",
    "label": "Vegan Eggplant Shawarma Sandwich (Pita)",
    "category": "mains",
    "priceCents": 995,
    "description": "Shawarma-seasoned eggplant with hummus, chopped salad, cabbage, pickles and tahini.",
    "aliases": [
      "vegan eggplant shawarma pita",
      "vegan eggplant shawarma sandwich pita"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_vegan_eggplant_shawarma_gluten_free_wrap",
    "locationId": "82",
    "label": "Vegan Eggplant Shawarma Sandwich (Gluten-Free Wrap)",
    "category": "mains",
    "priceCents": 995,
    "description": "Shawarma-seasoned eggplant with hummus, chopped salad, cabbage, pickles and tahini.",
    "aliases": [
      "vegan eggplant shawarma gluten-free wrap",
      "vegan eggplant shawarma sandwich gluten-free wrap"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_falafel_pita",
    "locationId": "82",
    "label": "Falafel Sandwich (Pita)",
    "category": "mains",
    "priceCents": 995,
    "description": "Falafel with hummus, chopped salad, cabbage, pickles and tahini.",
    "aliases": [
      "falafel pita",
      "falafel sandwich pita"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_falafel_gluten_free_wrap",
    "locationId": "82",
    "label": "Falafel Sandwich (Gluten-Free Wrap)",
    "category": "mains",
    "priceCents": 995,
    "description": "Falafel with hummus, chopped salad, cabbage, pickles and tahini.",
    "aliases": [
      "falafel gluten-free wrap",
      "falafel sandwich gluten-free wrap"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_kosher_beef_hotdog_bun",
    "locationId": "82",
    "label": "Classic All-Beef Kosher Hotdog in Bun",
    "category": "mains",
    "priceCents": 550,
    "description": "Published all-beef kosher hotdog served in a bun.",
    "aliases": [
      "kosher beef hotdog",
      "hotdog in bun",
      "beef hotdog"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_shawarma_rice_bowl",
    "locationId": "82",
    "label": "Shawarma Rice Bowl",
    "category": "mains",
    "priceCents": 1195,
    "description": "Falafel with hummus, chopped salad, cabbage, pickles and tahini.",
    "aliases": [
      "shawarma rice bowl",
      "shawarma bowl"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_falafel_rice_bowl",
    "locationId": "82",
    "label": "Falafel Rice Bowl",
    "category": "mains",
    "priceCents": 995,
    "description": "Rice, falafel, chickpeas, tomatoes, cucumbers, parsley, tahini and curried mango amba.",
    "aliases": [
      "falafel rice bowl",
      "falafel bowl"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_spicy_beef_hummus_pita",
    "locationId": "82",
    "label": "Spicy Beef Hummus Bowl (Pita)",
    "category": "mains",
    "priceCents": 1095,
    "description": "Spicy beef, caramelized onion marmalade and tahini over hummus, with pita.",
    "aliases": [
      "spicy beef hummus bowl pita"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_spicy_beef_hummus_gluten_free_wrap",
    "locationId": "82",
    "label": "Spicy Beef Hummus Bowl (Gluten-Free Wrap)",
    "category": "mains",
    "priceCents": 1095,
    "description": "Spicy beef, caramelized onion marmalade and tahini over hummus, with gluten-free wrap.",
    "aliases": [
      "spicy beef hummus bowl gluten-free wrap"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_sabich_eggplant_hummus_pita",
    "locationId": "82",
    "label": "Sabich Eggplant Hummus Bowl (Pita)",
    "category": "mains",
    "priceCents": 925,
    "description": "Fried eggplant, tahini and parsley over hummus, with pita.",
    "aliases": [
      "sabich eggplant hummus bowl pita"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_sabich_eggplant_hummus_gluten_free_wrap",
    "locationId": "82",
    "label": "Sabich Eggplant Hummus Bowl (Gluten-Free Wrap)",
    "category": "mains",
    "priceCents": 925,
    "description": "Fried eggplant, tahini and parsley over hummus, with gluten-free wrap.",
    "aliases": [
      "sabich eggplant hummus bowl gluten-free wrap"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_israeli_salad_hummus_pita",
    "locationId": "82",
    "label": "Israeli Chopped Salad Hummus Bowl (Pita)",
    "category": "mains",
    "priceCents": 925,
    "description": "Israeli chopped salad over hummus, with pita.",
    "aliases": [
      "israeli chopped salad hummus bowl pita"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_israeli_salad_hummus_gluten_free_wrap",
    "locationId": "82",
    "label": "Israeli Chopped Salad Hummus Bowl (Gluten-Free Wrap)",
    "category": "mains",
    "priceCents": 925,
    "description": "Israeli chopped salad over hummus, with gluten-free wrap.",
    "aliases": [
      "israeli chopped salad hummus bowl gluten-free wrap"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_dirty_fries_to_share",
    "locationId": "82",
    "label": "Dirty Fries to Share",
    "category": "mains",
    "priceCents": 1695,
    "description": "Shawarma, fries, Israeli salad, amba, schug, tahini and parsley. Published sharing portion.",
    "aliases": [
      "dirty fries to share",
      "dirty fries"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_israeli_chopped_salad_side",
    "locationId": "82",
    "label": "Israeli Chopped Salad (Side)",
    "category": "sides",
    "priceCents": 450,
    "description": "Published standalone salad side; portion not specified.",
    "aliases": [
      "israeli chopped salad (side)",
      "israeli chopped salad"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_zahtar_pita_fries",
    "locationId": "82",
    "label": "Zahtar Pita Fries",
    "category": "sides",
    "priceCents": 400,
    "description": "Published standalone pita-fries side; portion not specified.",
    "aliases": [
      "zahtar pita fries",
      "zahtar pita fries"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_french_fries",
    "locationId": "82",
    "label": "French Fries",
    "category": "sides",
    "priceCents": 400,
    "description": "Published standalone fries side; portion not specified.",
    "aliases": [
      "french fries",
      "french fries"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_grape_leaves_3",
    "locationId": "82",
    "label": "Grape Leaves (3)",
    "category": "sides",
    "priceCents": 325,
    "description": "Published three-piece grape-leaf side.",
    "aliases": [
      "grape leaves (3)",
      "grape leaves"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_pita_side",
    "locationId": "82",
    "label": "Pita (Side)",
    "category": "sides",
    "priceCents": 200,
    "description": "Published standalone pita side.",
    "aliases": [
      "pita (side)",
      "pita"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_seasonal_fruit",
    "locationId": "82",
    "label": "Seasonal Fruit",
    "category": "sides",
    "priceCents": 150,
    "description": "Published seasonal fruit side; current variety and portion are not specified.",
    "aliases": [
      "seasonal fruit",
      "seasonal fruit"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_baklava",
    "locationId": "82",
    "label": "Baklava",
    "category": "sides",
    "priceCents": 450,
    "description": "Published baklava; portion not specified.",
    "aliases": [
      "baklava",
      "baklava"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_chips",
    "locationId": "82",
    "label": "Chips",
    "category": "sides",
    "priceCents": 150,
    "description": "Published chips; brand, flavor and package size are not specified.",
    "aliases": [
      "chips",
      "chips"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_82_water",
    "locationId": "82",
    "label": "Water",
    "category": "drinks",
    "priceCents": 195,
    "description": "Published water; container size and brand are not specified.",
    "aliases": [
      "water"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_174_steamed-pork-bao-bun",
    "locationId": "174",
    "label": "Steamed Pork Bao Bun",
    "category": "sides",
    "priceCents": 419,
    "description": "Steamed bao bun with pork filling; one bun.",
    "aliases": [
      "steamed pork bao bun"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_fried-pork-bao-bun",
    "locationId": "174",
    "label": "Fried Pork Bao Bun",
    "category": "sides",
    "priceCents": 499,
    "description": "Fried bao bun with pork filling; one bun.",
    "aliases": [
      "fried pork bao bun"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_steamed-red-bean-bao-bun",
    "locationId": "174",
    "label": "Steamed Red Bean Bao Bun",
    "category": "sides",
    "priceCents": 419,
    "description": "Steamed bao bun with red bean filling; one bun.",
    "aliases": [
      "steamed red bean bao bun"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_fried-red-bean-bao-bun",
    "locationId": "174",
    "label": "Fried Red Bean Bao Bun",
    "category": "sides",
    "priceCents": 499,
    "description": "Fried bao bun with red bean filling; one bun.",
    "aliases": [
      "fried red bean bao bun"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_milk-tea-original",
    "locationId": "174",
    "label": "Milk Tea — Original",
    "category": "drinks",
    "priceCents": 669,
    "description": "Base milk tea, without paid bubbles; size not printed.",
    "aliases": [
      "milk tea — original"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_milk-tea-taro",
    "locationId": "174",
    "label": "Milk Tea — Taro",
    "category": "drinks",
    "priceCents": 669,
    "description": "Base milk tea, without paid bubbles; size not printed.",
    "aliases": [
      "milk tea — taro"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_milk-tea-brown-sugar",
    "locationId": "174",
    "label": "Milk Tea — Brown Sugar",
    "category": "drinks",
    "priceCents": 669,
    "description": "Base milk tea, without paid bubbles; size not printed.",
    "aliases": [
      "milk tea — brown sugar"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_milk-tea-matcha",
    "locationId": "174",
    "label": "Milk Tea — Matcha",
    "category": "drinks",
    "priceCents": 669,
    "description": "Base milk tea, without paid bubbles; size not printed.",
    "aliases": [
      "milk tea — matcha"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_milk-tea-coffee",
    "locationId": "174",
    "label": "Milk Tea — Coffee",
    "category": "drinks",
    "priceCents": 669,
    "description": "Base milk tea, without paid bubbles; size not printed.",
    "aliases": [
      "milk tea — coffee"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_milk-tea-thai-tea",
    "locationId": "174",
    "label": "Milk Tea — Thai Tea",
    "category": "drinks",
    "priceCents": 669,
    "description": "Base milk tea, without paid bubbles; size not printed.",
    "aliases": [
      "milk tea — thai tea"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_milk-tea-mango",
    "locationId": "174",
    "label": "Milk Tea — Mango",
    "category": "drinks",
    "priceCents": 669,
    "description": "Base milk tea, without paid bubbles; size not printed.",
    "aliases": [
      "milk tea — mango"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_milk-tea-honeydew",
    "locationId": "174",
    "label": "Milk Tea — Honeydew",
    "category": "drinks",
    "priceCents": 669,
    "description": "Base milk tea, without paid bubbles; size not printed.",
    "aliases": [
      "milk tea — honeydew"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_milk-tea-rose",
    "locationId": "174",
    "label": "Milk Tea — Rose",
    "category": "drinks",
    "priceCents": 669,
    "description": "Base milk tea, without paid bubbles; size not printed.",
    "aliases": [
      "milk tea — rose"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_milk-tea-strawberry",
    "locationId": "174",
    "label": "Milk Tea — Strawberry",
    "category": "drinks",
    "priceCents": 669,
    "description": "Base milk tea, without paid bubbles; size not printed.",
    "aliases": [
      "milk tea — strawberry"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_fruit-tea-peach",
    "locationId": "174",
    "label": "Fruit Tea — Peach",
    "category": "drinks",
    "priceCents": 639,
    "description": "Base fruit tea, without paid bubbles; size not printed.",
    "aliases": [
      "fruit tea — peach"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_fruit-tea-lychee",
    "locationId": "174",
    "label": "Fruit Tea — Lychee",
    "category": "drinks",
    "priceCents": 639,
    "description": "Base fruit tea, without paid bubbles; size not printed.",
    "aliases": [
      "fruit tea — lychee"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_fruit-tea-mango",
    "locationId": "174",
    "label": "Fruit Tea — Mango",
    "category": "drinks",
    "priceCents": 639,
    "description": "Base fruit tea, without paid bubbles; size not printed.",
    "aliases": [
      "fruit tea — mango"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_fruit-tea-honeydew",
    "locationId": "174",
    "label": "Fruit Tea — Honeydew",
    "category": "drinks",
    "priceCents": 639,
    "description": "Base fruit tea, without paid bubbles; size not printed.",
    "aliases": [
      "fruit tea — honeydew"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_fruit-tea-rose",
    "locationId": "174",
    "label": "Fruit Tea — Rose",
    "category": "drinks",
    "priceCents": 639,
    "description": "Base fruit tea, without paid bubbles; size not printed.",
    "aliases": [
      "fruit tea — rose"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_fruit-tea-strawberry",
    "locationId": "174",
    "label": "Fruit Tea — Strawberry",
    "category": "drinks",
    "priceCents": 639,
    "description": "Base fruit tea, without paid bubbles; size not printed.",
    "aliases": [
      "fruit tea — strawberry"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_174_water",
    "locationId": "174",
    "label": "Water",
    "category": "drinks",
    "priceCents": 229,
    "description": "Listed water; standalone serving size not printed.",
    "aliases": [
      "water"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_155_mini-orange-chicken-bowl",
    "locationId": "155",
    "label": "Mini Orange Chicken Bowl",
    "category": "mains",
    "priceCents": 839,
    "description": "Named item in the Ultimate Mini Hot Bowls section.",
    "aliases": [
      "mini orange chicken bowl"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_155_mini-teriyaki-chicken-bowl",
    "locationId": "155",
    "label": "Mini Teriyaki Chicken Bowl",
    "category": "mains",
    "priceCents": 839,
    "description": "Named item in the Ultimate Mini Hot Bowls section.",
    "aliases": [
      "mini teriyaki chicken bowl"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_155_mini-spicy-teriyaki-chicken-bowl",
    "locationId": "155",
    "label": "Mini Spicy Teriyaki Chicken Bowl",
    "category": "mains",
    "priceCents": 839,
    "description": "Named item in the Ultimate Mini Hot Bowls section.",
    "aliases": [
      "mini spicy teriyaki chicken bowl"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_155_mini-asian-bbq-beef-bowl",
    "locationId": "155",
    "label": "Mini Asian BBQ Beef Bowl",
    "category": "mains",
    "priceCents": 839,
    "description": "Named item in the Ultimate Mini Hot Bowls section.",
    "aliases": [
      "mini asian bbq beef bowl"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_155_mini-tofu-bowl",
    "locationId": "155",
    "label": "Mini Tofu Bowl",
    "category": "mains",
    "priceCents": 839,
    "description": "Named item in the Ultimate Mini Hot Bowls section.",
    "aliases": [
      "mini tofu bowl"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_155_mini-sesame-chicken-bowl",
    "locationId": "155",
    "label": "Mini Sesame Chicken Bowl",
    "category": "mains",
    "priceCents": 839,
    "description": "Named item in the Ultimate Mini Hot Bowls section.",
    "aliases": [
      "mini sesame chicken bowl"
    ],
    "sourcePage": 1
  },
  {
    "id": "cmu_155_strawberry-matcha-latte",
    "locationId": "155",
    "label": "Strawberry Matcha Latte",
    "category": "drinks",
    "priceCents": 839,
    "description": "Strawberry, matcha and whole milk; size not printed.",
    "aliases": [
      "strawberry matcha latte"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_155_signature-boba-milk-tea",
    "locationId": "155",
    "label": "Signature Boba Milk Tea",
    "category": "drinks",
    "priceCents": 719,
    "description": "Black sugar, Assam tea, half-and-half and honey boba; size not printed.",
    "aliases": [
      "signature boba milk tea"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_155_muddy-boba-latte",
    "locationId": "155",
    "label": "Muddy Boba Latte",
    "category": "drinks",
    "priceCents": 769,
    "description": "Tiger sugar, whole milk and honey boba; size not printed.",
    "aliases": [
      "muddy boba latte"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_155_blue-ocean-yogurt",
    "locationId": "155",
    "label": "Blue Ocean Yogurt",
    "category": "drinks",
    "priceCents": 769,
    "description": "Butterfly pea tea, yogurt and peach popping boba; size not printed.",
    "aliases": [
      "blue ocean yogurt"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_155_citrus-butterfly-tea",
    "locationId": "155",
    "label": "Citrus Butterfly Tea",
    "category": "drinks",
    "priceCents": 769,
    "description": "Lemonade, butterfly pea tea and crystal boba; size not printed.",
    "aliases": [
      "citrus butterfly tea"
    ],
    "sourcePage": 2
  },
  {
    "id": "cmu_155_bubbly-strawberry-refresher",
    "locationId": "155",
    "label": "Bubbly Strawberry Refresher",
    "category": "drinks",
    "priceCents": 769,
    "description": "Sparkling water, strawberry syrup and crystal boba; size not printed.",
    "aliases": [
      "bubbly strawberry refresher"
    ],
    "sourcePage": 2
  }
] as const;

export const ACTIVE_DINING_LOCATIONS = ACTIVE_LOCATION_IDS.map(id => DINING_LOCATIONS.find(location => location.id === id)!);
export const UNPRICED_MENU_ITEMS: readonly { locationId: string; label: string; description: string; priceCents?: number; sourceUrl?: string; sourcePage?: number | null; sourceSha256?: string | null }[] = [
  {
    "locationId": "113",
    "label": "The Good Egg",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 1,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Power Protein Wrap",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 1,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Egg Whites & Cheddar",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 1,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Egg Whites, Cheddar & Avocado",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 1,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Newport Turkey",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Toasted Chicken & Avocado",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Extra Bacon BLT",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Chipotle Black Bean Burger with Avocado",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Country Grilled Cheese",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Smoky BBQ Chicken Melt",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Chipotle Turkey & Avocado",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Caprese",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Caprese with Chicken",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Ham & Two Cheese",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Turkey Club",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Chicken Cobb Avocado Salad",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Southwest Chicken Salad",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Chicken Caesar Asiago Salad",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Caesar Salad without Chicken",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Mediterranean Salad",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "ABP’s Original Chicken Salad Sandwich",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Classic Tuna Salad Sandwich",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Napa Chicken with Avocado Wrap",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Chicken Caesar Wrap",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Mediterranean Wrap",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 2,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Plain Croissant",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 1,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Chocolate Croissant",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 1,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Almond Croissant",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 1,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Blueberry Muffin",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 1,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "113",
    "label": "Chocolate Chip Cookie",
    "description": "Price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf",
    "sourcePage": 1,
    "sourceSha256": "5f8d101f928618550119e287333f6e0928028a9efe748a439435d2f91e8b07bc"
  },
  {
    "locationId": "179",
    "label": "Seed Funding",
    "description": "Only a starting-price heading is published; fixed total unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/179/Capital Grains Menu F25.pdf",
    "sourcePage": 1,
    "sourceSha256": "8831f0672b1202be58aaa5eb131eeae30bb73d23131820376cc8b42f0dd300d6"
  },
  {
    "locationId": "179",
    "label": "Return On Ingredients",
    "description": "Only a starting-price heading is published; fixed total unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/179/Capital Grains Menu F25.pdf",
    "sourcePage": 1,
    "sourceSha256": "8831f0672b1202be58aaa5eb131eeae30bb73d23131820376cc8b42f0dd300d6"
  },
  {
    "locationId": "179",
    "label": "Greek Options",
    "description": "Only a starting-price heading is published; fixed total unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/179/Capital Grains Menu F25.pdf",
    "sourcePage": 1,
    "sourceSha256": "8831f0672b1202be58aaa5eb131eeae30bb73d23131820376cc8b42f0dd300d6"
  },
  {
    "locationId": "179",
    "label": "Capital Greens",
    "description": "Only a starting-price heading is published; fixed total unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/179/Capital Grains Menu F25.pdf",
    "sourcePage": 1,
    "sourceSha256": "8831f0672b1202be58aaa5eb131eeae30bb73d23131820376cc8b42f0dd300d6"
  },
  {
    "locationId": "179",
    "label": "Market Mix",
    "description": "Only a starting-price heading is published; fixed total unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/179/Capital Grains Menu F25.pdf",
    "sourcePage": 1,
    "sourceSha256": "8831f0672b1202be58aaa5eb131eeae30bb73d23131820376cc8b42f0dd300d6"
  },
  {
    "locationId": "179",
    "label": "Build Your Own Bowl",
    "description": "Requires base, toppings, protein and dressing choices; fixed total unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/179/Capital Grains Menu F25.pdf",
    "sourcePage": 2,
    "sourceSha256": "8831f0672b1202be58aaa5eb131eeae30bb73d23131820376cc8b42f0dd300d6"
  },
  {
    "locationId": "108",
    "label": "All-you-care-to-eat dining",
    "description": "Dining format or rotating station; admission price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/108",
    "sourcePage": null,
    "sourceSha256": null
  },
  {
    "locationId": "108",
    "label": "Rotating hot entrees",
    "description": "Dining format or rotating station; admission price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/108",
    "sourcePage": null,
    "sourceSha256": null
  },
  {
    "locationId": "108",
    "label": "Vegan and vegetarian options",
    "description": "Dining format or rotating station; admission price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/108",
    "sourcePage": null,
    "sourceSha256": null
  },
  {
    "locationId": "108",
    "label": "Soup and salad",
    "description": "Dining format or rotating station; admission price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/108",
    "sourcePage": null,
    "sourceSha256": null
  },
  {
    "locationId": "108",
    "label": "Made-to-order sandwiches",
    "description": "Dining format or rotating station; admission price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/108",
    "sourcePage": null,
    "sourceSha256": null
  },
  {
    "locationId": "108",
    "label": "Beverages and desserts",
    "description": "Dining format or rotating station; admission price unavailable.",
    "sourceUrl": "https://apps.studentaffairs.cmu.edu/dining/conceptinfo/Concept/108",
    "sourcePage": null,
    "sourceSha256": null
  },
  {
    "locationId": "110",
    "label": "Braised Tofu in Brown Sauce",
    "description": "Includes a side; available side choices need confirmation.",
    "priceCents": 895
  },
  {
    "locationId": "110",
    "label": "Eggplant with Garlic Sauce",
    "description": "Includes a side; available side choices need confirmation.",
    "priceCents": 895
  },
  {
    "locationId": "110",
    "label": "Stir-Fried Veggies",
    "description": "Includes a side; available side choices need confirmation.",
    "priceCents": 995
  },
  {
    "locationId": "110",
    "label": "General Tso's Chicken",
    "description": "Includes a side; available side choices need confirmation.",
    "priceCents": 1095
  },
  {
    "locationId": "110",
    "label": "Chicken Teriyaki",
    "description": "Includes a side; available side choices need confirmation.",
    "priceCents": 1095
  },
  {
    "locationId": "110",
    "label": "Stir-Fried Spicy Chicken",
    "description": "Includes a side; available side choices need confirmation.",
    "priceCents": 1095
  },
  {
    "locationId": "110",
    "label": "Braised Fish & Mapo Tofu",
    "description": "Includes a side; available side choices need confirmation.",
    "priceCents": 1195
  },
  {
    "locationId": "110",
    "label": "Pork Ribs with Black Bean Sauce",
    "description": "Includes a side; available side choices need confirmation.",
    "priceCents": 1295
  }
];

export const ACTIVE_CAMPUS_ITEMS = CAMPUS_ITEMS.filter(item => ACTIVE_LOCATION_IDS.some(id => id === item.locationId));
