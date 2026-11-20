import { describe, expect, it } from "vitest";
import { NegativePrice, PriceObservation, ProviderId } from "../../../src/price-observations/domain";
import { ListingId, ObservedAt, Price } from "../../../src/shared/domain";

const restore = (price: Price | null) =>
  PriceObservation.restore(ProviderId("simulator"), ListingId("headphones-shop-a"), ObservedAt.fromIsoString("2026-11-19T10:00:00Z"), price);

describe("PriceObservation.restore", () => {
  it("rebuilds an observation with a price, with a price of zero, and with none", () => {
    expect(restore(Price.fromDecimalString("79.90", "EUR"))?.price?.toDecimalString()).toBe("79.90");
    expect(restore(Price.fromDecimalString("0.00", "EUR"))?.price?.toDecimalString()).toBe("0.00");
    expect(restore(null).price).toBeNull();
  });

  it("refuses stored data with a negative price", () => {
    expect(() => restore(Price.fromDecimalString("-0.01", "EUR"))).toThrow(NegativePrice);
  });
});
