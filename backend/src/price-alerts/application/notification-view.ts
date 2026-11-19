import type { Notification } from "../domain";

/** A Notification as the callers of the use cases see it: text, with no domain types. */
export interface NotificationView {
  readonly alertId: string;
  readonly owner: string;
  readonly listingId: string;
  readonly targetPrice: { readonly amount: string; readonly currency: string };
  readonly currentPrice: { readonly amount: string; readonly currency: string };
  /** In UTC, such as "2026-11-19T10:00:00.000Z". */
  readonly observedAt: string;
}

export function toNotificationView(notification: Notification): NotificationView {
  return {
    alertId: notification.alertId,
    owner: notification.owner,
    listingId: notification.listingId,
    targetPrice: { amount: notification.targetPrice.toDecimalString(), currency: notification.targetPrice.currency },
    currentPrice: { amount: notification.currentPrice.toDecimalString(), currency: notification.currentPrice.currency },
    observedAt: notification.observedAt.toIsoString(),
  };
}
