import { describe, expect, it } from "vitest";
import {
  InvalidAmount,
  InvalidObservedAt,
  InvalidValue,
  TooManyDecimals,
  UnsupportedCurrency,
} from "../../../src/shared/domain";

/**
 * Each feature reports every InvalidValue as a mistake of its caller and lets any other
 * domain error through as an internal one. This pins that classification for the shared
 * errors, so a new error cannot end up in the wrong group unnoticed.
 */
describe("classification of the shared domain errors", () => {
  it.each([
    ["InvalidAmount", new InvalidAmount("abc")],
    ["TooManyDecimals", new TooManyDecimals("79.999", "EUR", 2)],
    ["InvalidObservedAt", new InvalidObservedAt("yesterday")],
  ])("%s is a mistake of the caller", (_name, error) => {
    expect(error).toBeInstanceOf(InvalidValue);
  });

  it("UnsupportedCurrency is not an InvalidValue", () => {
    expect(new UnsupportedCurrency("XYZ")).not.toBeInstanceOf(InvalidValue);
  });
});
