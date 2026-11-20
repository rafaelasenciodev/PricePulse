/**
 * What happens when an Evaluation and a User act on the same Price Alert (BR-08 of feature 04):
 * the Evaluation, with the real adapters. The requests of the User are tested with their use cases.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  InMemoryCurrentPriceSource,
  InMemoryNotificationRepository,
  InMemoryPriceAlertRepository,
} from "../../../src/price-alerts/adapters";
import { AlertStateChanged, EvaluatePriceAlerts } from "../../../src/price-alerts/application";
import { AlertStatus, PriceAlert, TargetPrice, newAlertId, type Notification } from "../../../src/price-alerts/domain";
import { ListingId, ObservedAt, Price, UserId } from "../../../src/shared/domain";
import { CREATED_AT } from "../../support/created-at";

const LISTING = ListingId("headphones-shop-a");

let alerts: InMemoryPriceAlertRepository;
let prices: InMemoryCurrentPriceSource;

const eur = (amount: string) => Price.fromDecimalString(amount, "EUR");

const givenAlert = async (owner: string) => {
  const alert = new PriceAlert(newAlertId(), UserId(owner), LISTING, TargetPrice.fromDecimalString("80.00", "EUR"), AlertStatus.Active, CREATED_AT);
  await alerts.add(alert);
  return alert;
};

const statusOf = (alert: PriceAlert) => alerts.all().find((a) => a.id === alert.id)?.status;

beforeEach(() => {
  alerts = new InMemoryPriceAlertRepository();
  prices = new InMemoryCurrentPriceSource();
  prices.set(LISTING, { price: eur("75.00"), observedAt: ObservedAt.fromIsoString("2026-11-19T10:00:00Z") });
});

describe("an Evaluation and a cancellation of the same Price Alert", () => {
  it("SC-09 / BR-03: a Cancelled Price Alert is not evaluated again", async () => {
    const alert = await givenAlert("user-1");
    await alerts.save(alert.cancel(), AlertStatus.Active);
    const notifications = new InMemoryNotificationRepository();

    const result = await new EvaluatePriceAlerts(alerts, notifications, prices).execute({ listingId: LISTING });

    expect(result).toEqual({ triggered: [], failed: [] });
    expect(statusOf(alert)).toBe(AlertStatus.Cancelled);
    expect(notifications.all()).toEqual([]);
  });

  it("SC-21 / BR-08: a Notification produced just before a cancellation stays stored, and the Evaluation reports that it could not finish the alert", async () => {
    const alert = await givenAlert("user-1");
    // The User cancels at the moment between the Notification being stored and the alert being saved.
    class CancelsAfterStoring extends InMemoryNotificationRepository {
      override async add(notification: Notification): Promise<void> {
        await super.add(notification);
        await alerts.save(alert.cancel(), AlertStatus.Active);
      }
    }
    const notifications = new CancelsAfterStoring();

    const result = await new EvaluatePriceAlerts(alerts, notifications, prices).execute({ listingId: LISTING });

    expect(statusOf(alert)).toBe(AlertStatus.Cancelled);
    expect(notifications.all()).toHaveLength(1);
    expect(result.triggered).toEqual([]);
    expect(result.failed.map((f) => f.alertId)).toEqual([alert.id]);
    expect(result.failed[0]?.error).toBeInstanceOf(AlertStateChanged);
  });

  it("BR-08: the Evaluation that loses to a User goes on with the other alerts of the Listing", async () => {
    const lost = await givenAlert("user-1");
    const other = await givenAlert("user-2");
    class CancelsTheFirst extends InMemoryNotificationRepository {
      override async add(notification: Notification): Promise<void> {
        await super.add(notification);
        if (notification.alertId === lost.id) await alerts.save(lost.cancel(), AlertStatus.Active);
      }
    }

    const result = await new EvaluatePriceAlerts(alerts, new CancelsTheFirst(), prices).execute({ listingId: LISTING });

    expect(statusOf(lost)).toBe(AlertStatus.Cancelled);
    expect(statusOf(other)).toBe(AlertStatus.Triggered);
    expect(result.triggered).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
  });
});
