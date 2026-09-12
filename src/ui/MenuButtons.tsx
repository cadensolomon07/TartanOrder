"use client";
import { useState } from "react";
import type { CatalogCategory, CatalogItem, DietaryProfile, ItemId, LocationId, Op } from "@/contracts";
import styles from "./Kiosk.module.css";
import { useCatalog } from "./CatalogContext";
import { formatCents } from "./labels";
import { checkCompatibility } from "@/core/compatibility";
import { foodEvidenceFor } from "@/catalog/food";
import { DietaryMarks } from "./DietaryMarks";

export type MenuFilter = "all" | CatalogCategory;

const CATEGORIES: { id: CatalogCategory; label: string; icon: string }[] = [
  { id: "mains", label: "Mains", icon: "🍔" }, { id: "sides", label: "Sides", icon: "🍟" }, { id: "drinks", label: "Drinks", icon: "🥤" },
];
// The catalog fills this in when a source menu has no blurb; it says nothing, so the card omits it.
const GENERIC_DESCRIPTION = "Standard published menu item.";
const PLATE: Record<CatalogCategory, string> = {
  mains: styles.plate,
  sides: `${styles.plate} ${styles.plateSides}`,
  drinks: `${styles.plate} ${styles.plateDrinks}`,
};
const ICON: Record<CatalogCategory, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.icon])) as Record<CatalogCategory, string>;
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
export function glyphFor(label: string, category: CatalogCategory): string {
  return GLYPHS.find(([pattern]) => pattern.test(label))?.[1] ?? ICON[category];
}

/** Left rail: one button per category present at the location, plus "All items". */
export function CategoryRail({ locationId, value, onChange }: { locationId: LocationId; value: MenuFilter; onChange: (v: MenuFilter) => void }) {
  const { menu } = useCatalog();
  const present = new Set(menu.itemsForLocation(locationId).map((item) => item.category));
  const btn = (id: MenuFilter, label: string, icon: string, disabled = false) => (
    <button
      key={id}
      type="button"
      className={`${styles.railBtn} ${value === id ? styles.railOn : ""}`}
      aria-pressed={value === id}
      disabled={disabled}
      onClick={() => onChange(id)}
    >
      <span className={styles.railIcon} aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
  return (
    <nav className={styles.railList} aria-label="Menu categories">
      {btn("all", "All items", "★")}
      {CATEGORIES.map((c) => btn(c.id, c.label, c.icon, !present.has(c.id)))}
    </nav>
  );
}

export function MenuButtons({ disabled, onOps, locationId = "demo", filter = "all", profile, onMealItem }: { disabled: boolean; onOps: (ops: Op[]) => void; locationId?: LocationId; filter?: MenuFilter; profile?: DietaryProfile; onMealItem?: (id: ItemId) => void }) {
  const { menu } = useCatalog();
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const priced = menu.itemsForLocation(locationId);
  const items = priced.filter((item) => (filter === "all" || item.category === filter) && [item.label, item.description, ...item.aliases].some((value) => value.toLowerCase().includes(query)));
  const previewItems = menu.previewsForLocation(locationId);
  const previews = previewItems.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(query));
  const shown = filter === "all" ? CATEGORIES : CATEGORIES.filter((c) => c.id === filter);
  const total = priced.length;
  const visible = items.filter((item) => filter === "all" || item.category === filter).length;
  const hasRequirements = Boolean(profile && (profile.preference !== "none" || profile.allergies.length || profile.dislikes.length));
  const checks = new Map(items.map((item) => [item.id, profile ? checkCompatibility(menu, item.id, [], profile) : null]));
  const matches = items.filter((item) => !checks.get(item.id) || checks.get(item.id)?.status === "match");
  const excluded = items.filter((item) => checks.get(item.id)?.status !== "match" && checks.get(item.id));
  const renderCategories = (list: readonly CatalogItem[]) => shown.filter((category) => list.some((item) => item.category === category.id)).map((category) => <div key={category.id} className={styles.menuCategory}>
    {filter === "all" && <h3 className={styles.categoryTitle}>{category.label}</h3>}
    <div className={styles.menuGrid} role="group" aria-label={category.label}>
      {list.filter((item) => item.category === category.id).map((item) => {
        const check = checks.get(item.id);
        const blocked = check?.status === "unknown" || check?.staffReview === true;
        const preferenceConflict = check?.status === "conflict" && !check.staffReview;
        return <button key={item.id} type="button" className={`${styles.menuBtn}${blocked ? ` ${styles.menuEvidenceBlocked}` : ""}`} disabled={disabled || blocked} data-testid={`menu-${item.id}`}
          onClick={() => onMealItem ? onMealItem(item.id) : onOps([{ type: "ADD", itemId: item.id, qty: 1, modifiers: [] }])}>
          <span className={PLATE[category.id]} aria-hidden="true">{glyphFor(item.label, category.id)}</span>
          <span className={styles.menuBody}>
            <span className={styles.menuItemHeading}><span>{item.label}</span>{!blocked && <span className={styles.menuBtnPlus} aria-hidden="true">+</span>}</span>
            <span className={styles.menuVendor}>{menu.locationName(locationId)}</span>
            {item.description !== GENERIC_DESCRIPTION && <span className={styles.menuDescription}>{item.description}</span>}
            <DietaryMarks evidence={item.foodEvidence} compact />
            {hasRequirements && check && <span className={`${styles.menuCompatibility} ${check.status === "match" ? styles.menuMatch : styles.menuConflict}`} data-testid={`compatibility-${item.id}`}><strong>{check.status === "match" ? "Matches recorded requirements" : check.status === "unknown" ? "Needs verification" : "Conflicts with requirements"}</strong>{check.status !== "match" && <> · {check.reasons.join(" ")}</>}</span>}
            {!blocked && (onMealItem || preferenceConflict) && <span className={styles.menuDescription}>{preferenceConflict ? "Request a preference choice" : "Choose for meal"}</span>}
            <span className={styles.menuPrice}>{formatCents(item.priceCents)}</span>
          </span>
        </button>;
      })}
    </div>
  </div>);
  const first = items[0];
  const inferred = priced.some((item) => item.foodEvidence.provenance.kind === "inferred_campus");
  return (
    <section className={styles.menu} aria-label="Menu">
      <div className={styles.menuHead}>
        <h2 className={styles.panelTitle}>{filter === "all" ? "On the menu" : CATEGORIES.find((c) => c.id === filter)?.label}</h2>
        {total > 0 && <span className={styles.menuCount}>{visible} of {total} items</span>}
      </div>
      {inferred && <p className={styles.muted} data-testid="inference-note">Ingredient marks are inferred from the published names and descriptions and are not verified; missing ingredients are not confirmed.</p>}
      {locationId !== "demo" && (priced.length > 0 || previewItems.length > 0) && <label className={styles.menuSearch}>Find an item<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this menu" type="search" /></label>}
      {items.length === 0 && previews.length === 0 && <p className={styles.muted}>{query ? "No matching menu items. Try another name." : "Ordering is unavailable here until we have complete, verified priced configurations. Choose another location above."}</p>}
      {hasRequirements && <p className={styles.muted} data-testid="menu-match-count">{matches.length} choices match the recorded requirements. This describes available evidence, not an allergy-safety guarantee.</p>}
      {renderCategories(matches)}
      {excluded.length > 0 && <details data-testid="excluded-menu"><summary>Inspect {excluded.length} conflicting or unverified choices</summary><p className={styles.muted}>Preference conflicts can request an explicit choice. Allergy conflicts and missing evidence cannot be overridden.</p>{renderCategories(excluded)}</details>}
      {hasRequirements && <details data-testid="food-evidence"><summary>About this dietary evidence</summary><p className={styles.muted}>{first ? foodEvidenceFor(menu, first.id).provenance.explanation : "Complete ingredient and preparation evidence is unavailable."}</p><p className={styles.muted}>Ingredients and preparation are checked separately. Removing one ingredient does not establish absence of an allergen elsewhere in a recipe.</p></details>}
      {filter === "all" && previews.length > 0 && <div className={styles.menuCategory}>
        <h3 className={styles.categoryTitle}>Menu preview · ordering unavailable</h3>
        <div className={styles.menuGrid} role="group" aria-label="Menu preview">
          {previews.map((item, index) => {
            const price = typeof item.priceCents === "number" && Number.isInteger(item.priceCents) && item.priceCents > 0 ? item.priceCents : null;
            return <button key={`${item.label}-${index}`} type="button" className={styles.menuBtn} disabled data-testid={`menu-preview-${locationId}-${index}`}>
              <span className={`${styles.plate} ${styles.plateMuted}`} aria-hidden="true">{glyphFor(item.label, "mains")}</span>
              <span className={styles.menuBody}>
                <span className={styles.menuItemHeading}><span>{item.label}</span></span>
                <span className={styles.menuDescription}>{item.description}</span>
                <span className={styles.menuPrice}>{price === null ? "Price unavailable" : `Published menu price: ${formatCents(price)} · Ordering unavailable`}</span>
              </span>
            </button>;
          })}
        </div>
      </div>}
    </section>
  );
}
