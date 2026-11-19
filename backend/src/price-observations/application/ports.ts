/** Ports: what the use case needs from the outside (contract, section "Ports"). */

import type { ListingId, ObservedAt } from "../../shared/domain";
import type { ObservedAtRange, PriceObservation, ProviderId } from "../domain";

/** What this use case needs to know about a Listing: only its currency. */
export interface CatalogueListing {
  readonly currency: string;
}

export interface ListingCatalogue {
  /** The Listing, or null if it does not exist. */
  find(listingId: ListingId): Promise<CatalogueListing | null>;
}

/**
 * A Price Observation with the same Provider, Listing and Observed At is already stored.
 *
 * Thrown by the repository when adding violates the uniqueness guarantee.
 * It is handled inside the use case and never reaches the caller.
 */
export class ObservationAlreadyExists extends Error {
  constructor() {
    super("A Price Observation with the same Provider, Listing and Observed At is already stored");
    this.name = "ObservationAlreadyExists";
  }
}

/** Which page of the Price History of a Listing to read (BR-05, BR-06 and BR-08 of feature 05). */
export interface PriceHistoryQuery {
  /** Only the observations that the range includes. */
  readonly range: ObservedAtRange;
  /** How many observations at most. At least 1. */
  readonly limit: number;
  /** How many observations to skip, counted from the newest. At least 0. */
  readonly offset: number;
}

/** A page of Price Observations, and how many the range includes in all. */
export interface PriceHistoryPage {
  readonly items: readonly PriceObservation[];
  readonly total: number;
}

export interface PriceObservationRepository {
  /** The stored Price Observation with that Provider, Listing and Observed At, if any. */
  find(provider: ProviderId, listingId: ListingId, observedAt: ObservedAt): Promise<PriceObservation | null>;

  /** Store a Price Observation. Throws ObservationAlreadyExists if one with the same identity is stored. */
  add(observation: PriceObservation): Promise<void>;

  /**
   * The latest Price Observation of a Listing: the one with the greatest Observed At, or null.
   *
   * This use case does not call it. It defines the Current Price (BR-07) for whoever needs it.
   * When several share the greatest Observed At, the result is not defined (BR-13).
   */
  findLatest(listingId: ListingId): Promise<PriceObservation | null>;

  /**
   * The Price History of a Listing: its observations that the range includes, as the page asked
   * for and the total. Every stored one counts, an older one and one without a Price too. They
   * come newest Observed At first, and by Provider when two share it, so that the pages are
   * stable. The limit and the offset are valid: the caller checks them.
   */
  findByListing(listingId: ListingId, query: PriceHistoryQuery): Promise<PriceHistoryPage>;
}

/** The current moment. It is a port so that tests control the time (BR-12). */
export interface Clock {
  now(): Date;
}
