// The in-repo catalog as a Catalog value: the seed generator's input and the
// labelled CATALOG_SOURCE=bundled source. Server, scripts and tests only; the
// client receives the catalog as props and never imports this module.
import { CatalogSchema, MAX_MODIFIERS_PER_UNIT, type Catalog, type CatalogModifier } from "@/contracts";
import { ACTIVE_LOCATION_IDS, CAMPUS_ITEMS, DINING_LOCATIONS, DINING_SNAPSHOT, UNPRICED_MENU_ITEMS } from "@/contracts/campus";
import { DEMO_FOOD, MODIFIER_EFFECTS, unknownFoodEvidence } from "@/contracts/food";
import { DEMO_MENU, MODIFIERS } from "@/contracts/menu";
import { inferFoodEvidence, removableIngredients, removalModifierId } from "./infer-food";
import { freezeCatalog } from "./lookup";

// Bumped with the inferred dietary evidence, generated removal modifiers and the
// eight-venue shortlist (2026-09-12); the previous versions stay stored and inactive.
export const BUNDLED_VERSION_ID = "cmu-dietary-2026-09-12";

type LooseLocation = {
  id: string; name: string; location: string;
  menuUrl?: string | null; directoryMenuUrl?: string | null; detailUrl?: string | null;
  sourceSha256?: string | null; sourceNote?: string | null;
};

export const DEMO_LOCATION = Object.freeze({
  id: "demo",
  name: "Demo Counter",
  location: "Seeded demonstration counter",
  menuUrl: null,
  directoryMenuUrl: null,
  detailUrl: null,
  sourceSha256: null,
  sourceNote: "Illustrative seeded demo prices; not official CMU prices.",
  activeRank: null,
});

let cached: Catalog | null = null;

export function bundledCatalog(): Catalog {
  if (cached) return cached;
  const rank = new Map<string, number>(ACTIVE_LOCATION_IDS.map((id, index) => [id, index + 1]));
  const locations = [
    DEMO_LOCATION,
    ...(DINING_LOCATIONS as readonly LooseLocation[]).map((location) => ({
      id: location.id,
      name: location.name,
      location: location.location,
      menuUrl: location.menuUrl ?? null,
      directoryMenuUrl: location.directoryMenuUrl ?? null,
      detailUrl: location.detailUrl ?? null,
      sourceSha256: location.sourceSha256 ?? null,
      sourceNote: location.sourceNote ?? null,
      activeRank: rank.get(location.id) ?? null,
    })),
  ];
  const active = new Set<string>(ACTIVE_LOCATION_IDS);
  const menuUrls = new Map((DINING_LOCATIONS as readonly LooseLocation[]).map((location) => [location.id, location.menuUrl ?? null] as const));
  // Demo modifiers keep their fictional effects; campus removals are generated from inferred toppings.
  const modifiers = new Map<string, CatalogModifier>(Object.values(MODIFIERS).map((modifier) => [modifier.id, {
    id: modifier.id, label: modifier.label, priceCents: modifier.priceCents, effect: MODIFIER_EFFECTS[modifier.id] ?? null,
  }]));
  const generated = new Map<string, CatalogModifier>();
  const items = [
    ...Object.values(DEMO_MENU).map((item) => ({
      id: item.id, locationId: "demo", label: item.label, category: item.category, description: item.description,
      priceCents: item.priceCents, aliases: [...item.aliases], allowedModifiers: [...item.allowedModifiers], sourcePage: null,
      foodEvidence: DEMO_FOOD[item.id as keyof typeof DEMO_FOOD] ?? unknownFoodEvidence(),
    })),
    ...CAMPUS_ITEMS.map((item) => {
      const foodEvidence = inferFoodEvidence(item, menuUrls.get(item.locationId) ?? null);
      const removals = active.has(item.locationId)
        ? [...new Set(removableIngredients(foodEvidence).map((ingredient) => {
            const id = removalModifierId(ingredient.id);
            if (!modifiers.has(id) && !generated.has(id)) generated.set(id, { id, label: `No ${ingredient.label.toLowerCase()}`, priceCents: 0, effect: { remove: [ingredient.id], add: [] } });
            return id;
          }))].sort().slice(0, MAX_MODIFIERS_PER_UNIT)
        : [];
      return {
        id: item.id, locationId: item.locationId, label: item.label, category: item.category, description: item.description,
        priceCents: item.priceCents, aliases: [...item.aliases], allowedModifiers: removals, sourcePage: item.sourcePage ?? null, foodEvidence,
      };
    }),
  ];
  const previews = UNPRICED_MENU_ITEMS.map((preview) => ({
    locationId: preview.locationId, label: preview.label, description: preview.description,
    priceCents: typeof preview.priceCents === "number" ? preview.priceCents : null,
    sourceUrl: preview.sourceUrl ?? null, sourcePage: preview.sourcePage ?? null, sourceSha256: preview.sourceSha256 ?? null,
  }));
  cached = freezeCatalog(CatalogSchema.parse({
    versionId: BUNDLED_VERSION_ID,
    snapshot: { checkedAt: DINING_SNAPSHOT.checkedAt, directoryUrl: DINING_SNAPSHOT.directoryUrl, sourceRepository: DINING_SNAPSHOT.sourceRepository },
    locations, items, previews,
    modifiers: [...modifiers.values(), ...[...generated.values()].sort((a, b) => a.id.localeCompare(b.id))],
  }));
  return cached;
}
