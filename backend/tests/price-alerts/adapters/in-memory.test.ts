/**
 * Contract tests of the in-memory adapters.
 *
 * They check that the adapters honour the contract of the ports, so that a future
 * persistence adapter can be held to the same expectations.
 */

import { describe, expect, it } from "vitest";
import { InMemoryListingReader, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { ActiveAlertAlreadyExists } from "../../../src/price-alerts/application";
import {
  AlertStatus,
  PriceAlert,
  TargetPrice,
  UserId,
  newAlertId,
} from "../../../src/price-alerts/domain";
import { ListingId, Price } from "../../../src/shared/domain";

const USER = UserId("user-1");
const OTHER_USER = UserId("user-2");
const LISTING = ListingId("headphones-shop-a");
const OTHER_LISTING = ListingId("keyboard-shop-a");

const alert = (
  owner: UserId = USER,
  listing: ListingId = LISTING,
  status: AlertStatus = AlertStatus.Active,
) => new PriceAlert(newAlertId(), owner, listing, TargetPrice.fromDecimalString("80.00", "EUR"), status);

describe("InMemoryListingReader", () => {
  it("returns nothing for an unknown Listing", async () => {
    expect(await new InMemoryListingReader().get(LISTING)).toBeNull();
  });

  it("returns the currency and the Current Price together", async () => {
    const reader = new InMemoryListingReader();
    const price = Price.fromDecimalString("100.00", "EUR");
    reader.addListing(LISTING, "EUR", price);
    const view = await reader.get(LISTING);
    expect(view?.currency).toBe("EUR");
    expect(view?.currentPrice?.equals(price)).toBe(true);
  });

  it("can return a Listing without a Current Price", async () => {
    const reader = new InMemoryListingReader();
    reader.addListing(LISTING, "EUR");
    expect((await reader.get(LISTING))?.currentPrice).toBeNull();
  });
});

describe("InMemoryPriceAlertRepository", () => {
  it("finds the Active Price Alert of an owner for a Listing", async () => {
    const repository = new InMemoryPriceAlertRepository();
    const stored = alert();
    await repository.add(stored);
    expect((await repository.findActive(USER, LISTING))?.equals(stored)).toBe(true);
  });

  it("find is scoped to owner and Listing", async () => {
    const repository = new InMemoryPriceAlertRepository();
    await repository.add(alert());
    expect(await repository.findActive(OTHER_USER, LISTING)).toBeNull();
    expect(await repository.findActive(USER, OTHER_LISTING)).toBeNull();
  });

  it("never returns a Triggered Price Alert", async () => {
    const repository = new InMemoryPriceAlertRepository();
    await repository.add(alert(USER, LISTING, AlertStatus.Triggered));
    expect(await repository.findActive(USER, LISTING)).toBeNull();
  });

  it("BR-07: refuses a second Active Price Alert for the same owner and Listing", async () => {
    const repository = new InMemoryPriceAlertRepository();
    await repository.add(alert());
    await expect(repository.add(alert())).rejects.toThrow(ActiveAlertAlreadyExists);
    expect(repository.all()).toHaveLength(1);
  });

  it.each([
    ["another owner", () => alert(OTHER_USER)],
    ["another Listing", () => alert(USER, OTHER_LISTING)],
    ["a Triggered Price Alert", () => alert(USER, LISTING, AlertStatus.Triggered)],
  ])("accepts an alert that does not conflict: %s", async (_name, second) => {
    const repository = new InMemoryPriceAlertRepository();
    await repository.add(alert());
    await repository.add(second());
    expect(repository.all()).toHaveLength(2);
  });

  it("keeps the guarantee when two adds are started at the same time", async () => {
    const repository = new InMemoryPriceAlertRepository();
    const results = await Promise.allSettled([repository.add(alert()), repository.add(alert())]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(repository.all()).toHaveLength(1);
  });
});
