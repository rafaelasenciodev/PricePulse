/**
 * Reading the Price History over HTTP: the route, its answers and its validation. The rules are
 * tested in the use case. Here: that the answer is the one it should be, that a request that is
 * not authenticated learns nothing, and that what is not valid is rejected.
 */

import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app";
import { InMemoryListingReader, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { CreatePriceAlert } from "../../../src/price-alerts/application";
import { UserId } from "../../../src/price-alerts/domain";
import { InMemoryAuthenticator } from "../../../src/price-alerts/http";
import { InMemoryListingCatalogue, InMemoryPriceObservationRepository } from "../../../src/price-observations/adapters";
import { ReadPriceHistory } from "../../../src/price-observations/application";
import { ListingId } from "../../../src/shared/domain";
import { FIXED_CLOCK } from "../../support/created-at";
import { anObservation, type ObservationSpec } from "../../support/observations";

const USER_TOKEN = "user-token";
const HEADPHONES = "headphones-shop-a";

let app: FastifyInstance;
let catalogue: InMemoryListingCatalogue;
let observations: InMemoryPriceObservationRepository;

beforeEach(() => {
  catalogue = new InMemoryListingCatalogue();
  observations = new InMemoryPriceObservationRepository();
  catalogue.addListing(ListingId(HEADPHONES), "EUR");
  const users = new InMemoryAuthenticator();
  users.addUser(USER_TOKEN, UserId("user-1"));
  app = buildApp({
    createPriceAlert: new CreatePriceAlert(new InMemoryListingReader(), new InMemoryPriceAlertRepository(), FIXED_CLOCK),
    authenticator: users,
    priceHistory: {
      readPriceHistory: new ReadPriceHistory(catalogue, observations),
      authenticator: { isUser: async (token) => (await users.authenticate(token)) !== null },
    },
  });
});

afterEach(async () => {
  await app.close();
});

const read = (query = "", listing = HEADPHONES, token: string | null = USER_TOKEN) =>
  app.inject({
    method: "GET",
    url: `/listings/${listing}/price-observations${query}`,
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
  });

const add = async (...specs: ObservationSpec[]) => {
  for (const spec of specs) await observations.add(anObservation(spec));
};

const hours = (response: { json(): { items: { observedAt: string }[] } }) => response.json().items.map((o) => o.observedAt.slice(11, 16));

describe("authentication (BR-04, SC-07, SC-08)", () => {
  it("SC-07: without a token it answers 401 UNAUTHENTICATED", async () => {
    const response = await read("", HEADPHONES, null);
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHENTICATED");
  });

  it("SC-08: a token that is not the one of a User answers 401, as the one of a Provider does", async () => {
    expect((await read("", HEADPHONES, "a-provider-token")).statusCode).toBe(401);
  });

  it("a request that is not authenticated learns nothing about what a valid one looks like, or whether the Listing exists", async () => {
    expect((await read("?limit=abc&foo=1&from=yesterday", "no-such-listing", null)).statusCode).toBe(401);
  });
});

describe("reading the Price History", () => {
  it("SC-10 / BR-05: answers 200 with a page, newest Observed At first, with what each observation shows", async () => {
    await add(
      { provider: "simulator", observedAt: "2026-11-19T10:00:00Z", price: "100.00" },
      { provider: "simulator", observedAt: "2026-11-19T12:00:00Z", price: "95.00" },
    );

    const response = await read();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 2, limit: 20, offset: 0 });
    expect(hours(response)).toEqual(["12:00", "10:00"]);
    expect(response.json().items[0]).toEqual({
      provider: "simulator",
      listingId: HEADPHONES,
      observedAt: "2026-11-19T12:00:00.000Z",
      price: { amount: "95.00", currency: "EUR" },
    });
  });

  it("SC-11 / BR-05: a moment when the Listing was unavailable has a price of null", async () => {
    await add({ observedAt: "2026-11-19T10:00:00Z", price: "100.00" }, { observedAt: "2026-11-19T11:00:00Z", price: null });
    const { items } = (await read()).json();
    expect(items[0]).toMatchObject({ observedAt: "2026-11-19T11:00:00.000Z", price: null });
    expect(items[1].price).toEqual({ amount: "100.00", currency: "EUR" });
  });

  it("SC-12 / BR-05: an observation that arrived late is in its place by Observed At", async () => {
    await add({ observedAt: "2026-11-19T11:00:00Z" }, { observedAt: "2026-11-19T10:00:00Z" });
    expect(hours(await read())).toEqual(["11:00", "10:00"]);
  });

  it("SC-13 / BR-05: only the observations of the Listing asked for", async () => {
    catalogue.addListing(ListingId("keyboard-shop-b"), "EUR");
    await add({ listing: HEADPHONES }, { listing: "keyboard-shop-b", observedAt: "2026-11-19T11:00:00Z" });
    expect((await read("", HEADPHONES)).json().total).toBe(1);
  });

  it("SC-14 / BR-05: a Listing without observations answers 200 and an empty history", async () => {
    const response = await read();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it("SC-15 / BR-07: a Listing that does not exist answers 404 LISTING_NOT_FOUND", async () => {
    const response = await read("", "no-such-listing");
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("LISTING_NOT_FOUND");
  });
});

describe("a range of the history", () => {
  beforeEach(async () => {
    await add({ observedAt: "2026-11-19T10:00:00Z" }, { observedAt: "2026-11-19T11:00:00Z" }, { observedAt: "2026-11-19T12:00:00Z" });
  });

  it("SC-16 / BR-06: includes its start and leaves out its end", async () => {
    expect(hours(await read("?from=2026-11-19T10:00:00Z&to=2026-11-19T12:00:00Z"))).toEqual(["11:00", "10:00"]);
  });

  it.each([
    ["?from=2026-11-19T11:00:00Z", ["12:00", "11:00"]],
    ["?to=2026-11-19T11:00:00Z", ["10:00"]],
  ])("SC-17 / BR-06: %s", async (query, expected) => {
    expect(hours(await read(query))).toEqual(expected);
  });

  it("reads an end with a time zone, whose plus sign is written %2B in a URL", async () => {
    expect(hours(await read("?from=2026-11-19T11:00:00%2B01:00&to=2026-11-19T13:00:00%2B01:00"))).toEqual(["11:00", "10:00"]);
  });

  it.each([
    ["a start that is not an instant", "?from=yesterday", "start of the range is not an instant"],
    ["an end that is not an instant", "?to=tomorrow", "end of the range is not an instant"],
    ["a start after the end", "?from=2026-11-19T12:00:00Z&to=2026-11-19T10:00:00Z", "is not before its end"],
    ["a start equal to the end", "?from=2026-11-19T10:00:00Z&to=2026-11-19T10:00:00Z", "is not before its end"],
  ])("SC-18 / BR-06: %s answers 422 INVALID_RANGE", async (_name, query, fragment) => {
    const response = await read(query);
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe("INVALID_RANGE");
    expect(response.json().message).toContain(fragment);
  });

  it("a Listing that does not exist is not found whatever the range is", async () => {
    expect((await read("?from=yesterday", "no-such-listing")).statusCode).toBe(404);
  });
});

describe("the pages of the history", () => {
  beforeEach(async () => {
    for (const hour of ["08", "09", "10", "11", "12"]) await add({ observedAt: `2026-11-19T${hour}:00:00Z` });
  });

  it("SC-19 / BR-05 / BR-08: the total counts the range, not the page", async () => {
    const response = await read("?from=2026-11-19T09:00:00Z&limit=2");
    expect(hours(response)).toEqual(["12:00", "11:00"]);
    expect(response.json()).toMatchObject({ total: 4, limit: 2, offset: 0 });
  });

  it("the next page follows limit and offset, written as numbers in the URL", async () => {
    expect(hours(await read("?limit=2&offset=2"))).toEqual(["10:00", "09:00"]);
  });

  it("accepts the largest limit", async () => {
    expect((await read("?limit=100")).statusCode).toBe(200);
  });

  it.each([["limit=0"], ["limit=101"], ["limit=-1"], ["limit=abc"], ["limit=1.5"], ["limit="], ["offset=-1"], ["offset=abc"], ["foo=1"]])(
    "SC-20 / BR-08: answers 400 BAD_REQUEST to ?%s",
    async (query) => {
      const response = await read(`?${query}`);
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe("BAD_REQUEST");
    },
  );

  it("SC-09 / BR-09: reading changes nothing", async () => {
    await read();
    await read("?limit=1");
    expect(observations.all()).toHaveLength(5);
  });
});
