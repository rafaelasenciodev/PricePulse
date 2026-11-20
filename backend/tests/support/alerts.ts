/** Price Alerts for the tests of reading and managing them: any owner, Listing, Target Price, state and moment. */

import { AlertStatus, CreatedAt, PriceAlert, TargetPrice, newAlertId, type AlertId } from "../../src/price-alerts/domain";
import { ListingId, UserId } from "../../src/shared/domain";

export interface AlertSpec {
  readonly id?: AlertId;
  readonly owner?: string;
  readonly listing?: string;
  readonly target?: string;
  readonly currency?: string;
  readonly status?: AlertStatus;
  /** When it was created, in ISO 8601. */
  readonly createdAt?: string;
}

export function anAlert(spec: AlertSpec = {}): PriceAlert {
  const { id = newAlertId(), owner = "user-1", listing = "headphones-shop-a", target = "80.00", currency = "EUR", status = AlertStatus.Active, createdAt = "2026-11-19T10:00:00Z" } = spec;
  return new PriceAlert(
    id,
    UserId(owner),
    ListingId(listing),
    TargetPrice.fromDecimalString(target, currency),
    status,
    CreatedAt.fromDate(new Date(createdAt)),
  );
}
