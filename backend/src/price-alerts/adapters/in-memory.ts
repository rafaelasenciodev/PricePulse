/** In-memory implementations of the ports, to run the application without infrastructure. */

import {
  ActiveAlertAlreadyExists,
  type ListingReader,
  type ListingView,
  type PriceAlertRepository,
} from "../application";
import type { ListingId, Price, PriceAlert, UserId } from "../domain";
import type { Authenticator } from "../http";

/**
 * Implements Authenticator over a table of tokens that the caller fills.
 * Only for development and tests: real authentication comes with the accounts feature.
 */
export class InMemoryAuthenticator implements Authenticator {
  private readonly users = new Map<string, UserId>();

  addUser(token: string, userId: UserId): void {
    this.users.set(token, userId);
  }

  async authenticate(token: string): Promise<UserId | null> {
    return this.users.get(token) ?? null;
  }
}

/** Implements ListingReader over a map that the caller fills. */
export class InMemoryListingReader implements ListingReader {
  private readonly listings = new Map<ListingId, ListingView>();

  addListing(listingId: ListingId, currency: string, currentPrice: Price | null = null): void {
    this.listings.set(listingId, { currency, currentPrice });
  }

  setCurrentPrice(listingId: ListingId, currentPrice: Price | null): void {
    const listing = this.listings.get(listingId);
    if (listing === undefined) throw new Error(`Unknown Listing: ${listingId}`);
    this.listings.set(listingId, { currency: listing.currency, currentPrice });
  }

  async get(listingId: ListingId): Promise<ListingView | null> {
    return this.listings.get(listingId) ?? null;
  }
}

/**
 * Implements PriceAlertRepository, including the uniqueness guarantee.
 *
 * An owner has at most one Active Price Alert per Listing: adding a second one
 * fails with ActiveAlertAlreadyExists, as persistence must do.
 */
export class InMemoryPriceAlertRepository implements PriceAlertRepository {
  private readonly alerts: PriceAlert[] = [];

  async findActive(owner: UserId, listingId: ListingId): Promise<PriceAlert | null> {
    return this.search(owner, listingId);
  }

  async add(alert: PriceAlert): Promise<void> {
    // The check and the insertion must not be separated by an `await`: JavaScript can
    // switch to another request at each `await`, which would break the guarantee.
    if (alert.isActive && this.search(alert.owner, alert.listingId) !== null) {
      throw new ActiveAlertAlreadyExists();
    }
    this.alerts.push(alert);
  }

  /** Every stored Price Alert. For tests and inspection, not part of the port. */
  all(): PriceAlert[] {
    return [...this.alerts];
  }

  private search(owner: UserId, listingId: ListingId): PriceAlert | null {
    return (
      this.alerts.find((a) => a.owner === owner && a.listingId === listingId && a.isActive) ?? null
    );
  }
}
