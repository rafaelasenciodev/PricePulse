/**
 * API tests of UC-01 Create Price Alert: POST /listings/:listingId/price-alerts.
 *
 * They check what a client sees: status codes, error codes and bodies. The business
 * rules themselves are tested with the use case; here the focus is the HTTP mapping
 * and SC-14 (a request that is not authenticated).
 */

import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app";
import { InMemoryListingReader, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { CreatePriceAlert, type ListingReader } from "../../../src/price-alerts/application";
import { UserId } from "../../../src/price-alerts/domain";
import { ListingId, Price } from "../../../src/shared/domain";
import { InMemoryAuthenticator } from "../../../src/price-alerts/http";
import { FIXED_CLOCK } from "../../support/created-at";

const USER_1 = UserId("user-1");
const USER_2 = UserId("user-2");
const HEADPHONES = ListingId("headphones-shop-a");
const TOKEN_1 = "token-user-1";
const TOKEN_2 = "token-user-2";

const eur = (amount: string) => Price.fromDecimalString(amount, "EUR");

let app: FastifyInstance;
let alerts: InMemoryPriceAlertRepository;
let listings: InMemoryListingReader;

function startApp(listingReader: ListingReader = listings) {
  const authenticator = new InMemoryAuthenticator();
  authenticator.addUser(TOKEN_1, USER_1);
  authenticator.addUser(TOKEN_2, USER_2);
  app = buildApp({
    createPriceAlert: new CreatePriceAlert(listingReader, alerts, FIXED_CLOCK),
    authenticator,
  });
}

beforeEach(() => {
  alerts = new InMemoryPriceAlertRepository();
  listings = new InMemoryListingReader();
  listings.addListing(HEADPHONES, "EUR", eur("100.00"));
  startApp();
});

afterEach(async () => {
  await app.close();
});

function post(
  options: { listing?: string; token?: string | null; authorization?: string; payload?: unknown } = {},
) {
  const { listing = HEADPHONES, token = TOKEN_1, authorization, payload = { targetAmount: "80.00" } } = options;
  const header = authorization ?? (token === null ? undefined : `Bearer ${token}`);
  return app.inject({
    method: "POST",
    url: `/listings/${listing}/price-alerts`,
    headers: header === undefined ? {} : { authorization: header },
    payload: payload as object,
  });
}

describe("creating a Price Alert", () => {
  it("SC-01: answers 201 with the Price Alert, owned by the authenticated User", async () => {
    const response = await post();
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      listingId: HEADPHONES,
      targetAmount: "80.00",
      currency: "EUR",
      status: "active",
      createdAt: "2026-11-19T10:00:00.000Z",
    });
    expect((await alerts.findActive(USER_1, HEADPHONES))?.id).toBe(response.json().id);
  });

  it("SC-16 / BR-08: repeating the same request answers 200 with the same Price Alert", async () => {
    const first = await post();
    const second = await post();
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(alerts.all()).toHaveLength(1);
  });

  it("SC-07: each User has their own Price Alert for the same Listing", async () => {
    expect((await post({ token: TOKEN_1 })).statusCode).toBe(201);
    expect((await post({ token: TOKEN_2 })).statusCode).toBe(201);
    expect(alerts.all()).toHaveLength(2);
  });
});

describe("authentication (BR-01, SC-14)", () => {
  it.each([
    ["no Authorization header", { token: null }],
    ["an unknown token", { token: "not-a-token" }],
    ["another authentication scheme", { authorization: "Basic dXNlcjpwYXNz" }],
    ["an empty bearer token", { authorization: "Bearer " }],
  ])("SC-14: answers 401 with %s and creates nothing", async (_name, options) => {
    const response = await post(options);
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHENTICATED");
    expect(alerts.all()).toEqual([]);
  });

  it("accepts the Bearer scheme in any letter case", async () => {
    const response = await post({ authorization: `bearer ${TOKEN_1}` });
    expect(response.statusCode).toBe(201);
  });

  it("is checked before the body: an unauthenticated invalid request is 401, not 400", async () => {
    const response = await post({ token: null, payload: { nonsense: true } });
    expect(response.statusCode).toBe(401);
  });

  it("the owner is never taken from the body: an owner field is rejected", async () => {
    const response = await post({ payload: { targetAmount: "80.00", owner: "user-2" } });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("BAD_REQUEST");
    expect(alerts.all()).toEqual([]);
  });
});

describe("malformed requests", () => {
  it.each([
    ["no targetAmount", {}],
    ["a targetAmount that is a number, not text", { targetAmount: 80 }],
    ["a targetAmount that is null", { targetAmount: null }],
    ["an unknown field", { targetAmount: "80.00", note: "hello" }],
  ])("answers 400 with %s", async (_name, payload) => {
    const response = await post({ payload });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("BAD_REQUEST");
    expect(alerts.all()).toEqual([]);
  });

  it("answers 400 when the body is not valid JSON", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/listings/${HEADPHONES}/price-alerts`,
      headers: { authorization: `Bearer ${TOKEN_1}`, "content-type": "application/json" },
      payload: "{ not json",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("BAD_REQUEST");
  });

  it("answers 415 CLIENT_ERROR when the body is in a format the API does not read", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/listings/${HEADPHONES}/price-alerts`,
      headers: { authorization: `Bearer ${TOKEN_1}`, "content-type": "application/xml" },
      payload: "<targetAmount>80.00</targetAmount>",
    });
    expect(response.statusCode).toBe(415);
    expect(response.json().code).toBe("CLIENT_ERROR");
    expect(alerts.all()).toEqual([]);
  });
});

describe("business errors", () => {
  it("SC-13: answers 404 when the Listing does not exist", async () => {
    const response = await post({ listing: "nonexistent" });
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("LISTING_NOT_FOUND");
  });

  it.each([
    ["SC-11", "0.00"],
    ["SC-11", "-5.00"],
    ["SC-12", "79.999"],
    ["BR-04", "abc"],
    ["BR-04", "NaN"],
  ])("%s: answers 422 for the target %j", async (_scenario, targetAmount) => {
    const response = await post({ payload: { targetAmount } });
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe("INVALID_TARGET_PRICE");
    expect(alerts.all()).toEqual([]);
  });

  it("SC-08: answers 409 TARGET_ALREADY_REACHED when the price already reaches the target", async () => {
    const response = await post({ payload: { targetAmount: "100.00" } });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("TARGET_ALREADY_REACHED");
    expect(alerts.all()).toEqual([]);
  });

  it("SC-15: answers 409 DUPLICATE_ALERT for another target on the same Listing", async () => {
    await post({ payload: { targetAmount: "80.00" } });
    const response = await post({ payload: { targetAmount: "70.00" } });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("DUPLICATE_ALERT");
    expect(alerts.all()).toHaveLength(1);
  });

  it("the two 409 errors can be told apart by their code", async () => {
    await post({ payload: { targetAmount: "80.00" } });
    const duplicate = await post({ payload: { targetAmount: "70.00" } });
    const reached = await post({ token: TOKEN_2, payload: { targetAmount: "100.00" } });
    expect([duplicate.json().code, reached.json().code]).toEqual([
      "DUPLICATE_ALERT",
      "TARGET_ALREADY_REACHED",
    ]);
  });

  it("errors have the shape { code, message }", async () => {
    const body = (await post({ listing: "nonexistent" })).json();
    expect(Object.keys(body).sort()).toEqual(["code", "message"]);
  });
});

describe("other responses", () => {
  it("answers 404 NOT_FOUND for an unknown route, with the same error shape", async () => {
    const response = await app.inject({ method: "GET", url: "/nothing-here" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "NOT_FOUND", message: "Route not found" });
  });

  it("answers 500, not a validation error, when the catalogue holds a currency the system does not support", async () => {
    listings.addListing(ListingId("odd-listing"), "XYZ", null);
    const response = await post({ listing: "odd-listing" });
    expect(response.statusCode).toBe(500);
    expect(response.json().code).toBe("INTERNAL_ERROR");
    expect(alerts.all()).toEqual([]);
  });

  it("answers 500 without revealing the cause of an unexpected failure", async () => {
    await app.close();
    const failing: ListingReader = {
      get: async () => {
        throw new Error("connection to db-prod-01 refused, password=hunter2");
      },
    };
    startApp(failing);
    const response = await post();
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ code: "INTERNAL_ERROR", message: "Internal server error" });
    expect(response.body).not.toContain("hunter2");
  });

  // An error that carries a status of its own is a mistake of the client only if the status
  // is a 4xx. Anything else is an unexpected failure and reveals nothing, whatever it says.
  it.each([
    [302, 500, "INTERNAL_ERROR"],
    [399, 500, "INTERNAL_ERROR"],
    [503, 500, "INTERNAL_ERROR"],
    [599, 500, "INTERNAL_ERROR"],
    [400, 400, "BAD_REQUEST"],
    [418, 418, "CLIENT_ERROR"],
    [499, 499, "CLIENT_ERROR"],
  ])("an error with the status %i is answered %i %s", async (carried, expected, code) => {
    await app.close();
    const failing: ListingReader = {
      get: async () => {
        throw Object.assign(new Error("db-prod-01 refused"), { statusCode: carried });
      },
    };
    startApp(failing);
    const response = await post();
    expect(response.statusCode).toBe(expected);
    expect(response.json().code).toBe(code);
    if (expected === 500) expect(response.json().message).toBe("Internal server error");
  });
});
