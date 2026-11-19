/** UC-01 Evaluate the Price Alerts of a Listing (see the use case contract of feature 03). */

import type { ListingId } from "../../shared/domain";
import { Notification, type PriceAlert } from "../domain";
import {
  NotificationAlreadyExists,
  type CurrentPrice,
  type CurrentPriceSource,
  type NotificationRepository,
  type PriceAlertRepository,
} from "./ports";

export interface EvaluatePriceAlertsCommand {
  /** The Listing to evaluate. It may not exist (BR-10). */
  readonly listingId: ListingId;
}

export interface NotificationView {
  readonly alertId: string;
  readonly owner: string;
  readonly listingId: string;
  readonly targetPrice: { readonly amount: string; readonly currency: string };
  readonly currentPrice: { readonly amount: string; readonly currency: string };
  /** In UTC, such as "2026-11-19T10:00:00.000Z". */
  readonly observedAt: string;
}

export interface TriggeredAlertView {
  readonly notification: NotificationView;
  /** false when the Notification already existed and this run only made the alert Triggered (BR-06). */
  readonly produced: boolean;
}

export interface FailedAlertView {
  readonly alertId: string;
  readonly error: Error;
}

export interface EvaluatePriceAlertsResult {
  /** The Price Alerts that became Triggered in this run. */
  readonly triggered: readonly TriggeredAlertView[];
  /** The Price Alerts that could not be processed. They are left as they were and a later run repeats them. */
  readonly failed: readonly FailedAlertView[];
}

export class EvaluatePriceAlerts {
  constructor(
    private readonly alerts: PriceAlertRepository,
    private readonly notifications: NotificationRepository,
    private readonly prices: CurrentPriceSource,
  ) {}

  async execute(command: EvaluatePriceAlertsCommand): Promise<EvaluatePriceAlertsResult> {
    // 1. The Active Price Alerts of the Listing (BR-01). A Listing that does not exist has none (BR-10).
    const alerts = await this.alerts.findActiveByListing(command.listingId);
    if (alerts.length === 0) return { triggered: [], failed: [] };

    // 2. The Current Price, once: every alert of this run is compared with the same price.
    const currentPrice = await this.prices.currentPriceOf(command.listingId);

    // 3. Each alert on its own: one that fails does not stop the others.
    const triggered: TriggeredAlertView[] = [];
    const failed: FailedAlertView[] = [];
    for (const alert of alerts) {
      try {
        const outcome = await this.evaluate(alert, currentPrice);
        if (outcome !== null) triggered.push(outcome);
      } catch (error) {
        failed.push({ alertId: alert.id, error: error instanceof Error ? error : new Error(String(error)) });
      }
    }
    return { triggered, failed };
  }

  /** The alert made Triggered with its Notification, or null if it stays Active. */
  private async evaluate(alert: PriceAlert, currentPrice: CurrentPrice | null): Promise<TriggeredAlertView | null> {
    // 3.1 A Notification may already exist: it decides, whatever the price is now (BR-06).
    let notification = await this.notifications.findByAlert(alert.id);
    let produced = false;

    if (notification === null) {
      // 3.2 Not reached: the alert stays Active (BR-02, BR-03).
      if (currentPrice === null || !alert.isReachedBy(currentPrice.price)) return null;

      // 3.3 Reached: produce the Notification and store it first (BR-04, BR-06).
      const created = Notification.produce({ alert, currentPrice: currentPrice.price, observedAt: currentPrice.observedAt });
      try {
        await this.notifications.add(created);
        notification = created;
        produced = true;
      } catch (error) {
        if (!(error instanceof NotificationAlreadyExists)) throw error;
        // Another Evaluation added it first (BR-05): go on with the stored one.
        notification = await this.notifications.findByAlert(alert.id);
        if (notification === null) throw new Error("A Notification was refused as existing, but none is stored");
      }
    }

    // 3.4 Only then does the alert become Triggered (BR-06).
    await this.alerts.save(alert.trigger());
    return { notification: toView(notification), produced };
  }
}

function toView(notification: Notification): NotificationView {
  return {
    alertId: notification.alertId,
    owner: notification.owner,
    listingId: notification.listingId,
    targetPrice: { amount: notification.targetPrice.toDecimalString(), currency: notification.targetPrice.currency },
    currentPrice: { amount: notification.currentPrice.toDecimalString(), currency: notification.currentPrice.currency },
    observedAt: notification.observedAt.toIsoString(),
  };
}
