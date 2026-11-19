/**
 * API tests of UC-01 Record Price Observation: POST /listings/:listingId/price-observations.
 *
 * They check what a client sees: status codes, error codes and bodies. The business rules
 * themselves are tested with the domain and the use case; here the focus is the HTTP mapping
 * and SC-16 and SC-17, which are rejected before the use case (contract, decision 1).
 *
 * The clock is fixed at 2026-11-19T12:00:00Z so that the rule of the future is predictable.
 */

import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app";
import { InMemoryListingReader, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { CreatePriceAlert } from "../../../src/price-alerts/application";
import { UserId } from "../../../src/price-alerts/domain";
import { InMemoryAuthenticator } from "../../../src/price-alerts/http";
import { InMemoryListingCatalogue, InMemoryPriceObservationRepository } from "../../../src/price-observations/adapters";
import {
  CLOCK_TOLERANCE_MILLISECONDS,
  RecordPriceObservation,
  type Clock,
  type ListingCatalogue,
} from "../../../src/price-observations/application";
import { ProviderId } from "../../../src/price-observations/domain";
import { InMemoryProviderAuthenticator } from "../../../src/price-observations/http";
import { ListingId } from "../../../src/shared/domain";

const HEADPHONES = ListingId("headphones-shop-a");
const PROVIDER_TOKEN = "token-simulator";
const USER_TOKEN = "token-user-1";
const NOW = new Date("2026-11-19T12:00:00Z");

let app: FastifyInstance;
let observations: InMemoryPriceObservationRepository;
let catalogue: InMemoryListingCatalogue;

function startApp(listingCatalogue: ListingCatalogue = catalogue, withObservations = true) {
  const users = new InMemoryAuthenticator();
  users.addUser(USER_TOKEN, UserId("user-1"));
  const providers = new InMemoryProviderAuthenticator();
  providers.addProvider(PROVIDER_TOKEN, ProviderId("simulator"));
  const clock: Clock = { now: () => NOW };
  app = buildApp({
    createPriceAlert: new CreatePriceAlert(new InMemoryListingReader(), new InMemoryPriceAlertRepository()),
    authenticator: users,
    priceObservations: withObservations
      ? {
          recordPriceObservation: new RecordPriceObservation(listingCatalogue, observations, clock),
          authenticator: providers,
        }
      : undefined,
  });
}

beforeEach(() => {
  observations = new InMemoryPriceObservationRepository();
  catalogue = new InMemoryListingCatalogue();
  catalogue.addListing(HEADPHONES, "EUR");
  startApp();
});

afterEach(async () => {
  await app.close();
});

const VALID = { observedAt: "2026-11-19T10:00:00Z", price: { amount: "79.90", currency: "EUR" } };

function post(
  options: { listing?: string; token?: string | null; authorization?: string; payload?: unknown } = {},
) {
  const { listing = HEADPHONES, token = PROVIDER_TOKEN, authorization, payload = VALID } = options;
  const header = authorization ?? (token === null ? undefined : `Bearer ${token}`);
  return app.inject({
    method: "POST",
    url: `/listings/${listing}/price-observations`,
    headers: header === undefined ? {} : { authorization: header },
    payload: payload as object,
  });
}

describe("recording a Price Observation", () => {
  it("SC-01: answers 201 with the observation, attributed to the Provider of the token", async () => {
    const response = await post();
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      provider: "simulator",
      listingId: HEADPHONES,
      observedAt: "2026-11-19T10:00:00.000Z",
      price: { amount: "79.90", currency: "EUR" },
    });
    expect(observations.all()).toHaveLength(1);
    expect(observations.all()[0]?.provider).toBe("simulator");
  });

  it("SC-02: price null records that the Listing was unavailable", async () => {
    const response = await post({ payload: { observedAt: "2026-11-19T10:00:00Z", price: null } });
    expect(response.statusCode).toBe(201);
    expect(response.json().price).toBeNull();
    expect(observations.all()[0]?.price).toBeNull();
  });

  it("SC-03: a Price of zero is accepted", async () => {
    const response = await post({ payload: { observedAt: "2026-11-19T10:00:00Z", price: { amount: "0.00", currency: "EUR" } } });
    expect(response.statusCode).toBe(201);
    expect(response.json().price).toEqual({ amount: "0.00", currency: "EUR" });
  });

  it("SC-18 / BR-09: repeating the same observation answers 200 with the stored one", async () => {
    const first = await post();
    const second = await post();
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(observations.all()).toHaveLength(1);
  });

  it("SC-18: repeating an observation without a Price also answers 200", async () => {
    const payload = { observedAt: "2026-11-19T10:00:00Z", price: null };
    expect((await post({ payload })).statusCode).toBe(201);
    expect((await post({ payload })).statusCode).toBe(200);
    expect(observations.all()).toHaveLength(1);
  });

  it("SC-04 / SC-09 / BR-06: later, older and equal observations are all stored", async () => {
    const at = (observedAt: string, amount: string) => ({ observedAt, price: { amount, currency: "EUR" } });
    expect((await post({ payload: at("2026-11-19T10:00:00Z", "100.00") })).statusCode).toBe(201);
    expect((await post({ payload: at("2026-11-19T11:00:00Z", "100.00") })).statusCode).toBe(201);
    expect((await post({ payload: at("2026-11-19T09:00:00Z", "120.00") })).statusCode).toBe(201);
    expect(observations.all()).toHaveLength(3);
  });

  it("an Observed At written in another time zone is answered in UTC", async () => {
    const response = await post({ payload: { observedAt: "2026-11-19T11:00:00+01:00", price: null } });
    expect(response.json().observedAt).toBe("2026-11-19T10:00:00.000Z");
  });
});

describe("authentication (BR-01, SC-16, SC-17)", () => {
  it.each([
    ["no Authorization header", { token: null }],
    ["an unknown token", { token: "not-a-token" }],
    ["another authentication scheme", { authorization: "Basic dXNlcjpwYXNz" }],
    ["an empty bearer token", { authorization: "Bearer " }],
  ])("SC-16: answers 401 with %s and records nothing", async (_name, options) => {
    const response = await post(options);
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHENTICATED");
    expect(observations.all()).toEqual([]);
  });

  it("SC-17: the token of a User is not the credential of a Provider: 401, and nothing is recorded", async () => {
    const response = await post({ token: USER_TOKEN });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHENTICATED");
    expect(observations.all()).toEqual([]);
  });

  it("the token of a Provider does not open the routes of Users", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/listings/${HEADPHONES}/price-alerts`,
      headers: { authorization: `Bearer ${PROVIDER_TOKEN}` },
      payload: { targetAmount: "80.00" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("accepts the Bearer scheme in any letter case", async () => {
    expect((await post({ authorization: `bearer ${PROVIDER_TOKEN}` })).statusCode).toBe(201);
  });

  it("is checked before the body: an unauthenticated invalid request is 401, not 400", async () => {
    expect((await post({ token: null, payload: { nonsense: true } })).statusCode).toBe(401);
  });

  it("BR-01: the Provider is never taken from the body: a provider field is rejected", async () => {
    const response = await post({ payload: { ...VALID, provider: "another-provider" } });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("BAD_REQUEST");
    expect(observations.all()).toEqual([]);
  });

  it("BR-01: the Provider is the one of the credential, whichever token is used", async () => {
    // Two Providers cannot exist in the real system (BR-13). Here a second token only
    // shows that the identity comes from the credential and from nothing else.
    const providers = new InMemoryProviderAuthenticator();
    providers.addProvider("token-a", ProviderId("provider-a"));
    providers.addProvider("token-b", ProviderId("provider-b"));
    await app.close();
    app = buildApp({
      createPriceAlert: new CreatePriceAlert(new InMemoryListingReader(), new InMemoryPriceAlertRepository()),
      authenticator: new InMemoryAuthenticator(),
      priceObservations: {
        recordPriceObservation: new RecordPriceObservation(catalogue, observations, { now: () => NOW }),
        authenticator: providers,
      },
    });
    expect((await post({ token: "token-a" })).json().provider).toBe("provider-a");
    expect((await post({ token: "token-b" })).json().provider).toBe("provider-b");
  });
});

describe("malformed requests", () => {
  it.each([
    ["no observedAt", { price: null }],
    ["no price: absence is not the same as null", { observedAt: "2026-11-19T10:00:00Z" }],
    ["an empty body", {}],
    ["an observedAt that is a number", { observedAt: 1763546400000, price: null }],
    ["an observedAt that is null", { observedAt: null, price: null }],
    ["a price that is a text", { observedAt: "2026-11-19T10:00:00Z", price: "79.90" }],
    ["a price that is a number", { observedAt: "2026-11-19T10:00:00Z", price: 79.9 }],
    ["a price without currency", { observedAt: "2026-11-19T10:00:00Z", price: { amount: "79.90" } }],
    ["a price without amount", { observedAt: "2026-11-19T10:00:00Z", price: { currency: "EUR" } }],
    ["an amount that is a number, not text", { observedAt: "2026-11-19T10:00:00Z", price: { amount: 79.9, currency: "EUR" } }],
    ["an unknown field in the price", { observedAt: "2026-11-19T10:00:00Z", price: { amount: "79.90", currency: "EUR", tax: "21" } }],
    ["an unknown field", { ...VALID, note: "hello" }],
  ])("answers 400 with %s", async (_name, payload) => {
    const response = await post({ payload });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("BAD_REQUEST");
    expect(observations.all()).toEqual([]);
  });

  it("answers 400 when the body is not valid JSON", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/listings/${HEADPHONES}/price-observations`,
      headers: { authorization: `Bearer ${PROVIDER_TOKEN}`, "content-type": "application/json" },
      payload: "{ not json",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("BAD_REQUEST");
  });

  it("answers 415 CLIENT_ERROR when the body is in a format the API does not read", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/listings/${HEADPHONES}/price-observations`,
      headers: { authorization: `Bearer ${PROVIDER_TOKEN}`, "content-type": "application/xml" },
      payload: "<price>79.90</price>",
    });
    expect(response.statusCode).toBe(415);
    expect(response.json().code).toBe("CLIENT_ERROR");
    expect(observations.all()).toEqual([]);
  });
});

describe("business errors", () => {
  const invalid = (changes: object) => ({ ...VALID, ...changes });
  const price = (amount: string, currency = "EUR") => ({ price: { amount, currency } });

  it("SC-15 / BR-02: answers 404 LISTING_NOT_FOUND for a Listing that does not exist", async () => {
    const response = await post({ listing: "nonexistent" });
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("LISTING_NOT_FOUND");
    expect(observations.all()).toEqual([]);
  });

  it.each([
    ["SC-12: a negative Price", invalid(price("-5.00")), "negative"],
    ["SC-13: more decimals than the currency allows", invalid(price("79.999")), "decimal"],
    ["BR-04: an amount that is not a number", invalid(price("abc")), "not a valid number"],
    ["SC-14: a currency that is not the one of the Listing", invalid(price("79.90", "USD")), "not the one of the Listing"],
    ["a currency the system does not support", invalid(price("79.90", "GBP")), "not the one of the Listing"],
    ["an Observed At without a time zone", invalid({ observedAt: "2026-11-19T10:00:00" }), "Observed At"],
    ["an Observed At that is not a moment", invalid({ observedAt: "yesterday" }), "Observed At"],
    ["an Observed At that does not exist", invalid({ observedAt: "2026-02-30T10:00:00Z" }), "Observed At"],
  ])("%s: answers 422 INVALID_OBSERVATION and records nothing", async (_name, payload, fragment) => {
    const response = await post({ payload });
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe("INVALID_OBSERVATION");
    expect(response.json().message).toContain(fragment);
    expect(observations.all()).toEqual([]);
  });

  it("SC-11 / BR-12: an Observed At beyond the tolerance is a 422, and one within it is recorded", async () => {
    const at = (milliseconds: number) => new Date(NOW.getTime() + milliseconds).toISOString();
    const beyond = await post({ payload: invalid({ observedAt: at(CLOCK_TOLERANCE_MILLISECONDS + 1) }) });
    expect(beyond.statusCode).toBe(422);
    expect(beyond.json().message).toContain("later than the moment of recording");
    expect((await post({ payload: invalid({ observedAt: at(CLOCK_TOLERANCE_MILLISECONDS) }) })).statusCode).toBe(201);
  });

  it.each([
    ["SC-19: another Price", { ...VALID, ...price("85.00") }],
    ["SC-20: no Price against a stored Price", { ...VALID, price: null }],
  ])("%s for the same Observed At: answers 409 OBSERVATION_CONFLICT and keeps the stored one", async (_name, payload) => {
    await post();
    const response = await post({ payload });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("OBSERVATION_CONFLICT");
    expect(observations.all()).toHaveLength(1);
    expect(observations.all()[0]?.price?.toDecimalString()).toBe("79.90");
  });

  it("answers 409 when a Price is reported against a stored absence of Price", async () => {
    await post({ payload: { observedAt: VALID.observedAt, price: null } });
    expect((await post()).statusCode).toBe(409);
  });

  it("errors have the shape { code, message }", async () => {
    const body = (await post({ listing: "nonexistent" })).json();
    expect(Object.keys(body).sort()).toEqual(["code", "message"]);
  });

  it("the 409 and the 422 are told apart by their code", async () => {
    await post();
    const conflict = await post({ payload: { ...VALID, ...price("85.00") } });
    const notValid = await post({ payload: invalid(price("-5.00")) });
    expect([conflict.json().code, notValid.json().code]).toEqual(["OBSERVATION_CONFLICT", "INVALID_OBSERVATION"]);
  });
});

describe("other responses", () => {
  it("answers 500, not a validation error, when the catalogue holds a currency the system does not support", async () => {
    catalogue.addListing(ListingId("odd-listing"), "XYZ");
    const response = await post({ listing: "odd-listing", payload: { observedAt: VALID.observedAt, price: { amount: "10", currency: "XYZ" } } });
    expect(response.statusCode).toBe(500);
    expect(response.json().code).toBe("INTERNAL_ERROR");
    expect(observations.all()).toEqual([]);
  });

  it("answers 500 without revealing the cause of an unexpected failure", async () => {
    await app.close();
    startApp({
      find: async () => {
        throw new Error("connection to db-prod-01 refused, password=hunter2");
      },
    });
    const response = await post();
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ code: "INTERNAL_ERROR", message: "Internal server error" });
    expect(response.body).not.toContain("hunter2");
  });

  it("without the routes of Price Observations the application does not serve them: 404", async () => {
    await app.close();
    startApp(catalogue, false);
    const response = await post();
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NOT_FOUND");
  });

  it("the errors of this feature do not become the errors of the other: a missing Listing is 404 in both", async () => {
    const alert = await app.inject({
      method: "POST",
      url: "/listings/nonexistent/price-alerts",
      headers: { authorization: `Bearer ${USER_TOKEN}` },
      payload: { targetAmount: "80.00" },
    });
    expect(alert.statusCode).toBe(404);
    expect(alert.json().code).toBe("LISTING_NOT_FOUND");
    expect((await post({ listing: "nonexistent" })).json().code).toBe("LISTING_NOT_FOUND");
  });
});
