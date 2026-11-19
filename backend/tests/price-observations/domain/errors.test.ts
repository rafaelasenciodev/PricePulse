import { describe, expect, it } from "vitest";
import {
  InvalidObservedAt,
  NegativePrice,
  ObservationCurrencyMismatch,
  ObservedInTheFuture,
} from "../../../src/price-observations/domain";
import { InvalidValue } from "../../../src/shared/domain";

/**
 * The application reports every domain error of a Price Observation as an invalid
 * observation, but the two groups of the domain model must stay apart: a value that cannot
 * be accepted (InvalidValue) and a rule of the Listing or of time. This pins the groups,
 * so a new error cannot end up in the wrong one unnoticed.
 */
describe("classification of the domain errors of Price Observations", () => {
  it.each([
    ["NegativePrice", new NegativePrice("-5.00")],
    ["InvalidObservedAt", new InvalidObservedAt("yesterday")],
  ])("%s is a value that cannot be accepted", (_name, error) => {
    expect(error).toBeInstanceOf(InvalidValue);
  });

  it.each([
    ["ObservationCurrencyMismatch", new ObservationCurrencyMismatch("USD", "EUR")],
    ["ObservedInTheFuture", new ObservedInTheFuture("2026-11-19T12:00:00.000Z", "2026-11-19T10:30:00.000Z")],
  ])("%s is a broken rule, not an InvalidValue", (_name, error) => {
    expect(error).not.toBeInstanceOf(InvalidValue);
  });
});
