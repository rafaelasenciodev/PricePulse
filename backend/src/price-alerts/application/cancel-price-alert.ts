/** UC-04 Cancel a Price Alert (see the design of feature 04). */

import { AlertStatus, type AlertId, type UserId } from "../domain";
import { AlertConflict, AlertNotActive, AlertNotFound } from "./errors";
import { AlertStateChanged, type PriceAlertRepository } from "./ports";
import { toView, type PriceAlertView } from "./price-alert-view";

export interface CancelPriceAlertCommand {
  /** Comes from the authentication of the request, never from the client. */
  readonly owner: UserId;
  readonly alertId: AlertId;
}

export interface CancelPriceAlertResult {
  readonly alert: PriceAlertView;
  /** false when the alert was already Cancelled and nothing was changed (BR-04). */
  readonly changed: boolean;
}

export class CancelPriceAlert {
  constructor(private readonly alerts: PriceAlertRepository) {}

  async execute(command: CancelPriceAlertCommand): Promise<CancelPriceAlertResult> {
    // 1. The alert is the User's (BR-01)
    const alert = await this.alerts.find(command.owner, command.alertId);
    if (alert === null) throw new AlertNotFound(command.alertId);

    // 2. Cancelling a Cancelled alert succeeds and changes nothing (BR-04)
    if (alert.status === AlertStatus.Cancelled) return { alert: toView(alert), changed: false };

    // 3. A Triggered alert has ended: it cannot be cancelled (BR-04)
    if (alert.status !== AlertStatus.Active) throw new AlertNotActive(alert.status);

    // 4. Cancel it, if it is still in the state that was read (BR-03, BR-08)
    const cancelled = alert.cancel();
    try {
      await this.alerts.save(cancelled, alert.status);
    } catch (error) {
      if (error instanceof AlertStateChanged) throw new AlertConflict();
      throw error;
    }
    return { alert: toView(cancelled), changed: true };
  }
}
