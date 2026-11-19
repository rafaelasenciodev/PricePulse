/**
 * The translation of the errors of this feature to HTTP.
 *
 * Each feature translates only its own errors and answers null for any other. The errors of
 * two features can have the same name (ListingNotFound): they are told apart by their class.
 */

import { describe, expect, it } from "vitest";
import { ListingNotFound as ListingNotFoundOfAlerts } from "../../../src/price-alerts/application";
import { priceAlertHttpError } from "../../../src/price-alerts/http";
import { InvalidObservation, ListingNotFound, ObservationConflict } from "../../../src/price-observations/application";
import { Unauthenticated, priceObservationHttpError } from "../../../src/price-observations/http";
import { ListingId } from "../../../src/shared/domain";

const LISTING = ListingId("headphones-shop-a");

describe("priceObservationHttpError", () => {
  it.each([
    ["Unauthenticated", new Unauthenticated(), 401, "UNAUTHENTICATED"],
    ["ListingNotFound", new ListingNotFound(LISTING), 404, "LISTING_NOT_FOUND"],
    ["InvalidObservation", new InvalidObservation("negative"), 422, "INVALID_OBSERVATION"],
    ["ObservationConflict", new ObservationConflict(), 409, "OBSERVATION_CONFLICT"],
  ])("translates %s", (_name, error, status, code) => {
    expect(priceObservationHttpError(error)).toEqual({ status, code, message: error.message });
  });

  it.each([
    ["an unexpected error", new Error("the store is unavailable")],
    ["a client error of the framework", Object.assign(new Error("bad body"), { statusCode: 400 })],
    ["an error that only has the name of one of its own", Object.assign(new Error("x"), { name: "ObservationConflict" })],
    ["a text", "something went wrong"],
    ["undefined", undefined],
  ])("is not the error of this feature: %s", (_case, error) => {
    expect(priceObservationHttpError(error)).toBeNull();
  });

  it("does not translate the ListingNotFound of Price Alerts, and the other way round", () => {
    const ofAlerts = new ListingNotFoundOfAlerts(LISTING);
    const ofObservations = new ListingNotFound(LISTING);
    expect(priceObservationHttpError(ofAlerts)).toBeNull();
    expect(priceAlertHttpError(ofObservations)).toBeNull();
    expect(priceAlertHttpError(ofAlerts)).not.toBeNull();
    expect(priceObservationHttpError(ofObservations)).not.toBeNull();
  });
});
