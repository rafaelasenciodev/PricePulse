/** UC-02 Read a Price Alert (see the design of feature 04). */

import type { AlertId } from "../domain";
import { AlertNotFound } from "./errors";
import { toView, type PriceAlertView } from "./price-alert-view";
import type { PriceAlertRepository } from "./ports";
import type { UserId } from "../../shared/domain";

export interface GetPriceAlertCommand {
  /** Comes from the authentication of the request, never from the client. */
  readonly owner: UserId;
  readonly alertId: AlertId;
}

export interface GetPriceAlertResult {
  readonly alert: PriceAlertView;
}

export class GetPriceAlert {
  constructor(private readonly alerts: PriceAlertRepository) {}

  async execute(command: GetPriceAlertCommand): Promise<GetPriceAlertResult> {
    // One that belongs to another User is not found, as one that does not exist (BR-01).
    const alert = await this.alerts.find(command.owner, command.alertId);
    if (alert === null) throw new AlertNotFound(command.alertId);
    return { alert: toView(alert) };
  }
}
