// Pure, client-safe helpers over a loaded Catalog value. Indexes are memoised
// per catalog object; nothing here reads the environment or the network.
import { z } from "zod";
import {
  KIOSK_DEFAULT_LOCATION_ID,
  LocationIdSchema,
  ParseRequestSchema,
  type Catalog,
  type CatalogItem,
  type CatalogLocation,
  type CatalogModifier,
  type CatalogPreview,
  type ModifierId,
} from "@/contracts";

export type CatalogIndex = {
  readonly catalog: Catalog;
  item(id: string): CatalogItem | undefined;
  location(id: string): CatalogLocation | undefined;
  modifier(id: ModifierId): CatalogModifier | undefined;
  itemsForLocation(locationId: string): readonly CatalogItem[];
  previewsForLocation(locationId: string): readonly CatalogPreview[];
  locationName(locationId: string): string;
  /** Demo items show their label only; campus items add their counter name. */
  fullItemLabel(itemId: string): string;
  /** Ranked shortlist in display order (activeRank ascending). */
  readonly activeLocations: readonly CatalogLocation[];
  readonly activeLocationIds: readonly string[];
  /**
   * Locations the public kiosk may order from: the ranked shortlist plus the
   * fictional Demo Counter, which is deliberately orderable for the meal and
   * ingredient demonstration while staying out of the ranked list.
   */
  readonly publicLocationIds: readonly string[];
  readonly itemIds: readonly string[];
};

const DEMO_LOCATION_ID = "demo";

const EMPTY_ITEMS: readonly CatalogItem[] = Object.freeze([]);
const EMPTY_PREVIEWS: readonly CatalogPreview[] = Object.freeze([]);
const INDEXES = new WeakMap<Catalog, CatalogIndex>();

export function indexCatalog(catalog: Catalog): CatalogIndex {
  const cached = INDEXES.get(catalog);
  if (cached) return cached;
  const items = new Map(catalog.items.map((item) => [item.id, item] as const));
  const locations = new Map(catalog.locations.map((location) => [location.id, location] as const));
  const modifiers = new Map(catalog.modifiers.map((modifier) => [modifier.id, modifier] as const));
  const itemsByLocation = new Map<string, CatalogItem[]>();
  for (const item of catalog.items) itemsByLocation.set(item.locationId, [...(itemsByLocation.get(item.locationId) ?? []), item]);
  const previewsByLocation = new Map<string, CatalogPreview[]>();
  for (const preview of catalog.previews) previewsByLocation.set(preview.locationId, [...(previewsByLocation.get(preview.locationId) ?? []), preview]);
  const activeLocations = Object.freeze(
    catalog.locations.filter((location) => location.activeRank !== null).sort((a, b) => (a.activeRank ?? 0) - (b.activeRank ?? 0)),
  );
  const activeLocationIds = Object.freeze(activeLocations.map((location) => location.id));
  const publicLocationIds = Object.freeze([
    ...activeLocationIds,
    ...(locations.has(DEMO_LOCATION_ID) && !activeLocationIds.includes(DEMO_LOCATION_ID) ? [DEMO_LOCATION_ID] : []),
  ]);
  const locationName = (locationId: string) => locations.get(locationId)?.name ?? "Unknown location";
  const index: CatalogIndex = {
    catalog,
    item: (id) => items.get(id),
    location: (id) => locations.get(id),
    modifier: (id) => modifiers.get(id),
    itemsForLocation: (locationId) => itemsByLocation.get(locationId) ?? EMPTY_ITEMS,
    previewsForLocation: (locationId) => previewsByLocation.get(locationId) ?? EMPTY_PREVIEWS,
    locationName,
    fullItemLabel: (itemId) => {
      const item = items.get(itemId);
      if (!item) return itemId;
      return item.locationId === DEMO_LOCATION_ID ? item.label : `${item.label} · ${locationName(item.locationId)}`;
    },
    activeLocations,
    activeLocationIds,
    publicLocationIds,
    itemIds: Object.freeze(catalog.items.map((item) => item.id)),
  };
  INDEXES.set(catalog, index);
  return index;
}

/** Stack'd stays the kiosk default while it is active; a catalog without it falls back to its first ranked location. */
export function defaultLocationFor(menu: CatalogIndex): string {
  return menu.activeLocationIds.includes(KIOSK_DEFAULT_LOCATION_ID) ? KIOSK_DEFAULT_LOCATION_ID : menu.activeLocationIds[0] ?? DEMO_LOCATION_ID;
}

function buildPublicParseRequestSchema(catalog: Catalog) {
  const menu = indexCatalog(catalog);
  const publicLocations = new Set(menu.publicLocationIds);
  const publicItems = new Set(catalog.items.filter((item) => publicLocations.has(item.locationId)).map((item) => item.id));
  const defaultLocationId = defaultLocationFor(menu);
  // Public HTTP accepts only the public locations. Internal parser/core fixtures
  // retain the wider archive; no request field can enable it.
  return ParseRequestSchema.extend({
    locationId: LocationIdSchema.refine((id) => publicLocations.has(id), "Location is not in the public catalog.").default(defaultLocationId),
  }).superRefine((request, ctx) => {
    const requirements = request.context?.requirements;
    const ids = [
      ...(request.context?.lines.map((line) => line.itemId) ?? []),
      ...(requirements?.profile.exceptions.map((value) => value.itemId) ?? []),
      ...(requirements?.meal?.selections.map((value) => value.itemId) ?? []),
      ...(requirements?.meal?.lockedItemIds ?? []),
      ...(requirements?.decision?.proposedLines.map((value) => value.itemId) ?? []),
      ...(requirements?.decision?.proposedMeal?.selections.map((value) => value.itemId) ?? []),
      ...(request.context?.pending?.choices.flatMap((choice) => choice.ops.flatMap((op) => op.type === "ADD" ? [op.itemId] : "ref" in op && op.ref.by === "item" ? [op.ref.itemId] : [])) ?? []),
    ];
    const locations = [requirements?.locationId, requirements?.meal?.locationId, requirements?.decision?.nextLocationId, requirements?.decision?.proposedMeal?.locationId]
      .filter((value): value is string => value !== undefined);
    if (locations.some((id) => !publicLocations.has(id))) ctx.addIssue({ code: "custom", message: "Requirement context contains a restaurant outside the active catalog." });
    if (ids.some((id) => !publicItems.has(id))) ctx.addIssue({ code: "custom", message: "Cart context contains an item outside the active campus catalog." });
  });
}

export type PublicParseRequestSchema = ReturnType<typeof buildPublicParseRequestSchema>;
export type PublicParseRequest = z.infer<PublicParseRequestSchema>;

export type CatalogGuard = {
  readonly catalog: Catalog;
  readonly defaultLocationId: string;
  isItem(id: string): boolean;
  isLocation(id: string): boolean;
  /** Ranked shortlist membership. */
  isActiveLocation(id: string): boolean;
  isActiveItem(id: string): boolean;
  /** Public membership: the ranked shortlist plus the Demo Counter. */
  isPublicLocation(id: string): boolean;
  /** An item is orderable over public HTTP only at a public location. */
  isPublicItem(id: string): boolean;
  readonly publicParseRequestSchema: PublicParseRequestSchema;
};

const GUARDS = new WeakMap<Catalog, CatalogGuard>();

export function catalogGuard(catalog: Catalog): CatalogGuard {
  const cached = GUARDS.get(catalog);
  if (cached) return cached;
  const menu = indexCatalog(catalog);
  const active = new Set(menu.activeLocationIds);
  const publicLocations = new Set(menu.publicLocationIds);
  const guard: CatalogGuard = {
    catalog,
    defaultLocationId: defaultLocationFor(menu),
    isItem: (id) => menu.item(id) !== undefined,
    isLocation: (id) => menu.location(id) !== undefined,
    isActiveLocation: (id) => active.has(id),
    isActiveItem: (id) => { const item = menu.item(id); return item !== undefined && active.has(item.locationId); },
    isPublicLocation: (id) => publicLocations.has(id),
    isPublicItem: (id) => { const item = menu.item(id); return item !== undefined && publicLocations.has(item.locationId); },
    publicParseRequestSchema: buildPublicParseRequestSchema(catalog),
  };
  GUARDS.set(catalog, guard);
  return guard;
}

function freezeDeep<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
  return Object.freeze(value);
}

/** Catalog values are shared by reference across the engine, parsers and UI; freezing makes accidental mutation throw in strict mode. */
export function freezeCatalog(catalog: Catalog): Catalog {
  return freezeDeep(catalog);
}
