import type { PriceObservation } from "../domain";

/** A Price Observation as the callers of the use cases see it: text, with no domain types. */
export interface PriceObservationView {
  readonly provider: string;
  readonly listingId: string;
  /** In UTC, such as "2026-11-19T10:00:00.000Z". */
  readonly observedAt: string;
  readonly price: { readonly amount: string; readonly currency: string } | null;
}

export function toObservationView(observation: PriceObservation): PriceObservationView {
  return {
    provider: observation.provider,
    listingId: observation.listingId,
    observedAt: observation.observedAt.toIsoString(),
    price:
      observation.price === null
        ? null
        : { amount: observation.price.toDecimalString(), currency: observation.price.currency },
  };
}
