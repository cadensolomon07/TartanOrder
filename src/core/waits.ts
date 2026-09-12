import type { Catalog, CatalogItem, Line, LocationId, ModifierId, SwapOffer, WaitEngineConfig, WaitView } from "@/contracts";
import { indexCatalog, type CatalogIndex } from "@/catalog/lookup";

type Candidate = Omit<SwapOffer, "offerId" | "revision">;
const MAX_API_AGE_MS = 5 * 60 * 1000;

/** Freshness is evaluated against recorded input, never the machine's clock. */
function usable(config: WaitEngineConfig): boolean {
  if (!config.available) return false;
  if (config.snapshot.source === "seeded") return true;
  const age = Date.parse(config.evaluatedAt) - Date.parse(config.snapshot.asOf);
  return Number.isFinite(age) && age >= 0 && age <= MAX_API_AGE_MS;
}

/** A vendor missing from the snapshot, or an item missing from the catalog, is unknown: never zero. */
function vendorWait(config: WaitEngineConfig, vendorId: string | undefined): number | null {
  if (!usable(config) || vendorId === undefined) return null;
  const value = config.snapshot.waits[vendorId as LocationId];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Unit price from the loaded catalog. A modifier the catalog does not define is an invariant violation. */
export function unitPriceCents(menu: CatalogIndex, item: CatalogItem, modifiers: readonly ModifierId[]): number {
  return item.priceCents + modifiers.reduce((sum, id) => {
    const modifier = menu.modifier(id);
    if (!modifier) throw new Error(`INVALID_SCHEMA: modifier ${id} is not in catalog ${menu.catalog.versionId}.`);
    return sum + modifier.priceCents;
  }, 0);
}

export function deriveWaitView(lines: readonly Line[], config: WaitEngineConfig, catalog: Catalog): WaitView {
  const menu = indexCatalog(catalog);
  const lineWaits = Object.fromEntries(lines.map(line => [line.lineId, vendorWait(config, menu.item(line.itemId)?.locationId)]));
  const waits = Object.values(lineWaits);
  const known = waits.every((value): value is number => value !== null);
  return {
    snapshotId: config.snapshot.id,
    source: config.snapshot.source,
    asOf: config.snapshot.asOf,
    status: lines.length === 0 ? "empty" : known ? "known" : "unavailable",
    estimateMinutes: lines.length > 0 && known ? Math.max(...waits) : null,
    lineWaits,
  };
}

function nearby(config: WaitEngineConfig, first: string, second: string): boolean {
  return first !== second && config.nearbyPairs.some(pair =>
    pair.vendors.includes(first as LocationId) && pair.vendors.includes(second as LocationId));
}

export function transferModifiers(requested: readonly ModifierId[], supported: readonly ModifierId[]): { retained: ModifierId[]; removed: ModifierId[] } | null {
  const retained = requested.filter(modifier => supported.includes(modifier));
  const removed = requested.filter(modifier => !supported.includes(modifier));
  return removed.some(modifier => modifier.startsWith("no_") || modifier === "dressing_on_side") ? null : { retained, removed };
}

/** Only curated comparable foods at explicitly nearby counters can be candidates. */
export function swapCandidates(
  lines: readonly Line[],
  config: WaitEngineConfig,
  eligibleLineIds: readonly string[],
  catalog: Catalog,
  allowedLocationIds?: readonly LocationId[],
): Candidate[] {
  if (!usable(config)) return [];
  const menu = indexCatalog(catalog);
  const current = deriveWaitView(lines, config, catalog).estimateMinutes;
  const candidates: Candidate[] = [];
  for (const line of lines) {
    if (!eligibleLineIds.includes(line.lineId)) continue;
    // Item-specific notes must never transfer to a suggested replacement.
    if (line.note) continue;
    const original = menu.item(line.itemId);
    if (!original) continue;
    if (allowedLocationIds && !allowedLocationIds.includes(original.locationId)) continue;
    const originalWait = vendorWait(config, original.locationId);
    if (originalWait === null) continue;
    const originalPrice = unitPriceCents(menu, original, line.modifiers);
    for (const group of config.groups) {
      if (!group.itemIds.includes(line.itemId) || !group.differences[line.itemId]?.trim()) continue;
      for (const alternativeId of group.itemIds) {
        const alternative = menu.item(alternativeId);
        if (!alternative || alternativeId === line.itemId || !group.differences[alternativeId]?.trim() || !nearby(config, original.locationId, alternative.locationId)) continue;
        if (allowedLocationIds && !allowedLocationIds.includes(alternative.locationId)) continue;
        const alternativeWait = vendorWait(config, alternative.locationId);
        if (alternativeWait === null || originalWait - alternativeWait < config.swapThresholdMinutes) continue;
        // Never discard an explicit exclusion, including dressing requested separately.
        const transfer = transferModifiers(line.modifiers, alternative.allowedModifiers);
        if (!transfer) continue;
        const retainedModifiers = transfer.retained;
        const removedModifiers = transfer.removed;
        const alternativePrice = unitPriceCents(menu, alternative, retainedModifiers);
        if (Math.abs(alternativePrice - originalPrice) > config.priceToleranceCents) continue;
        const replacement: Line = { ...line, itemId: alternativeId, modifiers: retainedModifiers };
        const projected = deriveWaitView(lines.map(candidate => candidate.lineId === line.lineId ? replacement : candidate), config, catalog).estimateMinutes;
        candidates.push({
          originalLineId: line.lineId,
          waitSnapshotId: config.snapshot.id,
          quantity: line.qty,
          original: { itemId: line.itemId, vendorId: original.locationId, waitMinutes: originalWait, unitPriceCents: originalPrice },
          alternative: { itemId: alternativeId, vendorId: alternative.locationId, waitMinutes: alternativeWait, unitPriceCents: alternativePrice },
          retainedModifiers,
          removedModifiers,
          differences: [
            group.differences[line.itemId]!,
            group.differences[alternativeId]!,
            ...removedModifiers.map(modifier => `Removes ${(menu.modifier(modifier)?.label ?? modifier).toLowerCase()}.`),
          ],
          priceDifferenceCents: (alternativePrice - originalPrice) * line.qty,
          currentCartEstimateMinutes: current,
          projectedCartEstimateMinutes: projected,
          itemWaitReductionMinutes: originalWait - alternativeWait,
          cartWaitReductionMinutes: current === null || projected === null ? null : current - projected,
        });
      }
    }
  }
  return candidates.sort((first, second) =>
    (second.cartWaitReductionMinutes ?? -1) - (first.cartWaitReductionMinutes ?? -1) ||
    second.itemWaitReductionMinutes - first.itemWaitReductionMinutes ||
    first.alternative.unitPriceCents - second.alternative.unitPriceCents ||
    (first.alternative.itemId < second.alternative.itemId ? -1 : first.alternative.itemId > second.alternative.itemId ? 1 : 0) ||
    (first.originalLineId < second.originalLineId ? -1 : first.originalLineId > second.originalLineId ? 1 : 0));
}
