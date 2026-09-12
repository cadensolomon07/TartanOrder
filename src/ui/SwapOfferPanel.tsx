import type { SwapOffer, UiAction, WaitView } from "@/contracts";
import { T } from "./Language";
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
    <h3><T>A quicker option for this item</T></h3>
    <p><strong><T>{offer.quantity}</T>× <T>{MENU[offer.alternative.itemId].label}</T></strong><T> at </T><strong><T>{vendor}</T></strong></p>
    <p><T>Instead of {MENU[offer.original.itemId].label} at {locationName(offer.original.vendorId)}</T>.</p>
    <p><T>Item preparation wait: </T><strong><T>{offer.original.waitMinutes}</T> → <T>{offer.alternative.waitMinutes} min</T></strong>. <WaitSource source={source} /></p>
    <p data-testid="swap-cart-change"><T>{cartChange(offer)}</T> <WaitSource source={source} /></p>
    <p data-testid="swap-price-change"><strong><T>{priceChange(offer)}</T></strong><T> Price each: {formatCents(offer.original.unitPriceCents)}</T> → <T>{formatCents(offer.alternative.unitPriceCents)}</T>.</p>
    <T>{offer.differences.length > 0 && <ul><T>{offer.differences.map((difference, index) => <li key={`${index}:${difference}`}><T>{difference}</T></li>)}</T></ul>}</T>
    <T>{offer.retainedModifiers.length > 0 && <p><T>Keeps: {offer.retainedModifiers.map((id) => MODIFIER_LABEL[id]).join(", ")}</T>.</p>}</T>
    <T>{offer.removedModifiers.length > 0 && <p><strong><T>Removes: {offer.removedModifiers.map((id) => MODIFIER_LABEL[id]).join(", ")}</T>.</strong></p>}</T>
    <div className={styles.swapActions}>
      <button type="button" className={styles.primaryBtn} disabled={disabled} data-testid="accept-swap" onClick={() => onAction({ type: "ACCEPT_SWAP", offerId: offer.offerId, revision: offer.revision })}><T>Switch to {vendor}</T></button>
      <button type="button" className={styles.secondaryBtn} disabled={disabled} data-testid="decline-swap" onClick={() => onAction({ type: "DECLINE_SWAP", offerId: offer.offerId })}><T>Keep it</T></button>
    </div>
    <p className={styles.muted}><T>Preparation only; excludes walking and pickup travel. Nothing is sent to a restaurant.</T></p>
  </section>;
}
