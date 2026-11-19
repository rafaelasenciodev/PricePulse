/** Tests of ComposedListingReader with stub sources: it only combines them. */

import { describe, expect, it } from "vitest";
import { ComposedListingReader } from "../../../src/price-alerts/adapters";
import { ListingId, Price } from "../../../src/shared/domain";

const LISTING = ListingId("headphones-shop-a");

describe("ComposedListingReader (contract of ListingReader)", () => {
  it("BR-02: returns nothing for a Listing that does not exist", async () => {
    const reader = new ComposedListingReader(
      async () => null,
      async () => Price.fromDecimalString("10.00", "EUR"),
    );
    expect(await reader.get(LISTING)).toBeNull();
  });

  it("does not look for a price when the Listing does not exist", async () => {
    let priceLookups = 0;
    const reader = new ComposedListingReader(
      async () => null,
      async () => {
        priceLookups += 1;
        return null;
      },
    );
    await reader.get(LISTING);
    expect(priceLookups).toBe(0);
  });

  it("returns the currency and the Current Price together", async () => {
    const price = Price.fromDecimalString("100.00", "EUR");
    const reader = new ComposedListingReader(
      async () => "EUR",
      async () => price,
    );
    expect(await reader.get(LISTING)).toEqual({ currency: "EUR", currentPrice: price });
  });

  it("BR-06: a Listing without a Current Price is returned with its currency and no price", async () => {
    const reader = new ComposedListingReader(
      async () => "USD",
      async () => null,
    );
    expect(await reader.get(LISTING)).toEqual({ currency: "USD", currentPrice: null });
  });

  it("asks both sources about the Listing it was asked for", async () => {
    const asked: string[] = [];
    const reader = new ComposedListingReader(
      async (id) => {
        asked.push(`currency:${id}`);
        return "EUR";
      },
      async (id) => {
        asked.push(`price:${id}`);
        return null;
      },
    );
    await reader.get(LISTING);
    expect(asked).toEqual(["currency:headphones-shop-a", "price:headphones-shop-a"]);
  });

  it("a failure of a source reaches the caller", async () => {
    const reader = new ComposedListingReader(
      async () => "EUR",
      async () => {
        throw new Error("the observations are unavailable");
      },
    );
    await expect(reader.get(LISTING)).rejects.toThrow("the observations are unavailable");
  });
});
