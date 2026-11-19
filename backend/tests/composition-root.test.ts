/**
 * The Composition Root connects the real parts. These tests check the wiring, not the
 * rules: that a request travels through the HTTP layer, the use cases and the adapters of
 * both features, and that the two features meet where they should.
 *
 * The clock is fixed at 2026-11-19T12:00:00Z so that the observations can be dated.
 */

import { afterEach, describe, expect, it } from "vitest";
import { composeInMemoryApp } from "../src/composition-root";
import { ProviderId } from "../src/price-observations/domain";
import { ListingId } from "../src/shared/domain";
import { FAST_HASHER, signedInUser } from "./support/accounts";

const HEADPHONES = ListingId("headphones-shop-a");
let USER_TOKEN = ""; // the token of a User who signed in, set by compose()
const PROVIDER_TOKEN = "provider-token";
const NOW = new Date("2026-11-19T12:00:00Z");

let application: ReturnType<typeof composeInMemoryApp>;

afterEach(async () => {
  await application.app.close();
});

async function compose(options: Parameters<typeof composeInMemoryApp>[0] = {}) {
  application = composeInMemoryApp({ clock: { now: () => NOW }, passwordHasher: FAST_HASHER, ...options });
  USER_TOKEN = (await signedInUser(application, "user1@example.com")).token;
  application.providerAuthenticator.addProvider(PROVIDER_TOKEN, ProviderId("simulator"));
  application.catalogue.addListing(HEADPHONES, "EUR");
  return application;
}

/** A Provider reports the price of the headphones at an hour of 2026-11-19, or that it had none. */
const observe = (hour: string, amount: string | null, token = PROVIDER_TOKEN, listing: string = HEADPHONES) =>
  application.app.inject({
    method: "POST",
    url: `/listings/${listing}/price-observations`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      observedAt: `2026-11-19T${hour}:00:00Z`,
      price: amount === null ? null : { amount, currency: "EUR" },
    },
  });

/** A User asks to be notified when the headphones reach a target price. */
const create = (targetAmount: string, token = USER_TOKEN, listing: string = HEADPHONES) =>
  application.app.inject({
    method: "POST",
    url: `/listings/${listing}/price-alerts`,
    headers: { authorization: `Bearer ${token}` },
    payload: { targetAmount },
  });

describe("composeInMemoryApp: Price Alerts", () => {
  it("connects the HTTP layer, the use case and the adapters", async () => {
    await compose();
    await observe("10", "100.00");
    const response = await create("80.00");
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ listingId: HEADPHONES, targetAmount: "80.00", status: "active" });
  });

  it("BR-09 of feature 04: the creation moment of a Price Alert comes from the clock of the composition", async () => {
    await compose();
    await observe("10", "100.00");
    const response = await create("80.00");
    expect(response.statusCode).toBe(201);
    expect(response.json().createdAt).toBe("2026-11-19T12:00:00.000Z");
  });

  it("shares one repository between requests: a repeated request returns the same Price Alert", async () => {
    await compose();
    await observe("10", "100.00");
    const first = await create("80.00");
    const second = await create("80.00");
    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id);
  });

  it("uses the catalogue it was given: an unknown Listing is a 404", async () => {
    await compose();
    expect((await create("80.00", USER_TOKEN, "unknown")).statusCode).toBe(404);
  });

  it("uses the authenticator it was given: an unknown token is a 401", async () => {
    await compose();
    expect((await create("80.00", "other-token")).statusCode).toBe(401);
  });

  it("each composition has its own state", async () => {
    await compose();
    await observe("10", "100.00");
    await create("80.00");
    await application.app.close();
    await compose();
    await observe("10", "100.00");
    expect((await create("80.00")).statusCode).toBe(201);
  });
});

describe("composeInMemoryApp: Price Observations", () => {
  it("connects the HTTP layer, the use case and the adapters", async () => {
    await compose();
    const response = await observe("10", "79.90");
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      provider: "simulator",
      listingId: HEADPHONES,
      observedAt: "2026-11-19T10:00:00.000Z",
      price: { amount: "79.90", currency: "EUR" },
    });
  });

  it("shares one repository between requests: a repeated observation answers 200", async () => {
    await compose();
    expect((await observe("10", "79.90")).statusCode).toBe(201);
    expect((await observe("10", "79.90")).statusCode).toBe(200);
    expect((await observe("10", "85.00")).statusCode).toBe(409);
  });

  it("uses the catalogue it was given: an unknown Listing is a 404", async () => {
    await compose();
    expect((await observe("10", "79.90", PROVIDER_TOKEN, "unknown")).statusCode).toBe(404);
  });

  it("uses the clock it was given: an Observed At beyond the tolerance is a 422", async () => {
    await compose();
    expect((await observe("12", "79.90")).statusCode).toBe(201); // the moment of recording
    expect((await observe("13", "79.90")).statusCode).toBe(422);
  });

  it("uses the Provider authenticator it was given: an unknown token is a 401", async () => {
    await compose();
    expect((await observe("10", "79.90", "other-token")).statusCode).toBe(401);
  });

  it("uses the system clock when none is given: an observation of the past is recorded", async () => {
    application = composeInMemoryApp();
    application.providerAuthenticator.addProvider(PROVIDER_TOKEN, ProviderId("simulator"));
    application.catalogue.addListing(HEADPHONES, "EUR");
    const response = await application.app.inject({
      method: "POST",
      url: `/listings/${HEADPHONES}/price-observations`,
      headers: { authorization: `Bearer ${PROVIDER_TOKEN}` },
      payload: { observedAt: "2020-01-01T00:00:00Z", price: { amount: "79.90", currency: "EUR" } },
    });
    expect(response.statusCode).toBe(201);
  });
});

describe("composeInMemoryApp: the two features meet", () => {
  it("a Listing with no observation has no Current Price, so any valid target is accepted (BR-06, SC-08)", async () => {
    await compose();
    expect((await create("80.00")).statusCode).toBe(201);
  });

  it("SC-04: the Current Price is the latest observation: a Price Alert sees what a Provider reported", async () => {
    await compose();
    await observe("10", "100.00");
    await observe("11", "75.00");
    const response = await create("80.00");
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("TARGET_ALREADY_REACHED");
  });

  it("SC-09: an older observation, recorded later, does not change the Current Price", async () => {
    await compose();
    await observe("11", "90.00");
    await observe("10", "100.00"); // older: stored, but the Current Price stays 90.00
    expect((await create("95.00")).statusCode).toBe(409); // 90.00 reaches 95.00
  });

  it("SC-06: a latest observation without a Price leaves the Listing with no Current Price", async () => {
    await compose();
    await observe("10", "75.00");
    await observe("11", null);
    expect((await create("80.00")).statusCode).toBe(201);
  });

  it("SC-07: a Price after an unavailable observation is the Current Price again", async () => {
    await compose();
    await observe("10", "75.00");
    await observe("11", null);
    await observe("12", "75.00");
    expect((await create("80.00")).statusCode).toBe(409);
  });

  it("SC-03: a Price of zero is a Current Price, not the absence of one", async () => {
    await compose();
    await observe("10", "0.00");
    expect((await create("80.00")).statusCode).toBe(409);
  });

  it("SC-21 / BR-11: the use case that records a Price does not touch the Price Alert", async () => {
    await compose();
    await observe("10", "100.00");
    const created = await create("80.00");
    // The use case itself, not the HTTP route: the route also starts the Evaluation of feature 03,
    // which is wired by the Composition Root and is not part of recording.
    await application.recordPriceObservation.execute({
      provider: ProviderId("simulator"),
      listingId: HEADPHONES,
      observedAt: "2026-11-19T11:00:00Z",
      price: { amount: "75.00", currency: "EUR" },
    });
    // The same request still returns the same Price Alert, still Active, even though the
    // Current Price now reaches its target (BR-08 comes before BR-05).
    const repeated = await create("80.00");
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json()).toEqual(created.json());
    expect(repeated.json().status).toBe("active");
  });

  it("the credentials are not interchangeable: each token opens only its own routes", async () => {
    await compose();
    expect((await observe("10", "79.90", USER_TOKEN)).statusCode).toBe(401);
    expect((await create("80.00", PROVIDER_TOKEN)).statusCode).toBe(401);
  });

  it("serves the documentation of the three features when it is asked for", async () => {
    await compose({ apiDocs: { note: "note" } });
    const { paths } = (await application.app.inject({ method: "GET", url: "/docs/json" })).json();
    expect(Object.keys(paths).sort()).toEqual([
      "/accounts",
      "/accounts/me",
      "/listings",
      "/listings/{listingId}",
      "/listings/{listingId}/price-alerts",
      "/listings/{listingId}/price-observations",
      "/notifications",
      "/price-alerts",
      "/price-alerts/{alertId}",
      "/sessions",
      "/sessions/current",
    ]);
  });

  it("a Provider can give a Listing its first price through the use case, as the demo does", async () => {
    await compose();
    await application.recordPriceObservation.execute({
      provider: ProviderId("simulator"),
      listingId: HEADPHONES,
      observedAt: "2026-11-19T10:00:00Z",
      price: { amount: "75.00", currency: "EUR" },
    });
    expect((await create("80.00")).statusCode).toBe(409);
  });
});
