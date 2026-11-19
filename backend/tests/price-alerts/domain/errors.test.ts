import { describe, expect, it } from "vitest";
import {
  CurrencyMismatch,
  InvalidAmount,
  InvalidValue,
  NonPositiveTargetPrice,
  TargetAlreadyReached,
  TooManyDecimals,
  UnsupportedCurrency,
} from "../../../src/price-alerts/domain";

/**
 * The application reports every InvalidValue as an invalid Target Price (a mistake of the
 * User, 422) and lets any other domain error through as an internal one (500).
 * This pins that classification, so a new error cannot end up in the wrong group unnoticed.
 */
describe("classification of domain errors", () => {
  it.each([
    ["InvalidAmount", new InvalidAmount("abc")],
    ["TooManyDecimals", new TooManyDecimals("79.999", "EUR", 2)],
    ["NonPositiveTargetPrice", new NonPositiveTargetPrice("0.00")],
  ])("%s is a mistake of the User", (_name, error) => {
    expect(error).toBeInstanceOf(InvalidValue);
  });

  it.each([
    ["UnsupportedCurrency", new UnsupportedCurrency("XYZ")],
    ["CurrencyMismatch", new CurrencyMismatch("EUR", "USD")],
    ["TargetAlreadyReached", new TargetAlreadyReached()],
  ])("%s is not an InvalidValue", (_name, error) => {
    expect(error).not.toBeInstanceOf(InvalidValue);
  });
});
