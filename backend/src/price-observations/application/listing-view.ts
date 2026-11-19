import type { PriceObservation } from "../domain";
import type { CatalogueListing } from "./ports";

/** The Current Price of a Listing and the Observed At of the observation that gave it (BR-03 of feature 07). */
export interface CurrentPriceView {
  readonly amount: string;
  readonly currency: string;
  /** In UTC, such as "2026-11-19T10:00:00.000Z". */
  readonly observedAt: string;
}

/** A Listing as the callers of the use cases see it: text, with no domain types (BR-02 of feature 07). */
export interface ListingView {
  readonly id: string;
  readonly title: string;
  readonly retailer: string;
  readonly currency: string;
  /** null when the Listing has no Current Price. */
  readonly currentPrice: CurrentPriceView | null;
}

/**
 * The Current Price of a Listing, from its latest Price Observation: the one with the greatest Observed At.
 *
 * It is the definition of BR-07 of feature 02. A Listing whose latest observation has no Price has none,
 * and neither does a Listing with no observation.
 */
export function toCurrentPriceView(latest: PriceObservation | null): CurrentPriceView | null {
  if (latest === null || latest.price === null) return null;
  return {
    amount: latest.price.toDecimalString(),
    currency: latest.price.currency,
    observedAt: latest.observedAt.toIsoString(),
  };
}

export function toListingView(listing: CatalogueListing, latest: PriceObservation | null): ListingView {
  return {
    id: listing.id,
    title: listing.title,
    retailer: listing.retailer,
    currency: listing.currency,
    currentPrice: toCurrentPriceView(latest),
  };
}
