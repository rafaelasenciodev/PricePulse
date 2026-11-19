/**
 * The API documentation of the routes that read the notifications and the Price History. It is
 * generated from the schemas that validate the requests, so these tests check that it says what
 * the API does.
 */

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { composeInMemoryApp } from "../../../src/composition-root";
import { buildApp } from "../../../src/app";
import { InMemoryListingReader, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { CreatePriceAlert } from "../../../src/price-alerts/application";
import { InMemoryAuthenticator } from "../../../src/price-alerts/http";
import { InMemoryListingCatalogue, InMemoryPriceObservationRepository } from "../../../src/price-observations/adapters";
import { ReadPriceHistory } from "../../../src/price-observations/application";
import { FIXED_CLOCK } from "../../support/created-at";

let app: FastifyInstance;
afterEach(async () => {
  await app.close();
});

const spec = async () => (await app.inject({ method: "GET", url: "/docs/json" })).json();
const codes = (operation: { responses: object }) => Object.keys(operation.responses).sort();

describe("the OpenAPI document with the route of the Price History", () => {
  it("documents it as a read of Users, with its tag and its bearer token", async () => {
    app = composeInMemoryApp({ apiDocs: {} }).app;
    const { paths, tags } = await spec();
    const get = paths["/listings/{listingId}/price-observations"].get;
    expect(get.security).toEqual([{ bearerAuth: [] }]);
    expect(get.tags).toEqual(["Price history"]);
    expect(tags.map((t: { name: string }) => t.name)).toContain("Price history");
  });

  it("shares the path with the recording of prices, which is another operation with the credential of a Provider", async () => {
    app = composeInMemoryApp({ apiDocs: {} }).app;
    const path = (await spec()).paths["/listings/{listingId}/price-observations"];
    expect(Object.keys(path).sort()).toEqual(["get", "post"]);
    expect(path.post.security).toEqual([{ providerAuth: [] }]);
    expect(path.get.security).toEqual([{ bearerAuth: [] }]);
  });

  it("documents the answers it gives", async () => {
    app = composeInMemoryApp({ apiDocs: {} }).app;
    const get = (await spec()).paths["/listings/{listingId}/price-observations"].get;
    expect(codes(get)).toEqual(["200", "400", "401", "404", "422", "500"]);
  });

  it("documents the code of the error of the range", async () => {
    app = composeInMemoryApp({ apiDocs: {} }).app;
    const get = (await spec()).paths["/listings/{listingId}/price-observations"].get;
    expect(get.responses["422"].content["application/json"].schema.properties.code.enum).toEqual(["INVALID_RANGE"]);
  });

  it("documents the query: the range, and the limit and offset with their bounds", async () => {
    app = composeInMemoryApp({ apiDocs: {} }).app;
    const get = (await spec()).paths["/listings/{listingId}/price-observations"].get;
    const byName = Object.fromEntries(
      (get.parameters as { name: string; in: string; schema: Record<string, unknown> }[]).filter((p) => p.in === "query").map((p) => [p.name, p.schema]),
    );
    expect(Object.keys(byName).sort()).toEqual(["from", "limit", "offset", "to"]);
    expect(byName["limit"]).toMatchObject({ type: "integer", minimum: 1, maximum: 100, default: 20 });
    expect(byName["offset"]).toMatchObject({ type: "integer", minimum: 0, default: 0 });
  });

  it("documents each observation with its Provider, and a Price that can be null", async () => {
    app = composeInMemoryApp({ apiDocs: {} }).app;
    const get = (await spec()).paths["/listings/{listingId}/price-observations"].get;
    const item = get.responses["200"].content["application/json"].schema.properties.items.items;
    expect(item.required).toEqual(["provider", "listingId", "observedAt", "price"]);
    expect(item.properties.price.nullable).toBe(true);
  });

  it("without the group of the history, the route is not served and not documented", async () => {
    app = buildApp({
      createPriceAlert: new CreatePriceAlert(new InMemoryListingReader(), new InMemoryPriceAlertRepository(), FIXED_CLOCK),
      authenticator: new InMemoryAuthenticator(),
      apiDocs: {},
    });
    expect(Object.keys((await spec()).paths)).toEqual(["/listings/{listingId}/price-alerts"]);
    expect((await app.inject({ method: "GET", url: "/listings/x/price-observations" })).statusCode).toBe(404);
  });

  it("the history alone is documented when it is the only group, without the other routes of observations", async () => {
    const users = new InMemoryAuthenticator();
    app = buildApp({
      createPriceAlert: new CreatePriceAlert(new InMemoryListingReader(), new InMemoryPriceAlertRepository(), FIXED_CLOCK),
      authenticator: users,
      priceHistory: {
        readPriceHistory: new ReadPriceHistory(new InMemoryListingCatalogue(), new InMemoryPriceObservationRepository()),
        authenticator: { isUser: async () => true },
      },
      apiDocs: {},
    });
    const path = (await spec()).paths["/listings/{listingId}/price-observations"];
    expect(Object.keys(path)).toEqual(["get"]);
  });
});

describe("the OpenAPI document with the route of the Notifications", () => {
  it("documents it with its tag, its bearer token and its answers", async () => {
    app = composeInMemoryApp({ apiDocs: {} }).app;
    const { paths, tags } = await spec();
    const get = paths["/notifications"].get;
    expect(get.security).toEqual([{ bearerAuth: [] }]);
    expect(get.tags).toEqual(["Notifications"]);
    expect(codes(get)).toEqual(["200", "400", "401", "500"]);
    expect(tags.map((t: { name: string }) => t.name)).toContain("Notifications");
  });

  it("documents each Notification with what it states", async () => {
    app = composeInMemoryApp({ apiDocs: {} }).app;
    const get = (await spec()).paths["/notifications"].get;
    const item = get.responses["200"].content["application/json"].schema.properties.items.items;
    expect(item.required).toEqual(["alertId", "owner", "listingId", "targetPrice", "currentPrice", "observedAt"]);
  });
});
