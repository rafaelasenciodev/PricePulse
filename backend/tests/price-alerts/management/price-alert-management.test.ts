import { describe, expect, it } from "vitest";
import {
  AlertNotActive,
  AlertStatus,
  CurrencyMismatch,
  PriceAlert,
  TargetAlreadyReached,
  TargetPrice,
  UserId,
  newAlertId,
} from "../../../src/price-alerts/domain";
import { ListingId, Price } from "../../../src/shared/domain";
import { CREATED_AT } from "../../support/created-at";

const OWNER = UserId("user-1");
const LISTING = ListingId("headphones-shop-a");

const eur = (amount: string) => Price.fromDecimalString(amount, "EUR");
const target = (amount: string, currency = "EUR") => TargetPrice.fromDecimalString(amount, currency);

/** A Price Alert in the given state, with a Target Price of 80.00 EUR. */
const alertIn = (status: AlertStatus) =>
  new PriceAlert(newAlertId(), OWNER, LISTING, target("80.00"), status, CREATED_AT);

const active = () => alertIn(AlertStatus.Active);
const triggered = () => alertIn(AlertStatus.Triggered);
const cancelled = () => alertIn(AlertStatus.Cancelled);

describe("PriceAlert.cancel", () => {
  it("SC-08 / BR-03: an Active Price Alert becomes Cancelled, and it is no longer Active", () => {
    const result = active().cancel();
    expect(result.status).toBe(AlertStatus.Cancelled);
    expect(result.isActive).toBe(false);
  });

  it("keeps everything else: identifier, owner, Listing, Target Price and creation moment", () => {
    const alert = active();
    const result = alert.cancel();
    expect(result.equals(alert)).toBe(true);
    expect(result.owner).toBe(alert.owner);
    expect(result.listingId).toBe(alert.listingId);
    expect(result.targetPrice.equals(alert.targetPrice)).toBe(true);
    expect(result.createdAt.equals(alert.createdAt)).toBe(true);
  });

  it("does not change the Price Alert it is called on", () => {
    const alert = active();
    alert.cancel();
    expect(alert.status).toBe(AlertStatus.Active);
  });

  it.each([
    ["Triggered", triggered],
    ["Cancelled", cancelled],
  ])("BR-04: only an Active Price Alert can be cancelled, not a %s one", (_state, make) => {
    expect(() => make().cancel()).toThrow(AlertNotActive);
  });
});

describe("a Cancelled Price Alert", () => {
  it("SC-09 / BR-03: is never reached, however low the Current Price is", () => {
    expect(cancelled().isReachedBy(eur("0.00"))).toBe(false);
  });

  it("cannot be Triggered", () => {
    expect(() => cancelled().trigger()).toThrow(AlertNotActive);
  });
});

describe("PriceAlert.changeTargetPrice", () => {
  it("SC-14 / BR-05: gives an Active Price Alert another Target Price and leaves it Active", () => {
    const result = active().changeTargetPrice(target("70.00"), eur("100.00"));
    expect(result.targetPrice.equals(target("70.00"))).toBe(true);
    expect(result.status).toBe(AlertStatus.Active);
  });

  it("SC-14 / BR-06 / BR-09: the identifier, owner, Listing and creation moment do not change", () => {
    const alert = active();
    const result = alert.changeTargetPrice(target("70.00"), eur("100.00"));
    expect(result.equals(alert)).toBe(true);
    expect(result.owner).toBe(alert.owner);
    expect(result.listingId).toBe(alert.listingId);
    expect(result.createdAt.equals(alert.createdAt)).toBe(true);
  });

  it("does not change the Price Alert it is called on", () => {
    const alert = active();
    alert.changeTargetPrice(target("70.00"), eur("100.00"));
    expect(alert.targetPrice.equals(target("80.00"))).toBe(true);
  });

  it.each([["80.01"], ["85.00"], ["100.00"]])(
    "SC-16 / BR-05: rejects a Target Price of %s when the Current Price is 80.00, which already reaches it",
    (amount) => {
      expect(() => active().changeTargetPrice(target(amount), eur("80.00"))).toThrow(TargetAlreadyReached);
    },
  );

  it("SC-16 / BR-05: a Target Price below the Current Price is accepted, even by one cent", () => {
    expect(() => active().changeTargetPrice(target("79.99"), eur("80.00"))).not.toThrow();
  });

  it("SC-19 / BR-05: without a Current Price any Target Price is accepted", () => {
    const result = active().changeTargetPrice(target("90.00"), null);
    expect(result.targetPrice.equals(target("90.00"))).toBe(true);
  });

  it.each([
    ["Triggered", triggered],
    ["Cancelled", cancelled],
  ])("SC-17 / BR-05: only an Active Price Alert can be modified, not a %s one", (_state, make) => {
    expect(() => make().changeTargetPrice(target("70.00"), eur("100.00"))).toThrow(AlertNotActive);
  });

  it("the state is checked before the price: a Cancelled alert is not Active whatever the price", () => {
    expect(() => cancelled().changeTargetPrice(target("90.00"), eur("50.00"))).toThrow(AlertNotActive);
  });

  it("the currency of the alert does not change: a Target Price in another currency is an inconsistency", () => {
    expect(() => active().changeTargetPrice(target("70.00", "USD"), null)).toThrow(CurrencyMismatch);
  });

  it("the same Target Price is a valid change as far as the model goes: the use case decides it means nothing changed (BR-06)", () => {
    const result = active().changeTargetPrice(target("80.00"), eur("100.00"));
    expect(result.targetPrice.equals(target("80.00"))).toBe(true);
  });

  it("the same Target Price is rejected when the Current Price reaches it: the use case checks for it first", () => {
    expect(() => active().changeTargetPrice(target("80.00"), eur("75.00"))).toThrow(TargetAlreadyReached);
  });
});
