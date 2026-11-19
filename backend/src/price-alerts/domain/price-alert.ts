import type { ListingId, Price } from "../../shared/domain";
import { TargetAlreadyReached } from "./errors";
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

  equals(other: PriceAlert): boolean {
    return this.id === other.id;
  }
}
