/**
 * Reading the Catalogue over HTTP: the two routes, their answers and their validation. The rules are tested
 * in the use cases and the contract of the port. Here: that the answer is the one it should be, that a request
 * that is not authenticated learns nothing, that what is not valid is rejected, and that nothing writes.
 */

import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app";
import { InMemoryListingReader, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { CreatePriceAlert } from "../../../src/price-alerts/application";
import { InMemoryAuthenticator } from "../../../src/price-alerts/http";
import { InMemoryListingCatalogue, InMemoryPriceObservationRepository } from "../../../src/price-observations/adapters";
import { ListListings, ReadListing, type ListingCatalogue } from "../../../src/price-observations/application";
import { ListingId, UserId } from "../../../src/shared/domain";
import { FIXED_CLOCK } from "../../support/created-at";
import { anObservation, type ObservationSpec } from "../../support/observations";

const USER_TOKEN = "user-token";

let app: FastifyInstance;
let catalogue: InMemoryListingCatalogue;
let observations: InMemoryPriceObservationRepository;

function start(options: { catalogue?: ListingCatalogue; apiDocs?: boolean; withCatalogue?: boolean } = {}) {
  const users = new InMemoryAuthenticator();
  users.addUser(USER_TOKEN, UserId("user-1"));
  const listings = options.catalogue ?? catalogue;
  return buildApp({
    createPriceAlert: new CreatePriceAlert(new InMemoryListingReader(), new InMemoryPriceAlertRepository(), FIXED_CLOCK),
    authenticator: users,
    ...(options.withCatalogue === false
      ? {}
      : {
          catalogue: {
            listListings: new ListListings(listings, observations),
            readListing: new ReadListing(listings, observations),
            authenticator: { isUser: async (token) => (await users.authenticate(token)) !== null },
          },
        }),
    ...(options.apiDocs ? { apiDocs: {} } : {}),
  });
}

beforeEach(() => {
  catalogue = new InMemoryListingCatalogue();
  observations = new InMemoryPriceObservationRepository();
  catalogue.addListing(ListingId("headphones-shop-a"), "EUR", { title: "Wireless headphones", retailer: "Shop A" });
  catalogue.addListing(ListingId("keyboard-shop-b"), "USD", { title: "Mechanical keyboard", retailer: "Shop B" });
  app = start();
});

afterEach(async () => {
  await app.close();
});

const get = (url: string, token: string | null = USER_TOKEN) =>
  app.inject({ method: "GET", url, headers: token === null ? {} : { authorization: `Bearer ${token}` } });
const observe = async (...specs: ObservationSpec[]) => {
  for (const spec of specs) await observations.add(anObservation(spec));
};

describe("GET /listings", () => {
  it("SC-01 / BR-01 / BR-02: answers 200 with the Listings, their text and currency, and the total", async () => {
    const response = await get("/listings");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        { id: "keyboard-shop-b", title: "Mechanical keyboard", retailer: "Shop B", currency: "USD", currentPrice: null },
        { id: "headphones-shop-a", title: "Wireless headphones", retailer: "Shop A", currency: "EUR", currentPrice: null },
      ],
      total: 2,
      limit: 20,
      offset: 0,
    });
  });

  it("SC-04 / BR-03: a Listing shows its Current Price and when it was observed", async () => {
    await observe({ observedAt: "2026-11-19T10:00:00Z", price: "100.00" });
    const headphones = (await get("/listings")).json().items.find((l: { id: string }) => l.id === "headphones-shop-a");
    expect(headphones.currentPrice).toEqual({ amount: "100.00", currency: "EUR", observedAt: "2026-11-19T10:00:00.000Z" });
  });

  it("SC-05 / SC-06 / BR-03: a Listing with no Current Price shows null, which is JSON null and not a missing field", async () => {
    await observe({ observedAt: "2026-11-19T09:00:00Z", price: "50.00" }, { observedAt: "2026-11-19T10:00:00Z", price: null });
    const body = (await get("/listings")).json();
    expect(body.items.map((l: { currentPrice: unknown }) => l.currentPrice)).toEqual([null, null]);
    expect((await get("/listings")).body).toContain('"currentPrice":null');
  });

  it("SC-02 / BR-01: the Listings come in the order of the Catalogue", async () => {
    catalogue.addListing(ListingId("headphones-shop-b"), "EUR", { title: "Wireless headphones", retailer: "Shop B" });
    expect((await get("/listings")).json().items.map((l: { id: string }) => l.id)).toEqual([
      "keyboard-shop-b",
      "headphones-shop-a",
      "headphones-shop-b",
    ]);
  });

  it("SC-03: an empty Catalogue is 200 with an empty page", async () => {
    catalogue = new InMemoryListingCatalogue();
    await app.close();
    app = start();
    expect((await get("/listings")).json()).toEqual({ items: [], total: 0, limit: 20, offset: 0 });
  });

  describe("the pages", () => {
    beforeEach(async () => {
      catalogue = new InMemoryListingCatalogue();
      for (let i = 1; i <= 25; i++) {
        catalogue.addListing(ListingId(`listing-${String(i).padStart(2, "0")}`), "EUR", { title: `Item ${String(i).padStart(2, "0")}`, retailer: "Shop" });
      }
      await app.close();
      app = start();
    });

    it("SC-10 / BR-07: a page holds 20 unless another size is asked for, and says the limit and the offset", async () => {
      const body = (await get("/listings")).json();
      expect(body.items).toHaveLength(20);
      expect(body).toMatchObject({ total: 25, limit: 20, offset: 0 });
    });

    it("SC-11: the next page has the last 5, in order", async () => {
      const body = (await get("/listings?offset=20")).json();
      expect(body.items.map((l: { id: string }) => l.id)).toEqual(["listing-21", "listing-22", "listing-23", "listing-24", "listing-25"]);
      expect(body).toMatchObject({ total: 25, limit: 20, offset: 20 });
    });

    it("SC-12: a page beyond the end is 200, empty, and says the total", async () => {
      expect((await get("/listings?offset=100")).json()).toEqual({ items: [], total: 25, limit: 20, offset: 100 });
    });

    it.each([
      ["limit=1", 1],
      ["limit=100", 25],
      ["limit=5&offset=5", 5],
    ])("SC-13: ?%s is valid and gives %i Listings", async (query, shown) => {
      const response = await get(`/listings?${query}`);
      expect(response.statusCode).toBe(200);
      expect(response.json().items).toHaveLength(shown);
    });

    it.each(["limit=0", "limit=101", "offset=-1", "limit=abc", "offset=abc", "limit=1.5", "limit=", "offset=", "limit=5abc", "limit=10&limit=abc"])(
      "SC-13: ?%s is answered 400 BAD_REQUEST",
      async (query) => {
        const response = await get(`/listings?${query}`);
        expect(response.statusCode).toBe(400);
        expect(response.json().code).toBe("BAD_REQUEST");
      },
    );

    it("SC-14: a parameter that does not exist is answered 400", async () => {
      expect((await get("/listings?search=keyboard")).statusCode).toBe(400);
      expect((await get("/listings?limit=5&sort=price")).statusCode).toBe(400);
    });
  });
});

describe("GET /listings/{listingId}", () => {
  it("SC-15 / BR-02 / BR-03 / BR-04: answers 200 with the Listing and its Current Price", async () => {
    await observe({ observedAt: "2026-11-19T10:00:00Z", price: "100.00" });
    const response = await get("/listings/headphones-shop-a");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: "headphones-shop-a",
      title: "Wireless headphones",
      retailer: "Shop A",
      currency: "EUR",
      currentPrice: { amount: "100.00", currency: "EUR", observedAt: "2026-11-19T10:00:00.000Z" },
    });
  });

  it("SC-15: it is the same view that the list shows", async () => {
    await observe({ observedAt: "2026-11-19T10:00:00Z", price: "100.00" });
    const fromList = (await get("/listings")).json().items.find((l: { id: string }) => l.id === "headphones-shop-a");
    expect((await get("/listings/headphones-shop-a")).json()).toEqual(fromList);
  });

  it("SC-16: a Listing with no Current Price is found, with null", async () => {
    const response = await get("/listings/keyboard-shop-b");
    expect(response.statusCode).toBe(200);
    expect(response.json().currentPrice).toBeNull();
  });

  it("SC-17 / BR-04: a Listing that is not in the Catalogue is answered 404 LISTING_NOT_FOUND", async () => {
    const response = await get("/listings/no-such-listing");
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("LISTING_NOT_FOUND");
  });
});

describe("authentication (BR-06)", () => {
  const routes = ["/listings", "/listings/headphones-shop-a"];

  it.each(routes)("SC-18: %s without a token is answered 401 UNAUTHENTICATED", async (url) => {
    const response = await get(url, null);
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHENTICATED");
  });

  it.each(routes)("SC-18: %s with a token that nobody has, or one of a Provider, is answered 401", async (url) => {
    expect((await get(url, "no-such-token")).statusCode).toBe(401);
    expect((await get(url, "a-provider-token")).statusCode).toBe(401);
  });

  it("SC-18: a header that is not a bearer token is answered 401", async () => {
    const response = await app.inject({ method: "GET", url: "/listings", headers: { authorization: `Basic ${USER_TOKEN}` } });
    expect(response.statusCode).toBe(401);
  });

  it("SC-19: a request that is not authenticated learns nothing: 401 before 400, and 401 before 404", async () => {
    expect((await get("/listings?limit=abc&foo=1", null)).statusCode).toBe(401);
    expect((await get("/listings/no-such-listing", null)).statusCode).toBe(401);
  });
});

describe("reading changes nothing, and nothing writes (BR-05, BR-08)", () => {
  it("SC-20: reading twice gives the same answer, and no observation is stored", async () => {
    await observe({ price: "100.00" });
    const before = observations.all();
    const first = (await get("/listings")).body;
    expect((await get("/listings")).body).toBe(first);
    await get("/listings/headphones-shop-a");
    expect(observations.all()).toEqual(before);
  });

  it.each([
    ["POST", "/listings", { id: "new", title: "New", retailer: "Shop", currency: "EUR" }],
    ["PUT", "/listings", {}],
    ["PATCH", "/listings", {}],
    ["DELETE", "/listings", undefined],
    ["POST", "/listings/headphones-shop-a", { title: "Other" }],
    ["PUT", "/listings/headphones-shop-a", { title: "Other title" }],
    ["PATCH", "/listings/headphones-shop-a", { title: "Other title" }],
    ["DELETE", "/listings/headphones-shop-a", undefined],
  ] as const)("SC-21 / BR-08: a %s to %s has no route, and answers 404 NOT_FOUND", async (method, url, payload) => {
    const response = await app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${USER_TOKEN}` },
      ...(payload ? { payload } : {}),
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NOT_FOUND");
    expect((await catalogue.find(ListingId("headphones-shop-a")))?.title).toBe("Wireless headphones");
    expect((await catalogue.list({ limit: 100, offset: 0 })).total).toBe(2);
  });
});

describe("a failure of the Catalogue", () => {
  it("is answered 500 without revealing the cause", async () => {
    await app.close();
    app = start({
      catalogue: {
        find: async () => {
          throw new Error("connection to db-prod-01 refused, password=hunter2");
        },
        list: async () => {
          throw new Error("connection to db-prod-01 refused, password=hunter2");
        },
      },
    });
    for (const url of ["/listings", "/listings/headphones-shop-a"]) {
      const response = await get(url);
      expect(response.statusCode).toBe(500);
      expect(response.json().code).toBe("INTERNAL_ERROR");
      expect(response.body).not.toMatch(/hunter2|db-prod/);
    }
  });
});

describe("the documentation of the routes", () => {
  it("lists both routes, tagged and asking for the token of a User, with the answers that are documented", async () => {
    await app.close();
    app = start({ apiDocs: true });
    const spec = (await app.inject({ method: "GET", url: "/docs/json" })).json();
    expect(Object.keys(spec.paths["/listings"])).toEqual(["get"]);
    expect(Object.keys(spec.paths["/listings/{listingId}"])).toEqual(["get"]);
    for (const operation of [spec.paths["/listings"].get, spec.paths["/listings/{listingId}"].get]) {
      expect(operation.tags).toEqual(["Listings"]);
      expect(operation.security).toEqual([{ bearerAuth: [] }]);
    }
    expect(Object.keys(spec.paths["/listings"].get.responses).sort()).toEqual(["200", "400", "401", "500"]);
    expect(Object.keys(spec.paths["/listings/{listingId}"].get.responses).sort()).toEqual(["200", "401", "404", "500"]);
    expect(spec.tags.map((t: { name: string }) => t.name)).toContain("Listings");
  });

  it("every code that the routes answer is one of those documented for that status", async () => {
    const documented = async (path: string, status: number) => {
      const spec = (await app.inject({ method: "GET", url: "/docs/json" })).json();
      return spec.paths[path].get.responses[String(status)].content["application/json"].schema.properties.code.enum as string[];
    };
    await app.close();
    app = start({ apiDocs: true });
    const answered: [string, string, number][] = [
      ["/listings", "/listings?limit=abc", 400],
      ["/listings", "/listings", 401],
      ["/listings/{listingId}", "/listings/no-such-listing", 404],
      ["/listings/{listingId}", "/listings/headphones-shop-a", 401],
    ];
    for (const [path, url, status] of answered) {
      const response = await get(url, status === 401 ? null : USER_TOKEN);
      expect(response.statusCode).toBe(status);
      expect(await documented(path, status)).toContain(response.json().code);
    }
  });

  it("the code of a failure is documented too", async () => {
    await app.close();
    app = start({
      apiDocs: true,
      catalogue: { find: async () => { throw new Error("x"); }, list: async () => { throw new Error("x"); } },
    });
    const response = await get("/listings");
    const spec = (await app.inject({ method: "GET", url: "/docs/json" })).json();
    expect(response.statusCode).toBe(500);
    expect(spec.paths["/listings"].get.responses["500"].content["application/json"].schema.properties.code.enum).toContain(response.json().code);
  });

  it("documents that a Current Price may be null", async () => {
    await app.close();
    app = start({ apiDocs: true });
    const spec = (await app.inject({ method: "GET", url: "/docs/json" })).json();
    const item = spec.paths["/listings"].get.responses["200"].content["application/json"].schema.properties.items.items;
    expect(item.required).toEqual(["id", "title", "retailer", "currency", "currentPrice"]);
    expect(item.properties.currentPrice.nullable).toBe(true);
  });

  it("without the group, the routes are not served and not documented", async () => {
    await app.close();
    app = start({ apiDocs: true, withCatalogue: false });
    expect((await get("/listings")).statusCode).toBe(404);
    const spec = (await app.inject({ method: "GET", url: "/docs/json" })).json();
    expect(Object.keys(spec.paths)).not.toContain("/listings");
    expect(spec.tags.map((t: { name: string }) => t.name)).not.toContain("Listings");
  });
});
