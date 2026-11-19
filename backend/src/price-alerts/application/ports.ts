/** Ports: what the use case needs from the outside (contract, section "Ports"). */

import type { ListingId, ObservedAt, Price } from "../../shared/domain";
import type { AlertId, Notification, PriceAlert, UserId } from "../domain";

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

/** The current moment. It is a port so that tests control the time (BR-09 of feature 04). */
export interface Clock {
  now(): Date;
}

export interface PriceAlertRepository {
  /** The Active Price Alert of the owner for the Listing, if any. A Triggered one is never returned. */
  findActive(owner: UserId, listingId: ListingId): Promise<PriceAlert | null>;

  /** Store a new Price Alert. Throws ActiveAlertAlreadyExists if the owner already has an Active one for that Listing. */
  add(alert: PriceAlert): Promise<void>;

  /** The Active Price Alerts of a Listing. A Triggered one is never returned (BR-01 of feature 03). */
  findActiveByListing(listingId: ListingId): Promise<PriceAlert[]>;

  /**
   * Replace the stored Price Alert that has the same identifier. It fails if none is stored:
   * saving an alert that was never added is a defect, not a way to add one.
   * The only change it is used for is Active to Triggered. When alerts can be cancelled or
   * modified, it will have to be conditional on the state that was read.
   */
  save(alert: PriceAlert): Promise<void>;
}

/**
 * A Notification for that Price Alert is already stored.
 *
 * Thrown by the repository when adding violates the uniqueness guarantee (BR-05).
 * It is handled inside the use case and never reaches the caller.
 */
export class NotificationAlreadyExists extends Error {
  constructor() {
    super("A Notification for this Price Alert is already stored");
    this.name = "NotificationAlreadyExists";
  }
}

export interface NotificationRepository {
  /** The Notification of a Price Alert, if any. */
  findByAlert(alertId: AlertId): Promise<Notification | null>;

  /** Store a Notification. Throws NotificationAlreadyExists if one for that Price Alert is stored. */
  add(notification: Notification): Promise<void>;
}

/** The Current Price of a Listing, with the moment at which it was observed. */
export interface CurrentPrice {
  readonly price: Price;
  readonly observedAt: ObservedAt;
}

export interface CurrentPriceSource {
  /** The Current Price, or null if the Listing has none (it does not exist, has no observation, or is unavailable). */
  currentPriceOf(listingId: ListingId): Promise<CurrentPrice | null>;
}
