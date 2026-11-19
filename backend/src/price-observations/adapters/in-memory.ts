/** In-memory implementations of the ports, to run the application without infrastructure. */

import type { ListingId, ObservedAt } from "../../shared/domain";
import {
  ObservationAlreadyExists,
  type CatalogueListing,
  type CataloguePage,
  type CataloguePageQuery,
  type ListingCatalogue,
  type PriceHistoryPage,
  type PriceHistoryQuery,
  type PriceObservationRepository,
} from "../application";
import type { PriceObservation, ProviderId } from "../domain";

/** The text of a Listing for people to read. */
export interface ListingText {
  readonly title: string;
  readonly retailer: string;
}

/** Implements ListingCatalogue over a map that the caller fills. */
export class InMemoryListingCatalogue implements ListingCatalogue {
  private readonly listings = new Map<ListingId, CatalogueListing>();

  /**
   * Adds a Listing, or replaces the one with that identifier.
   *
   * The text is optional only so that the tests that need a currency and nothing else stay short: without
   * it the title is the identifier and the Retailer is "Unknown retailer". The Catalogue is filled by the
   * system, so a text that is empty is a mistake of whoever fills it, and it is refused.
   */
  addListing(listingId: ListingId, currency: string, text?: ListingText): void {
    const { title, retailer } = text ?? { title: listingId as string, retailer: "Unknown retailer" };
    if (title.trim() === "" || retailer.trim() === "") {
      throw new RangeError(`The title and the Retailer of the Listing ${JSON.stringify(listingId)} must not be empty`);
    }
    this.listings.set(listingId, { id: listingId, title, retailer, currency });
  }

  async find(listingId: ListingId): Promise<CatalogueListing | null> {
    return this.listings.get(listingId) ?? null;
  }

  async list(query: CataloguePageQuery): Promise<CataloguePage> {
    const ordered = [...this.listings.values()].sort(byTitleThenIdentifier);
    return { items: ordered.slice(query.offset, query.offset + query.limit), total: ordered.length };
  }
}

/**
 * The order of the Catalogue (BR-01 of feature 07). Strings are compared by the codes of their characters,
 * which is the same on every machine, and the title in lower case so that a capital does not decide.
 */
function byTitleThenIdentifier(a: CatalogueListing, b: CatalogueListing): number {
  const titleA = a.title.toLowerCase();
  const titleB = b.title.toLowerCase();
  if (titleA !== titleB) return titleA < titleB ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
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
