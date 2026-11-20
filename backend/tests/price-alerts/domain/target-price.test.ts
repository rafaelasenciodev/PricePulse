import { describe, expect, it } from "vitest";
import { CurrencyMismatch, NonPositiveTargetPrice, TargetPrice } from "../../../src/price-alerts/domain";
import { Price } from "../../../src/shared/domain";

const eur = (amount: string) => Price.fromDecimalString(amount, "EUR");

describe("TargetPrice", () => {
  it.each(["0.00", "-5.00"])(
    "SC-11 / BR-03: rejects %s, a Target Price that is not greater than zero",
    (amount) => {
      expect(() => TargetPrice.fromDecimalString(amount, "EUR")).toThrow(NonPositiveTargetPrice);
    },
  );

  it("takes the amount and the currency it is given", () => {
    const target = TargetPrice.fromDecimalString("80.00", "USD");
    expect(target.toDecimalString()).toBe("80.00");
    expect(target.currency).toBe("USD");
  });

  it.each([
    ["80.00", "75.00", true, "SC-10: the price fell below the target"],
    ["100.00", "100.00", true, "SC-08 / BR-05: the threshold is inclusive"],
    ["120.00", "100.00", true, "SC-09: the target is above the price"],
    ["80.00", "100.00", false, "SC-01: not reached"],
    ["99.99", "100.00", false, "SC-03: one cent below the price is not reached"],
  ])("BR-05: target %s, current price %s, reached %s (%s)", (target, current, reached) => {
    expect(TargetPrice.fromDecimalString(target, "EUR").isReachedBy(eur(current))).toBe(reached);
  });

  it("comparing prices in different currencies is an error", () => {
    const target = TargetPrice.fromDecimalString("80.00", "EUR");
    expect(() => target.isReachedBy(Price.fromDecimalString("75.00", "USD"))).toThrow(
      CurrencyMismatch,
    );
  });

  it("BR-08: target prices with the same value are equal", () => {
    const eighty = TargetPrice.fromDecimalString("80.0", "EUR");
    expect(eighty.equals(TargetPrice.fromDecimalString("80.00", "EUR"))).toBe(true);
    expect(eighty.equals(TargetPrice.fromDecimalString("70.00", "EUR"))).toBe(false);
  });
});
