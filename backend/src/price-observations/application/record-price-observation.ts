/** UC-01 Record Price Observation (see the use case contract). */

import { InvalidValue, ObservedAt, Price, type ListingId } from "../../shared/domain";
import {
  ObservationCurrencyMismatch,
  ObservedInTheFuture,
  PriceObservation,
  type ProviderId,
} from "../domain";
import { InvalidObservation, ListingNotFound, ObservationConflict } from "./errors";
import { toObservationView, type PriceObservationView } from "./price-observation-view";
import {
  ObservationAlreadyExists,
  type CatalogueListing,
  type Clock,
  type ListingCatalogue,
  type PriceObservationRepository,
} from "./ports";

/**
 * How far after the moment of recording an Observed At may be, for differences between the
 * clocks of a Provider and of the system (BR-12, contract decision 5). A design parameter,
 * not a business rule.
 */
export const CLOCK_TOLERANCE_MILLISECONDS = 5 * 60 * 1000;

export interface RecordPriceObservationCommand {
  /** Comes from the authentication of the request, never from the client. */
  readonly provider: ProviderId;
  readonly listingId: ListingId;
  /** ISO 8601 with an explicit time zone, such as "2026-11-19T10:00:00Z". */
  readonly observedAt: string;
  /** The Price, or null when the Listing was unavailable (BR-03). The amount is text such as "79.90". */
  readonly price: { readonly amount: string; readonly currency: string } | null;
}

export interface RecordPriceObservationResult {
  readonly observation: PriceObservationView;
  /** false when an existing Price Observation with the same content was returned (BR-09). */
  readonly recorded: boolean;
}

/**
 * What the HTTP layer needs of the use case: only `execute`. A name for it lets the
 * Composition Root hand over a use case that it has wrapped.
 */
export type PriceObservationRecorder = Pick<RecordPriceObservation, "execute">;

export class RecordPriceObservation {
  constructor(
    private readonly catalogue: ListingCatalogue,
    private readonly observations: PriceObservationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: RecordPriceObservationCommand): Promise<RecordPriceObservationResult> {
    // 1. The Listing exists (BR-02)
    const listing = await this.catalogue.find(command.listingId);
    if (listing === null) throw new ListingNotFound(command.listingId);

    // 2. The observation is valid (BR-03, BR-04, BR-05, BR-12)
    const observation = this.build(command, listing);

    // Two attempts: if adding fails because of a concurrent request, repeat from step 3.
    for (let attempt = 0; attempt < 2; attempt++) {
      // 3. A Price Observation with the same identity may already be stored (BR-09, BR-10)
      const existing = await this.observations.find(command.provider, command.listingId, observation.observedAt);
      if (existing !== null) {
        if (existing.hasSameContentAs(observation)) return { observation: toObservationView(existing), recorded: false };
        throw new ObservationConflict();
      }

      // 4. Store it. Persistence guarantees uniqueness if two requests race.
      try {
        await this.observations.add(observation);
      } catch (error) {
        if (error instanceof ObservationAlreadyExists) continue;
        throw error;
      }
      return { observation: toObservationView(observation), recorded: true };
    }

    throw new Error("Could not record the Price Observation: repeated concurrent conflicts");
  }

  private build(command: RecordPriceObservationCommand, listing: CatalogueListing): PriceObservation {
    // The currency is compared before the amount is read, so that a currency the system does
    // not support is reported as "not the one of the Listing", not as an internal error
    // (contract, decision 8).
    if (command.price !== null && command.price.currency !== listing.currency) {
      throw new InvalidObservation(
        `The currency ${JSON.stringify(command.price.currency)} is not the one of the Listing, ${listing.currency}`,
      );
    }

    try {
      return PriceObservation.record({
        provider: command.provider,
        listingId: command.listingId,
        observedAt: ObservedAt.fromIsoString(command.observedAt),
        price: command.price === null ? null : Price.fromDecimalString(command.price.amount, listing.currency),
        listingCurrency: listing.currency,
        recordedAt: this.clock.now(),
        toleranceMilliseconds: CLOCK_TOLERANCE_MILLISECONDS,
      });
    } catch (error) {
      if (isMistakeOfTheProvider(error)) throw new InvalidObservation(error.message, { cause: error });
      throw error; // e.g. an unsupported currency of the catalogue: an internal error
    }
  }
}

/** The domain errors that the contract reports as an invalid observation. */
function isMistakeOfTheProvider(error: unknown): error is Error {
  return (
    error instanceof InvalidValue ||
    error instanceof ObservationCurrencyMismatch ||
    error instanceof ObservedInTheFuture
  );
}
