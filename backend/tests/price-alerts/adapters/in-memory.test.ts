/**
 * Contract tests of the in-memory adapters.
 *
 * They check that the adapters honour the contract of the ports, so that a future
 * persistence adapter can be held to the same expectations.
 */

import { describe, expect, it } from "vitest";
import { InMemoryListingReader, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { ListingId, Price } from "../../../src/shared/domain";
import { describeAlertRepositoryBaseContract } from "./alert-repository-contract";

const LISTING = ListingId("headphones-shop-a");

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

describeAlertRepositoryBaseContract("InMemoryPriceAlertRepository", () => new InMemoryPriceAlertRepository());
