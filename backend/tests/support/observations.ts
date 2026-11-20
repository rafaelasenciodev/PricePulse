/** Price Observations for the tests of reading the Price History and the Catalogue: any Provider, Listing, Observed At and Price. */

import { PriceObservation, ProviderId } from "../../src/price-observations/domain";
import { ListingId, ObservedAt, Price } from "../../src/shared/domain";

export interface ObservationSpec {
  readonly provider?: string;
  readonly listing?: string;
  /** In ISO 8601. */
  readonly observedAt?: string;
  /** The Price, or null when the Listing was unavailable. */
  readonly price?: string | null;
  /** The currency of the Listing and of the Price. EUR unless it is said. */
  readonly currency?: string;
}

export function anObservation(spec: ObservationSpec = {}): PriceObservation {
  const { provider = "simulator", listing = "headphones-shop-a", observedAt = "2026-11-19T10:00:00Z", price = "100.00", currency = "EUR" } = spec;
  return PriceObservation.record({
    provider: ProviderId(provider),
    listingId: ListingId(listing),
    observedAt: ObservedAt.fromIsoString(observedAt),
    price: price === null ? null : Price.fromDecimalString(price, currency),
    listingCurrency: currency,
    // A moment later than any observation of the tests, so that none of them is "in the future".
    recordedAt: new Date("2100-01-01T00:00:00Z"),
    toleranceMilliseconds: 0,
  });
}
