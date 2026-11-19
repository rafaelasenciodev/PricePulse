/** In-memory implementations of the ports, to run the application without infrastructure. */

import type { ListingId, ObservedAt } from "../../shared/domain";
import {
  ObservationAlreadyExists,
  type CatalogueListing,
  type ListingCatalogue,
  type PriceHistoryPage,
  type PriceHistoryQuery,
  type PriceObservationRepository,
} from "../application";
import type { PriceObservation, ProviderId } from "../domain";

/** Implements ListingCatalogue over a map that the caller fills. */
export class InMemoryListingCatalogue implements ListingCatalogue {
  private readonly listings = new Map<ListingId, CatalogueListing>();

  addListing(listingId: ListingId, currency: string): void {
    this.listings.set(listingId, { currency });
  }

  async find(listingId: ListingId): Promise<CatalogueListing | null> {
    return this.listings.get(listingId) ?? null;
  }
}

/**
 * Implements PriceObservationRepository, including the uniqueness guarantee.
 *
 * There is at most one Price Observation per Provider, Listing and Observed At: adding a
 * second one fails with ObservationAlreadyExists, as persistence must do.
 */
export class InMemoryPriceObservationRepository implements PriceObservationRepository {
  private readonly observations: PriceObservation[] = [];

  async find(provider: ProviderId, listingId: ListingId, observedAt: ObservedAt): Promise<PriceObservation | null> {
    return this.search(provider, listingId, observedAt);
  }

  async add(observation: PriceObservation): Promise<void> {
    // The check and the insertion must not be separated by an `await`: JavaScript can
    // switch to another request at each `await`, which would break the guarantee.
    if (this.search(observation.provider, observation.listingId, observation.observedAt) !== null) {
      throw new ObservationAlreadyExists();
    }
    this.observations.push(observation);
  }

  /**
   * The one with the greatest Observed At, whatever the order in which they were stored (BR-07).
   * When several share it the contract leaves the result undefined (BR-13); here the first
   * one stored is returned.
   */
  async findLatest(listingId: ListingId): Promise<PriceObservation | null> {
    let latest: PriceObservation | null = null;
    for (const observation of this.observations) {
      if (observation.listingId !== listingId) continue;
      if (latest === null || observation.observedAt.epochMilliseconds > latest.observedAt.epochMilliseconds) {
        latest = observation;
      }
    }
    return latest;
  }

  async findByListing(listingId: ListingId, query: PriceHistoryQuery): Promise<PriceHistoryPage> {
    const matching = this.observations
      .filter((o) => o.listingId === listingId && query.range.includes(o.observedAt))
      .sort(newestObservedFirst);
    return { items: matching.slice(query.offset, query.offset + query.limit), total: matching.length };
  }

  /** Every stored Price Observation. For tests and inspection, not part of the port. */
  all(): PriceObservation[] {
    return [...this.observations];
  }

  private search(provider: ProviderId, listingId: ListingId, observedAt: ObservedAt): PriceObservation | null {
    return (
      this.observations.find(
        (o) => o.provider === provider && o.listingId === listingId && o.observedAt.equals(observedAt),
      ) ?? null
    );
  }
}

/** Newest Observed At first, and by Provider when two share it. */
function newestObservedFirst(a: PriceObservation, b: PriceObservation): number {
  const byMoment = b.observedAt.epochMilliseconds - a.observedAt.epochMilliseconds;
  if (byMoment !== 0) return byMoment;
  return a.provider < b.provider ? -1 : a.provider > b.provider ? 1 : 0;
}
