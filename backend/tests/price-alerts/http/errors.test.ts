/**
 * The translation of the errors of this feature to HTTP.
 *
 * Each feature translates only its own errors and answers null for any other: a malformed
 * request or an unexpected failure is handled once, by the application that connects the
 * features (tests of the API check those answers).
 */

import { describe, expect, it } from "vitest";
import {
  DuplicateAlert,
  InvalidTargetPrice,
  ListingNotFound,
  TargetAlreadyReached,
} from "../../../src/price-alerts/application";
import { Unauthenticated, priceAlertHttpError } from "../../../src/price-alerts/http";
import { ListingId } from "../../../src/shared/domain";

describe("priceAlertHttpError", () => {
  it.each([
    ["Unauthenticated", new Unauthenticated(), 401, "UNAUTHENTICATED"],
    ["ListingNotFound", new ListingNotFound(ListingId("headphones-shop-a")), 404, "LISTING_NOT_FOUND"],
    ["InvalidTargetPrice", new InvalidTargetPrice("not a number"), 422, "INVALID_TARGET_PRICE"],
    ["DuplicateAlert", new DuplicateAlert(), 409, "DUPLICATE_ALERT"],
    ["TargetAlreadyReached", new TargetAlreadyReached("reached"), 409, "TARGET_ALREADY_REACHED"],
  ])("translates %s", (_name, error, status, code) => {
    expect(priceAlertHttpError(error)).toEqual({ status, code, message: error.message });
  });

  it.each([
    ["an unexpected error", new Error("the store is unavailable")],
    ["a client error of the framework", Object.assign(new Error("bad body"), { statusCode: 400 })],
    ["an error that only has the name of one of its own", Object.assign(new Error("x"), { name: "ListingNotFound" })],
    ["a text", "something went wrong"],
    ["undefined", undefined],
  ])("is not the error of this feature: %s", (_case, error) => {
    expect(priceAlertHttpError(error)).toBeNull();
  });
});
