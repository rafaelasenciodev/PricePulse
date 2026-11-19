import { describe, expect, it } from "vitest";
import {
  AlertId,
  AlertStatus,
  PriceAlert,
  TargetAlreadyReached,
  TargetPrice,
  UserId,
  newAlertId,
} from "../../../src/price-alerts/domain";
import { ListingId, Price } from "../../../src/shared/domain";

const OWNER = UserId("user-1");
const LISTING = ListingId("headphones-shop-a");

const create = (target: string, current: string | null) =>
  PriceAlert.create({
    id: newAlertId(),
    owner: OWNER,
    listingId: LISTING,
    targetPrice: TargetPrice.fromDecimalString(target, "EUR"),
    currentPrice: current === null ? null : Price.fromDecimalString(current, "EUR"),
  });

describe("PriceAlert.create", () => {
  it("SC-01 / BR-09: a new Price Alert is Active and keeps its data", () => {
    const alert = create("80.00", "100.00");
    expect(alert.status).toBe(AlertStatus.Active);
    expect(alert.isActive).toBe(true);
    expect(alert.owner).toBe(OWNER);
    expect(alert.listingId).toBe(LISTING);
    expect(alert.targetPrice.equals(TargetPrice.fromDecimalString("80.00", "EUR"))).toBe(true);
  });

  it("SC-02 / BR-06: can be created without a Current Price", () => {
    expect(create("80.00", null).isActive).toBe(true);
  });

  it("SC-03: a Target Price one cent below the Current Price is accepted", () => {
    expect(create("99.99", "100.00").isActive).toBe(true);
  });

  it.each(["100.00", "120.00"])(
    "SC-08 / SC-09 / BR-05: rejects target %s when the Current Price is 100.00",
    (target) => {
      expect(() => create(target, "100.00")).toThrow(TargetAlreadyReached);
    },
  );

  it("SC-10 / BR-05: uses the Current Price it is given, at creation time", () => {
    expect(() => create("80.00", "75.00")).toThrow(TargetAlreadyReached);
  });
});

describe("PriceAlert", () => {
  const target = TargetPrice.fromDecimalString("80.00", "EUR");

  it("BR-11: a Triggered Price Alert is not Active (supports SC-17)", () => {
    const alert = new PriceAlert(newAlertId(), OWNER, LISTING, target, AlertStatus.Triggered);
    expect(alert.isActive).toBe(false);
  });

  it("is the same entity when it has the same id", () => {
    const id = AlertId("alert-1");
    const first = new PriceAlert(id, OWNER, LISTING, target, AlertStatus.Active);
    const second = new PriceAlert(id, OWNER, LISTING, target, AlertStatus.Triggered);
    const other = new PriceAlert(AlertId("alert-2"), OWNER, LISTING, target, AlertStatus.Active);
    expect(first.equals(second)).toBe(true);
    expect(first.equals(other)).toBe(false);
  });
});
