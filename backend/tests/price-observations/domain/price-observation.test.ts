import { describe, expect, it } from "vitest";
import {
  NegativePrice,
  ObservationCurrencyMismatch,
  ObservedInTheFuture,
  PriceObservation,
  ProviderId,
  type PriceObservationInput,
} from "../../../src/price-observations/domain";
import { ListingId, ObservedAt, Price } from "../../../src/shared/domain";

const FIVE_MINUTES = 5 * 60 * 1000;
const RECORDED_AT = new Date("2026-11-19T10:30:00Z");

const eur = (amount: string) => Price.fromDecimalString(amount, "EUR");

/** A valid recording, which each test changes in the one thing it is about. */
function record(changes: Partial<PriceObservationInput> = {}): PriceObservation {
  return PriceObservation.record({
    provider: ProviderId("simulator"),
    listingId: ListingId("headphones-shop-a"),
    observedAt: ObservedAt.fromIsoString("2026-11-19T10:00:00Z"),
    price: eur("79.90"),
    listingCurrency: "EUR",
    recordedAt: RECORDED_AT,
    toleranceMilliseconds: FIVE_MINUTES,
    ...changes,
  });
}

describe("PriceObservation: recording", () => {
  it("SC-01 / BR-03: keeps the Provider, the Listing, the Observed At and the Price", () => {
    const observation = record();
    expect(observation.provider).toBe("simulator");
    expect(observation.listingId).toBe("headphones-shop-a");
    expect(observation.observedAt.toIsoString()).toBe("2026-11-19T10:00:00.000Z");
    expect(observation.price?.toDecimalString()).toBe("79.90");
    expect(observation.price?.currency).toBe("EUR");
  });

  it("SC-02 / BR-03: records an observation without a Price, which means unavailable", () => {
    expect(record({ price: null }).price).toBeNull();
  });

  it("SC-03 / BR-04: accepts a Price of zero", () => {
    expect(record({ price: eur("0.00") }).price?.minorUnits).toBe(0);
  });

  it.each(["-5.00", "-0.01"])("SC-12 / BR-04: rejects a negative Price of %s", (amount) => {
    expect(() => record({ price: eur(amount) })).toThrow(NegativePrice);
  });

  it("SC-14 / BR-05: rejects a Price in another currency than the Listing", () => {
    const dollars = Price.fromDecimalString("79.90", "USD");
    expect(() => record({ price: dollars, listingCurrency: "EUR" })).toThrow(ObservationCurrencyMismatch);
  });

  it("BR-03 / BR-05: with no Price there is no currency to compare", () => {
    expect(() => record({ price: null, listingCurrency: "USD" })).not.toThrow();
  });
});

describe("PriceObservation: the Observed At against the moment of recording", () => {
  const at = (iso: string) => ObservedAt.fromIsoString(iso);

  it("SC-09 / BR-08: accepts an Observed At in the past, however old", () => {
    expect(() => record({ observedAt: at("2020-01-01T00:00:00Z") })).not.toThrow();
  });

  it("accepts an Observed At equal to the moment of recording", () => {
    expect(() => record({ observedAt: at("2026-11-19T10:30:00Z") })).not.toThrow();
  });

  it("SC-10 / BR-12: accepts an Observed At later than the moment of recording, up to the tolerance", () => {
    expect(() => record({ observedAt: at("2026-11-19T10:34:00Z") })).not.toThrow();
    expect(() => record({ observedAt: at("2026-11-19T10:35:00Z") })).not.toThrow(); // exactly the tolerance
  });

  it("SC-11 / BR-12: rejects an Observed At beyond the tolerance, by one millisecond", () => {
    expect(() => record({ observedAt: at("2026-11-19T10:35:00.001Z") })).toThrow(ObservedInTheFuture);
  });

  it("SC-11 / BR-12: also rejects it when the Listing has no Price", () => {
    expect(() => record({ price: null, observedAt: at("2026-11-19T12:00:00Z") })).toThrow(ObservedInTheFuture);
  });

  it("BR-12: the tolerance is a parameter: with none, any later instant is rejected", () => {
    expect(() => record({ observedAt: at("2026-11-19T10:30:00.001Z"), toleranceMilliseconds: 0 })).toThrow(
      ObservedInTheFuture,
    );
  });

  it("refuses to judge with an invalid moment of recording, instead of accepting everything", () => {
    expect(() => record({ recordedAt: new Date(Number.NaN) })).toThrow("not a valid date");
  });
});

describe("PriceObservation: comparing content", () => {
  it("BR-09: two observations with the same Price have the same content", () => {
    expect(record({ price: eur("79.90") }).hasSameContentAs(record({ price: eur("79.90") }))).toBe(true);
  });

  it("BR-09: two observations without a Price have the same content", () => {
    expect(record({ price: null }).hasSameContentAs(record({ price: null }))).toBe(true);
  });

  it("BR-10: two observations with different Prices have different content", () => {
    expect(record({ price: eur("79.90") }).hasSameContentAs(record({ price: eur("85.00") }))).toBe(false);
  });

  it("BR-10: an observation with a Price and one without have different content, in both directions", () => {
    const withPrice = record({ price: eur("79.90") });
    const without = record({ price: null });
    expect(withPrice.hasSameContentAs(without)).toBe(false);
    expect(without.hasSameContentAs(withPrice)).toBe(false);
  });

  it("BR-09: a Price of zero is not the same as no Price", () => {
    expect(record({ price: eur("0.00") }).hasSameContentAs(record({ price: null }))).toBe(false);
  });

  it("BR-09: the content does not depend on when it was observed", () => {
    const earlier = record({ observedAt: ObservedAt.fromIsoString("2026-11-19T09:00:00Z") });
    const later = record({ observedAt: ObservedAt.fromIsoString("2026-11-19T10:00:00Z") });
    expect(earlier.hasSameContentAs(later)).toBe(true);
  });
});
