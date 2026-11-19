/** In-memory implementations of the ports, to run the application without infrastructure. */

import {
  ActiveAlertAlreadyExists,
  NotificationAlreadyExists,
  type CurrentPrice,
  type CurrentPriceSource,
  type ListingReader,
  type ListingView,
  type NotificationRepository,
  type PriceAlertRepository,
} from "../application";
import type { ListingId, Price } from "../../shared/domain";
import type { AlertId, Notification, PriceAlert, UserId } from "../domain";

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

  async findActiveByListing(listingId: ListingId): Promise<PriceAlert[]> {
    return this.alerts.filter((a) => a.listingId === listingId && a.isActive);
  }

  async save(alert: PriceAlert): Promise<void> {
    const index = this.alerts.findIndex((a) => a.id === alert.id);
    if (index === -1) throw new Error(`Unknown Price Alert: ${alert.id}`);
    this.alerts[index] = alert;
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

/**
 * Implements NotificationRepository, including the uniqueness guarantee.
 *
 * There is at most one Notification per Price Alert (BR-05 of feature 03): adding a second
 * one fails with NotificationAlreadyExists, as persistence must do.
 */
export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly notifications = new Map<AlertId, Notification>();

  async findByAlert(alertId: AlertId): Promise<Notification | null> {
    return this.notifications.get(alertId) ?? null;
  }

  async add(notification: Notification): Promise<void> {
    // The check and the insertion must not be separated by an `await`: JavaScript can
    // switch to another request at each `await`, which would break the guarantee.
    if (this.notifications.has(notification.alertId)) throw new NotificationAlreadyExists();
    this.notifications.set(notification.alertId, notification);
  }

  /** Every stored Notification. For tests and inspection, not part of the port. */
  all(): Notification[] {
    return [...this.notifications.values()];
  }
}

/** Implements CurrentPriceSource over a map that the caller fills. A Listing that is not in it has no Current Price. */
export class InMemoryCurrentPriceSource implements CurrentPriceSource {
  private readonly prices = new Map<ListingId, CurrentPrice>();

  /** Give the Listing a Current Price, or none (null). */
  set(listingId: ListingId, currentPrice: CurrentPrice | null): void {
    if (currentPrice === null) this.prices.delete(listingId);
    else this.prices.set(listingId, currentPrice);
  }

  async currentPriceOf(listingId: ListingId): Promise<CurrentPrice | null> {
    return this.prices.get(listingId) ?? null;
  }
}
