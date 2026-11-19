import type { PriceAlert } from "../domain";

/** A Price Alert as the callers of the use cases see it: text, with no domain types. */
export interface PriceAlertView {
  readonly id: string;
  readonly listingId: string;
  readonly targetAmount: string;
  readonly currency: string;
  readonly status: string;
  /** In UTC, such as "2026-11-19T10:00:00.000Z". */
  readonly createdAt: string;
}

export function toView(alert: PriceAlert): PriceAlertView {
  return {
    id: alert.id,
    listingId: alert.listingId,
    targetAmount: alert.targetPrice.toDecimalString(),
    currency: alert.targetPrice.currency,
    status: alert.status,
    createdAt: alert.createdAt.toIsoString(),
  };
}
