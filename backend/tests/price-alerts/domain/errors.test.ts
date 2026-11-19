import { describe, expect, it } from "vitest";
import { InvalidValue } from "../../../src/shared/domain";
import {
  CurrencyMismatch,
  NonPositiveTargetPrice,
  TargetAlreadyReached,
} from "../../../src/price-alerts/domain";

/**
 * The application reports every InvalidValue as an invalid Target Price (a mistake of the
 * User, 422) and lets any other domain error through as an internal one (500).
 * This pins that classification for the errors of Price Alerts, so a new error cannot end
 * up in the wrong group unnoticed. The shared errors are pinned in the tests of `shared`.
 */
describe("classification of the domain errors of Price Alerts", () => {
  it("NonPositiveTargetPrice is a mistake of the User", () => {
    expect(new NonPositiveTargetPrice("0.00")).toBeInstanceOf(InvalidValue);
  });

  it.each([
    ["CurrencyMismatch", new CurrencyMismatch("EUR", "USD")],
    ["TargetAlreadyReached", new TargetAlreadyReached()],
  ])("%s is not an InvalidValue", (_name, error) => {
    expect(error).not.toBeInstanceOf(InvalidValue);
  });
});
