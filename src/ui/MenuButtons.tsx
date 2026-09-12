"use client";
import { T } from "./Language";
import { useState } from "react";
import type { Op, LocationId, DietaryProfile, ItemId } from "@/contracts";
import { UNPRICED_MENU_ITEMS } from "@/contracts/campus";
import { MENU, itemsForLocation, locationName, type MenuCategory } from "@/contracts/menu";
import styles from "./Kiosk.module.css";
import { ITEM_IDS, formatCents } from "./labels";
import { checkCompatibility } from "@/core/compatibility";
import { foodEvidenceFor } from "@/contracts/food";

export type MenuFilter = "all" | MenuCategory;

const CATEGORIES: { id: MenuCategory; label: string; icon: string }[] = [
  { id: "mains", label: "Mains", icon: "🍔" }, { id: "sides", label: "Sides", icon: "🍟" }, { id: "drinks", label: "Drinks", icon: "🥤" },
];
// The catalog fills this in when a source menu has no blurb; it says nothing, so the card omits it.
const GENERIC_DESCRIPTION = "Standard published menu item.";
const PLATE: Record<MenuCategory, string> = {
  mains: styles.plate,
  sides: `${styles.plate} ${styles.plateSides}`,
  drinks: `${styles.plate} ${styles.plateDrinks}`,
};
const ICON: Record<MenuCategory, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.icon])) as Record<MenuCategory, string>;
// No product photos exist in the catalog, so the plate carries a glyph chosen from the
// item name (first match wins); the category glyph is the fallback.
const GLYPHS: readonly [RegExp, string][] = [
  [/burger|impossible/i, "🍔"], [/wing|tender|chicken/i, "🍗"], [/pizza|flatbread/i, "🍕"], [/taco|burrito|wrap|quesadilla/i, "🌯"],
  [/salad|greens|caesar/i, "🥗"], [/bowl|rice|noodle|ramen|curry/i, "🍜"], [/soup|chili|stew/i, "🍲"], [/pasta|mac/i, "🍝"],
  [/sandwich|sub|hoagie|panini|melt|blt|club/i, "🥪"], [/cheese/i, "🧀"], [/egg|omelet/i, "🍳"], [/bagel|toast|bread|croissant|muffin/i, "🥐"],
  [/samosa|dumpling|potsticker/i, "🥟"], [/fries|tots|potato/i, "🍟"], [/onion ring/i, "🧅"], [/cookie|brownie|cake|dessert|pastry/i, "🍪"],
  [/fruit|apple|banana/i, "🍎"], [/coffee|latte|espresso|mocha/i, "☕"], [/tea|chai|matcha/i, "🍵"], [/lemonade|lemon/i, "🍋"],
  [/smoothie|shake|juice/i, "🥤"], [/water/i, "💧"], [/soda|cola|sprite|pop/i, "🥤"],
];
export function glyphFor(label: string, category: MenuCategory): string {
  return GLYPHS.find(([pattern]) => pattern.test(label))?.[1] ?? ICON[category];
}

/** Left rail: one button per category present at the location, plus "All items". */
export function CategoryRail({ locationId, value, onChange }: { locationId: LocationId; value: MenuFilter; onChange: (v: MenuFilter) => void }) {
  const present = new Set(itemsForLocation(locationId).map((item) => item.category));
  const btn = (id: MenuFilter, label: string, icon: string, disabled = false) => (
    <button
      key={id}
      type="button"
      className={`${styles.railBtn} ${value === id ? styles.railOn : ""}`}
      aria-pressed={value === id}
      disabled={disabled}
      onClick={() => onChange(id)}
    >
      <span className={styles.railIcon} aria-hidden="true"><T>{icon}</T></span>
      <T>{label}</T>
    </button>
  );
  return (
    <nav className={styles.railList} aria-label="Menu categories">
      <T>{btn("all", "All items", "★")}</T>
      <T>{CATEGORIES.map((c) => btn(c.id, c.label, c.icon, !present.has(c.id)))}</T>
    </nav>
  );
}

export function MenuButtons({ disabled, onOps, locationId = "demo", filter = "all", profile, onMealItem }: { disabled: boolean; onOps: (ops: Op[]) => void; locationId?: LocationId; filter?: MenuFilter; profile?: DietaryProfile; onMealItem?: (id: ItemId) => void }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const ids = ITEM_IDS.filter(id => MENU[id].locationId === locationId && (filter === "all" || MENU[id].category === filter) && [MENU[id].label, MENU[id].description, ...MENU[id].aliases].some(value => value.toLowerCase().includes(query)));
  const previewItems = UNPRICED_MENU_ITEMS.filter(item => item.locationId === locationId);
  const previews = previewItems.filter(item => `${item.label} ${item.description}`.toLowerCase().includes(query));
  const shown = filter === "all" ? CATEGORIES : CATEGORIES.filter((c) => c.id === filter);
  const total = itemsForLocation(locationId).length;
  const visible = ids.filter((id) => filter === "all" || MENU[id].category === filter).length;
  const hasRequirements = Boolean(profile && (profile.preference !== "none" || profile.allergies.length || profile.dislikes.length));
  const checks = new Map(ids.map(id => [id, profile ? checkCompatibility(id, [], profile) : null]));
  const matches = ids.filter(id => !checks.get(id) || checks.get(id)?.status === "match");
  const excluded = ids.filter(id => checks.get(id)?.status !== "match" && checks.get(id));
  const renderCategories = (itemIds: ItemId[]) => shown.filter(category => itemIds.some(id => MENU[id].category === category.id)).map((category) => <div key={category.id} className={styles.menuCategory}>
    <T>{filter === "all" && <h3 className={styles.categoryTitle}><T>{category.label}</T></h3>}</T>
    <div className={styles.menuGrid} role="group" aria-label={category.label}>
      <T>{itemIds.filter(id => MENU[id].category === category.id).map(id => {
        const check = checks.get(id);
        const blocked = check?.status === "unknown" || check?.staffReview === true;
        const preferenceConflict = check?.status === "conflict" && !check.staffReview;
        return <button key={id} type="button" className={`${styles.menuBtn}${blocked ? ` ${styles.menuEvidenceBlocked}` : ""}`} disabled={disabled || blocked} data-testid={`menu-${id}`}
          onClick={() => onMealItem ? onMealItem(id) : onOps([{ type: "ADD", itemId: id, qty: 1, modifiers: [] }])}>
          <span className={PLATE[category.id]} aria-hidden="true"><T>{glyphFor(MENU[id].label, category.id)}</T></span>
          <span className={styles.menuBody}>
            <span className={styles.menuItemHeading}><span><T>{MENU[id].label}</T></span><T>{!blocked && <span className={styles.menuBtnPlus} aria-hidden="true">+</span>}</T></span>
            <span className={styles.menuVendor}><T>{locationName(locationId)}</T></span>
            <T>{MENU[id].description !== GENERIC_DESCRIPTION && <span className={styles.menuDescription}><T>{MENU[id].description}</T></span>}</T>
            <T>{hasRequirements && check && <span className={`${styles.menuCompatibility} ${check.status === "match" ? styles.menuMatch : styles.menuConflict}`} data-testid={`compatibility-${id}`}><strong><T>{check.status === "match" ? "Matches recorded requirements" : check.status === "unknown" ? "Needs verification" : "Conflicts with requirements"}</T></strong><T>{check.status !== "match" && <> · <T>{check.reasons.join(" ")}</T></>}</T></span>}</T>
            <T>{!blocked && (onMealItem || preferenceConflict) && <span className={styles.menuDescription}><T>{preferenceConflict ? "Request a preference choice" : "Choose for meal"}</T></span>}</T>
            <span className={styles.menuPrice}><T>{formatCents(MENU[id].priceCents)}</T></span>
          </span>
        </button>;
      })}</T>
    </div>
  </div>);
  return (
    <section className={styles.menu} aria-label="Menu">
      <div className={styles.menuHead}>
        <h2 className={styles.panelTitle}><T>{filter === "all" ? "On the menu" : CATEGORIES.find((c) => c.id === filter)?.label}</T></h2>
        <T>{total > 0 && <span className={styles.menuCount}><T>{visible} of {total} items</T></span>}</T>
      </div>
      <T>{locationId !== "demo" && (itemsForLocation(locationId).length > 0 || previewItems.length > 0) && <label className={styles.menuSearch}><T>Find an item</T><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search this menu" type="search" /></label>}</T>
      <T>{ids.length === 0 && previews.length === 0 && <p className={styles.muted}><T>{query ? "No matching menu items. Try another name." : "Ordering is unavailable here until we have complete, verified priced configurations. Choose another location above."}</T></p>}</T>
      <T>{hasRequirements && <p className={styles.muted} data-testid="menu-match-count"><T>{matches.length} choices match the recorded requirements. This describes available evidence, not an allergy-safety guarantee.</T></p>}</T>
      <T>{renderCategories(matches)}</T>
      <T>{excluded.length > 0 && <details data-testid="excluded-menu"><summary><T>Inspect {excluded.length} conflicting or unverified choices</T></summary><p className={styles.muted}><T>Preference conflicts can request an explicit choice. Allergy conflicts and missing evidence cannot be overridden.</T></p><T>{renderCategories(excluded)}</T></details>}</T>
      <T>{hasRequirements && <details data-testid="food-evidence"><summary><T>About this dietary evidence</T></summary><p className={styles.muted}><T>{ids[0] ? foodEvidenceFor(ids[0]).provenance.explanation : "Complete ingredient and preparation evidence is unavailable."}</T></p><p className={styles.muted}><T>Ingredients and preparation are checked separately. Removing one ingredient does not establish absence of an allergen elsewhere in a recipe.</T></p></details>}</T>
      <T>{filter === "all" && previews.length > 0 && <div className={styles.menuCategory}>
        <h3 className={styles.categoryTitle}><T>Menu preview · ordering unavailable</T></h3>
        <div className={styles.menuGrid} role="group" aria-label="Menu preview">
          <T>{previews.map((item, index) => {
            const price = "priceCents" in item && typeof item.priceCents === "number" && Number.isInteger(item.priceCents) && item.priceCents > 0 ? item.priceCents : null;
            return <button key={`${item.label}-${index}`} type="button" className={styles.menuBtn} disabled data-testid={`menu-preview-${locationId}-${index}`}>
              <span className={`${styles.plate} ${styles.plateMuted}`} aria-hidden="true"><T>{glyphFor(item.label, "mains")}</T></span>
              <span className={styles.menuBody}>
                <span className={styles.menuItemHeading}><span><T>{item.label}</T></span></span>
                <span className={styles.menuDescription}><T>{item.description}</T></span>
                <span className={styles.menuPrice}><T>{price === null ? "Price unavailable" : `Published menu price: ${formatCents(price)} · Ordering unavailable`}</T></span>
              </span>
            </button>;
          })}</T>
        </div>
      </div>}</T>
    </section>
  );
}
