/** Notifications for the tests of reading them: any owner, Price Alert, Listing, prices and Observed At. */

import { Notification, newAlertId, type AlertId } from "../../src/price-alerts/domain";
import { ObservedAt, Price } from "../../src/shared/domain";
import { anAlert } from "./alerts";

export interface NotificationSpec {
  readonly alertId?: AlertId;
  readonly owner?: string;
  readonly listing?: string;
  /** The Target Price of the alert, in EUR. */
  readonly target?: string;
  /** The Current Price that reached it, in EUR. It must not be above the target. */
  readonly price?: string;
  /** The Observed At of that price, in ISO 8601. */
  readonly observedAt?: string;
}

export function aNotification(spec: NotificationSpec = {}): Notification {
  const { alertId = newAlertId(), owner = "user-1", listing = "headphones-shop-a", target = "80.00", price = "75.00", observedAt = "2026-11-19T10:00:00Z" } = spec;
  const alert = anAlert({ id: alertId, owner, listing, target });
  return Notification.produce({
    alert,
    currentPrice: Price.fromDecimalString(price, "EUR"),
    observedAt: ObservedAt.fromIsoString(observedAt),
  });
}
