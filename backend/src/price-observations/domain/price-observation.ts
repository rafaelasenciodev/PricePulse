import type { ListingId, Price } from "../../shared/domain";
import { NegativePrice, ObservationCurrencyMismatch, ObservedInTheFuture } from "./errors";
import type { ProviderId } from "./identifiers";
import { ObservedAt } from "./observed-at";

export interface RecordPriceObservation {
  readonly provider: ProviderId;
  readonly listingId: ListingId;
  readonly observedAt: ObservedAt;
  /** null when the Listing has no Price at that moment: it is unavailable (BR-03). */
  readonly price: Price | null;
  /** The currency of the Listing, which the model is handed (BR-05). */
  readonly listingCurrency: string;
  /** The moment at which the observation is recorded (BR-12). It is not stored. */
  readonly recordedAt: Date;
  /** How far after `recordedAt` an Observed At may be, for differences between clocks (BR-12). */
  readonly toleranceMilliseconds: number;
}

/**
 * A record of the Price of a Listing at a point in time, or of its absence.
 *
 * It is immutable. Its identity is its Provider, its Listing and its Observed At, which is
 * what tells a resend from a different observation (BR-09, BR-10); it has no identifier of
 * its own. Use `record` to create one.
 */
export class PriceObservation {
  private constructor(
    readonly provider: ProviderId,
    readonly listingId: ListingId,
    readonly observedAt: ObservedAt,
    /** null: the Listing was unavailable at the Observed At. */
    readonly price: Price | null,
  ) {}

  /** Checks BR-04, BR-05 and BR-12. Without a Price, only BR-12 applies (BR-03). */
  static record(input: RecordPriceObservation): PriceObservation {
    const { price, listingCurrency, observedAt, recordedAt, toleranceMilliseconds } = input;

    if (price !== null) {
      if (price.minorUnits < 0) throw new NegativePrice(price.toDecimalString());
      if (price.currency !== listingCurrency) {
        throw new ObservationCurrencyMismatch(price.currency, listingCurrency);
      }
    }

    // An invalid clock would make the comparison below false, and accept anything.
    if (Number.isNaN(recordedAt.getTime())) throw new Error("The moment of recording is not a valid date");
    if (observedAt.epochMilliseconds > recordedAt.getTime() + toleranceMilliseconds) {
      throw new ObservedInTheFuture(observedAt.toIsoString(), recordedAt.toISOString());
    }

    return new PriceObservation(input.provider, input.listingId, observedAt, price);
  }

  /** Whether another observation has the same Price, or both have none (BR-09, BR-10). */
  hasSameContentAs(other: PriceObservation): boolean {
    if (this.price === null || other.price === null) return this.price === other.price;
    return this.price.equals(other.price);
  }
}
