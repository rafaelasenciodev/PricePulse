import type { ListingId, Price } from "../../shared/domain";
import { AlertNotActive, TargetAlreadyReached } from "./errors";
import type { AlertId, UserId } from "./identifiers";
import type { TargetPrice } from "./target-price";

export const AlertStatus = {
  Active: "active",
  Triggered: "triggered",
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
  }): PriceAlert {
    const { id, owner, listingId, targetPrice, currentPrice } = params;
    if (currentPrice !== null && targetPrice.isReachedBy(currentPrice)) {
      throw new TargetAlreadyReached();
    }
    return new PriceAlert(id, owner, listingId, targetPrice, AlertStatus.Active);
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
    return new PriceAlert(this.id, this.owner, this.listingId, this.targetPrice, AlertStatus.Triggered);
  }

  equals(other: PriceAlert): boolean {
    return this.id === other.id;
  }
}
