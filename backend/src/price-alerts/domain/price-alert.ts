import type { ListingId, Price } from "../../shared/domain";
import type { CreatedAt } from "./created-at";
import { AlertNotActive, CurrencyMismatch, TargetAlreadyReached } from "./errors";
import type { AlertId } from "./identifiers";
import type { TargetPrice } from "./target-price";
import type { UserId } from "../../shared/domain";

export const AlertStatus = {
  Active: "active",
  Triggered: "triggered",
  Cancelled: "cancelled",
} as const;
export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

/**
 * A User's request to be notified when a Listing reaches a Target Price.
 *
 * An entity: two Price Alerts are the same if they have the same identifier.
 * The User and the Listing are referenced by identifier only.
 */
export class PriceAlert {
  constructor(
    readonly id: AlertId,
    readonly owner: UserId,
    readonly listingId: ListingId,
    readonly targetPrice: TargetPrice,
    readonly status: AlertStatus,
    /** When it was created. It never changes (BR-09 of feature 04). */
    readonly createdAt: CreatedAt,
  ) {}

  /**
   * Create a new, Active Price Alert (BR-09).
   *
   * Rejected if a Current Price is known and already reaches the Target Price (BR-05).
   * Without a Current Price (null) the check does not apply (BR-06).
   */
  static create(params: {
    id: AlertId;
    owner: UserId;
    listingId: ListingId;
    targetPrice: TargetPrice;
    currentPrice: Price | null;
    createdAt: CreatedAt;
  }): PriceAlert {
    const { id, owner, listingId, targetPrice, currentPrice, createdAt } = params;
    if (currentPrice !== null && targetPrice.isReachedBy(currentPrice)) {
      throw new TargetAlreadyReached();
    }
    return new PriceAlert(id, owner, listingId, targetPrice, AlertStatus.Active, createdAt);
  }

  get isActive(): boolean {
    return this.status === AlertStatus.Active;
  }

  /**
   * Whether the Current Price reaches the Target Price of this alert (BR-02).
   *
   * Only an Active alert can be reached: a Triggered one never is (BR-01). Without a
   * Current Price (null) nothing is reached, and nothing is remembered from earlier prices (BR-03).
   */
  isReachedBy(currentPrice: Price | null): boolean {
    if (!this.isActive || currentPrice === null) return false;
    return this.targetPrice.isReachedBy(currentPrice);
  }

  /** The same Price Alert, Triggered (BR-06). It does not change this one. Only an Active alert can be triggered. */
  trigger(): PriceAlert {
    if (!this.isActive) throw new AlertNotActive(this.id);
    return new PriceAlert(this.id, this.owner, this.listingId, this.targetPrice, AlertStatus.Triggered, this.createdAt);
  }

  /**
   * The same Price Alert, Cancelled by its owner (BR-03 of feature 04). It does not change this one.
   * Only an Active alert can be cancelled: one that was Triggered has ended, and one already
   * Cancelled needs nothing. The use case decides what each of those means for the caller.
   */
  cancel(): PriceAlert {
    if (!this.isActive) throw new AlertNotActive(this.id);
    return new PriceAlert(this.id, this.owner, this.listingId, this.targetPrice, AlertStatus.Cancelled, this.createdAt);
  }

  /**
   * The same Price Alert with another Target Price (BR-05 and BR-06 of feature 04). It does not
   * change this one. Only the Target Price changes: the identifier, owner, Listing, state and
   * creation moment stay.
   *
   * Only an Active alert can be modified. The new Target Price is in the currency of the alert,
   * and the Current Price must not already reach it, as when the alert is created (BR-05 of feature 01).
   * Without a Current Price (null) that check does not apply.
   */
  changeTargetPrice(targetPrice: TargetPrice, currentPrice: Price | null): PriceAlert {
    if (!this.isActive) throw new AlertNotActive(this.id);
    if (targetPrice.currency !== this.targetPrice.currency) {
      throw new CurrencyMismatch(targetPrice.currency, this.targetPrice.currency);
    }
    if (currentPrice !== null && targetPrice.isReachedBy(currentPrice)) throw new TargetAlreadyReached();
    return new PriceAlert(this.id, this.owner, this.listingId, targetPrice, this.status, this.createdAt);
  }

  equals(other: PriceAlert): boolean {
    return this.id === other.id;
  }
}
