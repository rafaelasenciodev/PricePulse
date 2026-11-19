/** Ports: what the use case needs from the outside (contract, section "Ports"). */

import type { ListingId, Price, PriceAlert, UserId } from "../domain";

/** What the use case needs to know about a Listing, read at once. */
export interface ListingView {
  readonly currency: string;
  /** null when the Listing has no Current Price. */
  readonly currentPrice: Price | null;
}

export interface ListingReader {
  /** The Listing, or null if it does not exist. */
  get(listingId: ListingId): Promise<ListingView | null>;
}

/**
 * The owner already has an Active Price Alert for the Listing.
 *
 * Thrown by the repository when adding violates the uniqueness guarantee.
 * It is handled inside the use case and never reaches the caller.
 */
export class ActiveAlertAlreadyExists extends Error {
  constructor() {
    super("The owner already has an Active Price Alert for this Listing");
    this.name = "ActiveAlertAlreadyExists";
  }
}

export interface PriceAlertRepository {
  /** The Active Price Alert of the owner for the Listing, if any. A Triggered one is never returned. */
  findActive(owner: UserId, listingId: ListingId): Promise<PriceAlert | null>;

  /** Store a new Price Alert. Throws ActiveAlertAlreadyExists if the owner already has an Active one for that Listing. */
  add(alert: PriceAlert): Promise<void>;
}
