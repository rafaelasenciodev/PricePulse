/** Ports: what the use case needs from the outside (contract, section "Ports"). */

import type { ListingId, ObservedAt, Price } from "../../shared/domain";
import type { AlertId, AlertStatus, Notification, PriceAlert, UserId } from "../domain";

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
   * Replace the stored Price Alert that has the same identifier, if it is still in the state
   * that was read (BR-08 of feature 04). It fails if none is stored: saving an alert that was
   * never added is a defect, not a way to add one.
   *
   * - If the stored state is `expectedStatus`, the alert is replaced.
   * - If the stored one is already in the state that `alert` has, there is nothing to do and it
   *   succeeds: saving the same change twice is harmless, as when two Evaluations of the same
   *   Listing run at the same time, or a User cancels twice.
   * - Otherwise another change came first, and it fails with `AlertStateChanged`.
   *
   * It looks at the state only: two modifications of the Target Price of an Active alert at the
   * same time both succeed, and the last one stays.
   */
  save(alert: PriceAlert, expectedStatus: AlertStatus): Promise<void>;
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

/**
 * The stored Price Alert is no longer in the state that was read.
 *
 * Thrown by the repository when a conditional save finds that another change came first.
 * The use cases handle it: it is not exposed to their callers as such.
 */
export class AlertStateChanged extends Error {
  constructor() {
    super("The Price Alert changed state before it was saved");
    this.name = "AlertStateChanged";
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
