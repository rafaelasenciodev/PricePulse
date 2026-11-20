/** UC-02 Read a Listing (see the design of feature 07). */

import type { ListingId } from "../../shared/domain";
import { ListingNotFound } from "./errors";
import { toListingView, type ListingView } from "./listing-view";
import type { ListingCatalogue, PriceObservationRepository } from "./ports";

export interface ReadListingQuery {
  readonly listingId: ListingId;
}

export class ReadListing {
  constructor(
    private readonly catalogue: ListingCatalogue,
    private readonly observations: PriceObservationRepository,
  ) {}

  /** Only reads (BR-05, BR-08). */
  async execute({ listingId }: ReadListingQuery): Promise<ListingView> {
    // 1. The Listing is in the Catalogue (BR-04)
    const listing = await this.catalogue.find(listingId);
    if (listing === null) throw new ListingNotFound(listingId);

    // 2. Its Current Price, made as in the list (BR-03)
    return toListingView(listing, await this.observations.findLatest(listingId));
  }
}
