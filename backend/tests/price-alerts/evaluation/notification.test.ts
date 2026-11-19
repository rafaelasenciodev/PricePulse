import { describe, expect, it } from "vitest";
import {
  AlertStatus,
  Notification,
  PriceAlert,
  TargetNotReached,
  TargetPrice,
  UserId,
  newAlertId,
} from "../../../src/price-alerts/domain";
import { ListingId, ObservedAt, Price } from "../../../src/shared/domain";

const OWNER = UserId("user-1");
const LISTING = ListingId("headphones-shop-a");
const OBSERVED_AT = ObservedAt.fromIsoString("2026-11-19T10:00:00Z");

const eur = (amount: string) => Price.fromDecimalString(amount, "EUR");

const active = (target: string) =>
  new PriceAlert(newAlertId(), OWNER, LISTING, TargetPrice.fromDecimalString(target, "EUR"), AlertStatus.Active);

describe("Notification.produce", () => {
  it("SC-01 / BR-04: states the Price Alert, its owner, the Listing, the Target Price and the Current Price with its Observed At", () => {
    const alert = active("80.00");
    const notification = Notification.produce({ alert, currentPrice: eur("79.90"), observedAt: OBSERVED_AT });
    expect(notification.alertId).toBe(alert.id);
    expect(notification.owner).toBe(OWNER);
    expect(notification.listingId).toBe(LISTING);
    expect(notification.targetPrice.equals(alert.targetPrice)).toBe(true);
    expect(notification.currentPrice.equals(eur("79.90"))).toBe(true);
    expect(notification.observedAt.equals(OBSERVED_AT)).toBe(true);
  });

  it("SC-02 / BR-04: is produced when the Current Price equals the Target Price", () => {
    expect(() => Notification.produce({ alert: active("80.00"), currentPrice: eur("80.00"), observedAt: OBSERVED_AT })).not.toThrow();
  });

  it("BR-04: is not produced when the Current Price does not reach the Target Price", () => {
    const outcome = () => Notification.produce({ alert: active("80.00"), currentPrice: eur("80.01"), observedAt: OBSERVED_AT });
    expect(outcome).toThrow(TargetNotReached);
  });

  it("BR-04: is not produced for a Price Alert that is already Triggered", () => {
    const triggered = active("80.00").trigger();
    const outcome = () => Notification.produce({ alert: triggered, currentPrice: eur("50.00"), observedAt: OBSERVED_AT });
    expect(outcome).toThrow(TargetNotReached);
  });

  it("BR-08: has no channel and no delivery state, only what BR-04 lists", () => {
    const notification = Notification.produce({ alert: active("80.00"), currentPrice: eur("79.90"), observedAt: OBSERVED_AT });
    expect(Object.keys(notification).sort()).toEqual(
      ["alertId", "currentPrice", "listingId", "observedAt", "owner", "targetPrice"],
    );
  });
});
