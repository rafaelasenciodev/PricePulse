import { describe, expect, it } from "vitest";
import {
  AlertNotActive,
  AlertStatus,
  CurrencyMismatch,
  PriceAlert,
  TargetPrice,
  newAlertId,
} from "../../../src/price-alerts/domain";
import { ListingId, Price, UserId } from "../../../src/shared/domain";
import { CREATED_AT } from "../../support/created-at";

const OWNER = UserId("user-1");
const LISTING = ListingId("headphones-shop-a");

const eur = (amount: string) => Price.fromDecimalString(amount, "EUR");

/** An Active Price Alert with the given Target Price. */
const active = (target: string) =>
  new PriceAlert(newAlertId(), OWNER, LISTING, TargetPrice.fromDecimalString(target, "EUR"), AlertStatus.Active, CREATED_AT);

describe("PriceAlert.isReachedBy", () => {
  it("SC-01 / BR-02: a Current Price below the Target Price reaches it", () => {
    expect(active("80.00").isReachedBy(eur("79.90"))).toBe(true);
  });

  it("SC-02 / BR-02: a Current Price equal to the Target Price reaches it", () => {
    expect(active("80.00").isReachedBy(eur("80.00"))).toBe(true);
  });

  it("SC-03 / BR-02: a Current Price one cent above the Target Price does not reach it", () => {
    expect(active("80.00").isReachedBy(eur("80.01"))).toBe(false);
  });

  it("SC-04 / BR-02: a Current Price of zero reaches any Target Price", () => {
    expect(active("0.01").isReachedBy(eur("0.00"))).toBe(true);
  });

  it("SC-05 / SC-06 / BR-03: without a Current Price nothing is reached", () => {
    expect(active("80.00").isReachedBy(null)).toBe(false);
  });

  it("SC-07 / BR-03: it keeps no memory of earlier prices, it only sees the one it is given", () => {
    const alert = active("80.00");
    expect(alert.isReachedBy(null)).toBe(false);
    expect(alert.isReachedBy(eur("75.00"))).toBe(true);
    expect(alert.isReachedBy(eur("95.00"))).toBe(false);
  });

  it("SC-11 / BR-01: a Triggered Price Alert is never reached, however low the price is", () => {
    const triggered = active("80.00").trigger();
    expect(triggered.isReachedBy(eur("0.00"))).toBe(false);
  });

  it("a Current Price in another currency than the Target Price is an inconsistency, not an answer", () => {
    expect(() => active("80.00").isReachedBy(Price.fromDecimalString("70.00", "USD"))).toThrow(CurrencyMismatch);
  });
});

describe("PriceAlert.trigger", () => {
  it("BR-06: returns the same Price Alert as Triggered, with its data unchanged", () => {
    const alert = active("80.00");
    const triggered = alert.trigger();
    expect(triggered.status).toBe(AlertStatus.Triggered);
    expect(triggered.isActive).toBe(false);
    expect(triggered.equals(alert)).toBe(true);
    expect(triggered.owner).toBe(alert.owner);
    expect(triggered.listingId).toBe(alert.listingId);
    expect(triggered.targetPrice.equals(alert.targetPrice)).toBe(true);
  });

  it("does not change the Price Alert it is called on", () => {
    const alert = active("80.00");
    alert.trigger();
    expect(alert.status).toBe(AlertStatus.Active);
    expect(alert.isActive).toBe(true);
  });

  it("BR-06: a Price Alert that is not Active cannot become Triggered", () => {
    expect(() => active("80.00").trigger().trigger()).toThrow(AlertNotActive);
  });
});
