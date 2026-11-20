import type { ListingId, ObservedAt, Price } from "../../shared/domain";
import { TargetNotReached } from "./errors";
import type { AlertId } from "./identifiers";
import type { PriceAlert } from "./price-alert";
import type { TargetPrice } from "./target-price";
import type { UserId } from "../../shared/domain";

export interface ProduceNotification {
  readonly alert: PriceAlert;
  /** The Current Price at the moment of the Evaluation (BR-02). */
  readonly currentPrice: Price;
  /** The Observed At of that Current Price. */
  readonly observedAt: ObservedAt;
}

/**
 * A record that the owner of a Price Alert must be told that its Target Price was reached.
 *
 * It is immutable. It references the Price Alert, its owner and the Listing by identifier,
 * and states the Target Price and the Current Price that reached it, with its Observed At (BR-04).
 * Its identity is the Price Alert: there is at most one per alert (BR-05), so it has no
 * identifier of its own. It has no channel and no delivery state (BR-08). Use `produce` to create one.
 */
export class Notification {
  private constructor(
    readonly alertId: AlertId,
    readonly owner: UserId,
    readonly listingId: ListingId,
    readonly targetPrice: TargetPrice,
    readonly currentPrice: Price,
    readonly observedAt: ObservedAt,
  ) {}

  /** Rejected if the Current Price does not reach the Target Price of an Active alert (BR-04). */
  static produce(input: ProduceNotification): Notification {
    const { alert, currentPrice, observedAt } = input;
    if (!alert.isReachedBy(currentPrice)) throw new TargetNotReached(alert.id);
    return new Notification(alert.id, alert.owner, alert.listingId, alert.targetPrice, currentPrice, observedAt);
  }

  /**
   * Rebuilds a Notification from what was stored. The alert is not at hand, since it may have changed state since then,
   * so it checks what stored data can get wrong: that the Current Price reaches the Target Price (BR-04), in its currency.
   */
  static restore(
    alertId: AlertId,
    owner: UserId,
    listingId: ListingId,
    targetPrice: TargetPrice,
    currentPrice: Price,
    observedAt: ObservedAt,
  ): Notification {
    if (!targetPrice.isReachedBy(currentPrice)) throw new TargetNotReached(alertId);
    return new Notification(alertId, owner, listingId, targetPrice, currentPrice, observedAt);
  }
}
