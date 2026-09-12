import type { SwapOffer, UiAction, WaitView } from "@/contracts";
import { MENU, locationName } from "@/contracts/menu";
import { formatCents, MODIFIER_LABEL } from "./labels";
import { WaitSource } from "./WaitEstimate";
import styles from "./Kiosk.module.css";

function priceChange(offer: SwapOffer): string {
  const difference = offer.priceDifferenceCents;
  return difference === 0 ? `Same price for ${offer.quantity}.` : `${formatCents(Math.abs(difference))} ${difference > 0 ? "more" : "less"} for ${offer.quantity}.`;
}

function cartChange(offer: SwapOffer): string {
  if (offer.currentCartEstimateMinutes === null || offer.projectedCartEstimateMinutes === null || offer.cartWaitReductionMinutes === null) return "The complete order estimate is unavailable; no whole-order wait reduction is claimed.";
  if (offer.cartWaitReductionMinutes > 0) return `Whole-cart estimated preparation wait: ${offer.currentCartEstimateMinutes} → ${offer.projectedCartEstimateMinutes} min (${offer.cartWaitReductionMinutes} min less).`;
  return `Whole-cart estimated preparation wait stays ${offer.projectedCartEstimateMinutes} min. This item is faster, but the complete order is not.`;
}

export function swapOfferToSpeech(offer: SwapOffer, source: WaitView["source"]): string {
  return [
    source === "seeded" ? "Simulated wait times." : "Estimated preparation waits.",
    `You could switch ${offer.quantity} ${MENU[offer.original.itemId].label} from ${locationName(offer.original.vendorId)} to ${MENU[offer.alternative.itemId].label} at ${locationName(offer.alternative.vendorId)}.`,
    `This item's preparation wait would go from ${offer.original.waitMinutes} to ${offer.alternative.waitMinutes} minutes.`,
    cartChange(offer).replace("→", "to"), priceChange(offer),
    ...offer.differences,
    offer.retainedModifiers.length ? `Keeps ${offer.retainedModifiers.map((id) => MODIFIER_LABEL[id]).join(", ")}.` : "",
    offer.removedModifiers.length ? `Removes ${offer.removedModifiers.map((id) => MODIFIER_LABEL[id]).join(", ")}.` : "",
    "Choose Switch to accept, or Keep it to leave your order unchanged.",
  ].filter(Boolean).join(" ");
}

export function SwapOfferPanel({ offer, source, disabled, onAction }: { offer: SwapOffer; source: WaitView["source"]; disabled: boolean; onAction(action: UiAction): void }) {
  const vendor = locationName(offer.alternative.vendorId);
  return <section className={styles.swapOffer} data-testid="swap-offer" aria-label="Faster item option">
    <h3>A quicker option for this item</h3>
    <p><strong>{offer.quantity}× {MENU[offer.alternative.itemId].label}</strong> at <strong>{vendor}</strong></p>
    <p>Instead of {MENU[offer.original.itemId].label} at {locationName(offer.original.vendorId)}.</p>
    <p>Item preparation wait: <strong>{offer.original.waitMinutes} → {offer.alternative.waitMinutes} min</strong>. <WaitSource source={source} /></p>
    <p data-testid="swap-cart-change">{cartChange(offer)} <WaitSource source={source} /></p>
    <p data-testid="swap-price-change"><strong>{priceChange(offer)}</strong> Price each: {formatCents(offer.original.unitPriceCents)} → {formatCents(offer.alternative.unitPriceCents)}.</p>
    {offer.differences.length > 0 && <ul>{offer.differences.map((difference, index) => <li key={`${index}:${difference}`}>{difference}</li>)}</ul>}
    {offer.retainedModifiers.length > 0 && <p>Keeps: {offer.retainedModifiers.map((id) => MODIFIER_LABEL[id]).join(", ")}.</p>}
    {offer.removedModifiers.length > 0 && <p><strong>Removes: {offer.removedModifiers.map((id) => MODIFIER_LABEL[id]).join(", ")}.</strong></p>}
    <div className={styles.swapActions}>
      <button type="button" className={styles.primaryBtn} disabled={disabled} data-testid="accept-swap" onClick={() => onAction({ type: "ACCEPT_SWAP", offerId: offer.offerId, revision: offer.revision })}>Switch to {vendor}</button>
      <button type="button" className={styles.secondaryBtn} disabled={disabled} data-testid="decline-swap" onClick={() => onAction({ type: "DECLINE_SWAP", offerId: offer.offerId })}>Keep it</button>
    </div>
    <p className={styles.muted}>Preparation only; excludes walking and pickup travel. Nothing is sent to a restaurant.</p>
  </section>;
}
