/** In-memory implementations of the ports, to run the application without infrastructure. */

import {
  ActiveAlertAlreadyExists,
  AlertStateChanged,
  NotificationAlreadyExists,
  type CurrentPrice,
  type AlertPage,
  type AlertPageQuery,
  type CurrentPriceSource,
  type ListingReader,
  type ListingView,
  type NotificationPage,
  type NotificationPageQuery,
  type NotificationRepository,
  type PriceAlertRepository,
} from "../application";
import type { ListingId, Price } from "../../shared/domain";
import type { AlertId, AlertStatus, Notification, PriceAlert } from "../domain";
import type { UserId } from "../../shared/domain";

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

  async find(owner: UserId, alertId: AlertId): Promise<PriceAlert | null> {
    return this.alerts.find((a) => a.id === alertId && a.owner === owner) ?? null;
  }

  async findByOwner(owner: UserId, query: AlertPageQuery): Promise<AlertPage> {
    const matching = this.alerts
      .filter((a) => a.owner === owner && (query.status === undefined || a.status === query.status))
      .sort(newestFirst);
    return { items: matching.slice(query.offset, query.offset + query.limit), total: matching.length };
  }

  async findActiveByListing(listingId: ListingId): Promise<PriceAlert[]> {
    return this.alerts.filter((a) => a.listingId === listingId && a.isActive);
  }

  async save(alert: PriceAlert, expectedStatus: AlertStatus): Promise<void> {
    // The comparison and the replacement must not be separated by an `await`, for the same
    // reason as in `add`: the condition would not hold if another request got in between.
    const index = this.alerts.findIndex((a) => a.id === alert.id);
    const stored = this.alerts[index];
    if (stored === undefined) throw new Error(`Unknown Price Alert: ${alert.id}`);
    if (stored.status === expectedStatus) {
      this.alerts[index] = alert;
      return;
    }
    if (stored.status === alert.status) return; // already in the state it would have: nothing to do
    throw new AlertStateChanged();
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

/** Newest first by the Observed At of the price that reached the target, and by alert identifier when two share it. */
function newestObservedFirst(a: Notification, b: Notification): number {
  const byMoment = b.observedAt.epochMilliseconds - a.observedAt.epochMilliseconds;
  if (byMoment !== 0) return byMoment;
  return a.alertId < b.alertId ? -1 : a.alertId > b.alertId ? 1 : 0;
}

/** Newest first by creation moment, and by identifier when two share it. */
function newestFirst(a: PriceAlert, b: PriceAlert): number {
  const byMoment = b.createdAt.epochMilliseconds - a.createdAt.epochMilliseconds;
  if (byMoment !== 0) return byMoment;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
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

  async findByOwner(owner: UserId, query: NotificationPageQuery): Promise<NotificationPage> {
    const mine = [...this.notifications.values()].filter((n) => n.owner === owner).sort(newestObservedFirst);
    return { items: mine.slice(query.offset, query.offset + query.limit), total: mine.length };
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
