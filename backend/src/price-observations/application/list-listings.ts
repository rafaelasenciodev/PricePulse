/** UC-01 List Listings (see the design of feature 07). */

import { toListingView, type ListingView } from "./listing-view";
import type { ListingCatalogue, PriceObservationRepository } from "./ports";

export interface ListListingsQuery {
  /** How many Listings at most. The way in checks that it is valid. */
  readonly limit: number;
  /** How many Listings to skip. The way in checks that it is valid. */
  readonly offset: number;
}

export interface ListListingsResult {
  /** The page, in the order of the Catalogue (BR-01). */
  readonly items: readonly ListingView[];
  /** How many Listings the Catalogue holds, in all pages. */
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export class ListListings {
  constructor(
    private readonly catalogue: ListingCatalogue,
    private readonly observations: PriceObservationRepository,
  ) {}

  /** Only reads: nothing here changes the Catalogue or a Price Observation (BR-05, BR-08). */
  async execute({ limit, offset }: ListListingsQuery): Promise<ListListingsResult> {
    // 1. The page of the Catalogue, in its order (BR-01, BR-07)
    const page = await this.catalogue.list({ limit, offset });

    // 2. The Current Price of each Listing, from its latest observation (BR-03)
    const latest = await Promise.all(page.items.map((listing) => this.observations.findLatest(listing.id)));

    return {
      items: page.items.map((listing, index) => toListingView(listing, latest[index] ?? null)),
      total: page.total,
      limit,
      offset,
    };
  }
}
