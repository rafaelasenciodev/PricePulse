import { describe, expect, it } from "vitest";
import {
  InvalidAmount,
  Price,
  TooManyDecimals,
  UnsupportedCurrency,
} from "../../../src/price-alerts/domain";

describe("Price", () => {
  it.each([
    ["80", 8000],
    ["80.5", 8050],
    ["80.00", 8000],
    ["80.000", 8000],
    ["0.05", 5],
  ])("BR-04: accepts %s EUR (trailing zeros do not count)", (amount, minorUnits) => {
    expect(Price.fromDecimalString(amount, "EUR").minorUnits).toBe(minorUnits);
  });

  it.each(["79.999", "0.001"])(
    "SC-12 / BR-04: rejects %s EUR, more decimals than the currency allows",
    (amount) => {
      expect(() => Price.fromDecimalString(amount, "EUR")).toThrow(TooManyDecimals);
    },
  );

  it.each(["NaN", "Infinity", "", "abc", "1e3", "+5", "5.", ".5", " 5"])(
    "rejects %j, which is not a plain decimal number",
    (amount) => {
      expect(() => Price.fromDecimalString(amount, "EUR")).toThrow(InvalidAmount);
    },
  );

  it("rejects an amount too large to be represented exactly", () => {
    expect(() => Price.fromDecimalString("99999999999999999999", "EUR")).toThrow(InvalidAmount);
  });

  it("rejects an unsupported currency", () => {
    expect(() => Price.fromDecimalString("10.00", "XYZ")).toThrow(UnsupportedCurrency);
    expect(() => Price.fromMinorUnits(1000, "XYZ")).toThrow(UnsupportedCurrency);
  });

  it("rejects minor units that are not an integer", () => {
    expect(() => Price.fromMinorUnits(80.5, "EUR")).toThrow(InvalidAmount);
  });

  it("accepts a negative amount: only the Target Price must be positive", () => {
    expect(Price.fromDecimalString("-5.00", "EUR").minorUnits).toBe(-500);
  });

  it.each([
    [8000, "80.00"],
    [5, "0.05"],
    [-500, "-5.00"],
    [0, "0.00"],
  ])("writes %d minor units as %s", (minorUnits, text) => {
    expect(Price.fromMinorUnits(minorUnits, "EUR").toDecimalString()).toBe(text);
  });

  it("prices with the same value are equal, whichever way they are written", () => {
    expect(Price.fromDecimalString("80.0", "EUR").equals(Price.fromDecimalString("80.00", "EUR"))).toBe(true);
  });

  it("prices in different currencies are different", () => {
    expect(Price.fromDecimalString("80.00", "EUR").equals(Price.fromDecimalString("80.00", "USD"))).toBe(false);
  });
});
