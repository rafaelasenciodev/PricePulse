/**
 * The contract of NotificationRepository, as tests that any adapter must pass.
 *
 * It is a function so that the in-memory adapter and, later, a database adapter run exactly
 * the same checks: what matters is the contract of the port, not the adapter.
 * (Not a *.test.ts file: it is run from the test of each adapter.)
 */

import { beforeEach, describe, expect, it } from "vitest";
import { NotificationAlreadyExists, type NotificationRepository } from "../../../src/price-alerts/application";
import { AlertStatus, Notification, PriceAlert, TargetPrice, newAlertId } from "../../../src/price-alerts/domain";
import { ListingId, ObservedAt, Price, UserId } from "../../../src/shared/domain";
import { CREATED_AT } from "../../support/created-at";

const OWNER = UserId("user-1");
const LISTING = ListingId("headphones-shop-a");

/** An Active Price Alert that a Current Price of 75.00 EUR reaches. */
export const reachedAlert = () =>
  new PriceAlert(newAlertId(), OWNER, LISTING, TargetPrice.fromDecimalString("80.00", "EUR"), AlertStatus.Active, CREATED_AT);

export const notificationOf = (alert: PriceAlert, price = "75.00") =>
  Notification.produce({
    alert,
    currentPrice: Price.fromDecimalString(price, "EUR"),
    observedAt: ObservedAt.fromIsoString("2026-11-19T10:00:00Z"),
  });

export function describeNotificationRepositoryContract(name: string, create: () => NotificationRepository): void {
  describe(`NotificationRepository: ${name}`, () => {
    let repository: NotificationRepository;

    beforeEach(() => {
      repository = create();
    });

    it("returns nothing when nothing is stored", async () => {
      expect(await repository.findByAlert(newAlertId())).toBeNull();
    });

    it("returns the stored Notification of the Price Alert", async () => {
      const alert = reachedAlert();
      await repository.add(notificationOf(alert));
      const found = await repository.findByAlert(alert.id);
      expect(found?.alertId).toBe(alert.id);
      expect(found?.owner).toBe(OWNER);
      expect(found?.listingId).toBe(LISTING);
      expect(found?.currentPrice.toDecimalString()).toBe("75.00");
      expect(found?.observedAt.toIsoString()).toBe("2026-11-19T10:00:00.000Z");
    });

    it("finds only the Notification of the Price Alert asked for", async () => {
      await repository.add(notificationOf(reachedAlert()));
      expect(await repository.findByAlert(newAlertId())).toBeNull();
    });

    it("stores the Notifications of different Price Alerts, even of the same owner and Listing", async () => {
      const first = reachedAlert();
      const second = reachedAlert();
      await repository.add(notificationOf(first));
      await repository.add(notificationOf(second));
      expect((await repository.findByAlert(first.id))?.alertId).toBe(first.id);
      expect((await repository.findByAlert(second.id))?.alertId).toBe(second.id);
    });

    it("BR-05: refuses a second Notification of the same Price Alert, even with other content", async () => {
      const alert = reachedAlert();
      await repository.add(notificationOf(alert, "75.00"));
      await expect(repository.add(notificationOf(alert, "70.00"))).rejects.toThrow(NotificationAlreadyExists);
    });

    it("BR-05: a refused Notification does not replace the stored one", async () => {
      const alert = reachedAlert();
      await repository.add(notificationOf(alert, "75.00"));
      await repository.add(notificationOf(alert, "70.00")).catch(() => undefined);
      expect((await repository.findByAlert(alert.id))?.currentPrice.toDecimalString()).toBe("75.00");
    });

    it("BR-05: the guarantee holds when two additions start together: exactly one succeeds", async () => {
      const alert = reachedAlert();
      const outcomes = await Promise.allSettled([repository.add(notificationOf(alert)), repository.add(notificationOf(alert))]);
      expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
      const refused = outcomes.find((o) => o.status === "rejected");
      expect(refused?.status === "rejected" && refused.reason).toBeInstanceOf(NotificationAlreadyExists);
    });
  });
}
