/** UC-01 List my Price Alerts (see the design of feature 04). */

import type { AlertStatus, UserId } from "../domain";
import { toView, type PriceAlertView } from "./price-alert-view";
import type { PriceAlertRepository } from "./ports";

export interface ListPriceAlertsCommand {
  /** Comes from the authentication of the request, never from the client. */
  readonly owner: UserId;
  /** Only the alerts in this state. Without it, all of them. */
  readonly status?: AlertStatus;
  /** How many alerts at most. The way in checks that it is valid. */
  readonly limit: number;
  /** How many alerts to skip. The way in checks that it is valid. */
  readonly offset: number;
}

export interface ListPriceAlertsResult {
  /** The page, newest first (BR-02). */
  readonly items: readonly PriceAlertView[];
  /** How many Price Alerts of the User match, in all pages. */
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export class ListPriceAlerts {
  constructor(private readonly alerts: PriceAlertRepository) {}

  async execute(command: ListPriceAlertsCommand): Promise<ListPriceAlertsResult> {
    const { owner, status, limit, offset } = command;
    // The query is by owner, so the alerts of another User can never come back (BR-01).
    const page = await this.alerts.findByOwner(owner, status === undefined ? { limit, offset } : { status, limit, offset });
    return { items: page.items.map(toView), total: page.total, limit, offset };
  }
}
