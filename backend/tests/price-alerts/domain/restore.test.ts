import { describe, expect, it } from "vitest";
import { Notification, TargetNotReached, TargetPrice, newAlertId } from "../../../src/price-alerts/domain";
import { ListingId, ObservedAt, Price, UserId } from "../../../src/shared/domain";

const restore = (target: string, current: string, currentCurrency = "EUR") =>
  Notification.restore(
    newAlertId(),
    UserId("user-1"),
    ListingId("headphones-shop-a"),
    TargetPrice.fromDecimalString(target, "EUR"),
    Price.fromDecimalString(current, currentCurrency),
    ObservedAt.fromIsoString("2026-11-19T10:00:00Z"),
  );

describe("Notification.restore", () => {
  it("rebuilds a Notification whose Current Price reaches its Target Price, also when they are equal", () => {
    expect(restore("80.00", "75.00").currentPrice.toDecimalString()).toBe("75.00");
    expect(restore("80.00", "80.00").currentPrice.toDecimalString()).toBe("80.00");
  });

  it("refuses stored data whose Current Price does not reach the Target Price", () => {
    expect(() => restore("80.00", "80.01")).toThrow(TargetNotReached);
  });

  it("refuses stored data whose prices are in different currencies", () => {
    expect(() => restore("80.00", "75.00", "USD")).toThrow();
  });
});
