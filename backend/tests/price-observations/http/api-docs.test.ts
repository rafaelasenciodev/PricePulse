/**
 * The interactive API documentation, for the endpoint of Price Observations.
 *
 * The documentation is generated from the schemas of the route. These tests check that it
 * describes the endpoint and above all that it does not drift from what the API really
 * answers. The documentation of Price Alerts is tested in its own feature.
 */

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app";
import { InMemoryListingReader, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { CreatePriceAlert } from "../../../src/price-alerts/application";
import { InMemoryAuthenticator } from "../../../src/price-alerts/http";
import { InMemoryListingCatalogue, InMemoryPriceObservationRepository } from "../../../src/price-observations/adapters";
import { RecordPriceObservation, type ListingCatalogue } from "../../../src/price-observations/application";
import { ProviderId } from "../../../src/price-observations/domain";
import { InMemoryProviderAuthenticator } from "../../../src/price-observations/http";
import { ListingId } from "../../../src/shared/domain";

const TOKEN = "token-simulator";
const HEADPHONES = ListingId("headphones-shop-a");
const PATH = "/listings/{listingId}/price-observations";
const VALID = { observedAt: "2026-11-19T10:00:00Z", price: { amount: "79.90", currency: "EUR" } };

let app: FastifyInstance;
afterEach(async () => {
  await app.close();
});

function start(options: { withObservations?: boolean; catalogue?: ListingCatalogue } = {}) {
  const catalogue = new InMemoryListingCatalogue();
  catalogue.addListing(HEADPHONES, "EUR");
  const providers = new InMemoryProviderAuthenticator();
  providers.addProvider(TOKEN, ProviderId("simulator"));
  app = buildApp({
    createPriceAlert: new CreatePriceAlert(new InMemoryListingReader(), new InMemoryPriceAlertRepository()),
    authenticator: new InMemoryAuthenticator(),
    priceObservations:
      options.withObservations === false
        ? undefined
        : {
            recordPriceObservation: new RecordPriceObservation(
              options.catalogue ?? catalogue,
              new InMemoryPriceObservationRepository(),
              { now: () => new Date("2026-11-19T12:00:00Z") },
            ),
            authenticator: providers,
          },
    apiDocs: { note: "Demo note for the tests" },
  });
}

const spec = async () => (await app.inject({ method: "GET", url: "/docs/json" })).json();

const post = (token: string | null, payload: unknown, listing = HEADPHONES as string) =>
  app.inject({
    method: "POST",
    url: `/listings/${listing}/price-observations`,
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
    payload: payload as object,
  });

describe("the OpenAPI document", () => {
  it("describes the endpoint and says that it needs the bearer token of a Provider", async () => {
    start();
    const document = await spec();
    const operation = document.paths[PATH].post;
    expect(operation.summary).toBe("Record a Price Observation");
    expect(operation.tags).toEqual(["Price observations"]);
    expect(operation.security).toEqual([{ providerAuth: [] }]);
    expect(document.components.securitySchemes.providerAuth).toMatchObject({ type: "http", scheme: "bearer" });
  });

  it("keeps the token of a Provider apart from the token of a User", async () => {
    start();
    const document = await spec();
    expect(document.components.securitySchemes.bearerAuth).toBeDefined();
    expect(document.components.securitySchemes.providerAuth).toBeDefined();
    expect(document.paths["/listings/{listingId}/price-alerts"].post.security).toEqual([{ bearerAuth: [] }]);
  });

  it("describes the body: observedAt and price are required, price may be null, and nothing else is accepted", async () => {
    start();
    const body = (await spec()).paths[PATH].post.requestBody.content["application/json"].schema;
    expect(body.required).toEqual(["observedAt", "price"]);
    expect(body.additionalProperties).toBe(false);
    expect(body.properties.observedAt.type).toBe("string");
    expect(body.properties.price.nullable).toBe(true);
    expect(body.properties.price.required).toEqual(["amount", "currency"]);
    expect(body.properties.price.properties.amount.type).toBe("string");
    expect(body.properties.price.additionalProperties).toBe(false);
  });

  it("documents every status the endpoint answers", async () => {
    start();
    const responses = (await spec()).paths[PATH].post.responses;
    expect(Object.keys(responses).sort()).toEqual(["200", "201", "400", "401", "404", "409", "422", "500"]);
  });

  it("documents that the price of the response may be null", async () => {
    start();
    const created = (await spec()).paths[PATH].post.responses["201"].content["application/json"].schema;
    expect(created.properties.price.nullable).toBe(true);
  });

  it("mentions the observations in the description of the API, and the tag", async () => {
    start();
    const document = await spec();
    expect(document.info.description).toContain("price observations");
    expect(document.tags.map((tag: { name: string }) => tag.name)).toEqual(["Price alerts", "Price observations"]);
  });
});

describe("without the routes of Price Observations", () => {
  it("the documentation does not mention them", async () => {
    start({ withObservations: false });
    const document = await spec();
    expect(document.paths[PATH]).toBeUndefined();
    expect(document.components.securitySchemes.providerAuth).toBeUndefined();
    expect(document.tags.map((tag: { name: string }) => tag.name)).toEqual(["Price alerts"]);
    expect(document.info.description).not.toContain("price observations");
  });
});

describe("the documentation does not drift from the behaviour", () => {
  const documentedCodes = async (status: number): Promise<string[]> => {
    const response = (await spec()).paths[PATH].post.responses[String(status)];
    return response.content["application/json"].schema.properties.code.enum;
  };

  /** Each case provokes a real answer and checks its error code is one the documentation lists. */
  it.each([
    ["400", 400, () => post(TOKEN, { observedAt: VALID.observedAt })],
    ["401", 401, () => post(null, VALID)],
    ["404", 404, () => post(TOKEN, VALID, "nonexistent")],
    ["409", 409, async () => (await post(TOKEN, VALID), post(TOKEN, { ...VALID, price: null }))],
    ["422", 422, () => post(TOKEN, { ...VALID, price: { amount: "-5.00", currency: "EUR" } })],
  ])("%s: the code answered is documented", async (_name, status, provoke) => {
    start();
    const response = await provoke();
    expect(response.statusCode).toBe(status);
    expect(await documentedCodes(status)).toContain(response.json().code);
  });

  it("500: the code answered is documented", async () => {
    start({
      catalogue: {
        find: async () => {
          throw new Error("secret detail");
        },
      },
    });
    const response = await post(TOKEN, VALID);
    expect(response.statusCode).toBe(500);
    expect(await documentedCodes(500)).toContain(response.json().code);
  });

  it.each([
    ["with a Price", VALID],
    ["without a Price", { ...VALID, price: null }],
  ])("201 and 200: the observation %s has exactly the documented fields", async (_name, payload) => {
    start();
    const documented = (await spec()).paths[PATH].post.responses["201"].content["application/json"].schema;
    const recorded = await post(TOKEN, payload);
    const repeated = await post(TOKEN, payload);
    expect(recorded.statusCode).toBe(201);
    expect(repeated.statusCode).toBe(200);
    expect(Object.keys(recorded.json()).sort()).toEqual(Object.keys(documented.properties).sort());
    expect(repeated.json()).toEqual(recorded.json());
  });

  it("the example of the documentation is a request that the API accepts", async () => {
    start();
    const body = (await spec()).paths[PATH].post.requestBody.content["application/json"].schema;
    // OpenAPI 3.0 calls it `example`, whatever the schema calls it
    const example = {
      observedAt: body.properties.observedAt.example,
      price: {
        amount: body.properties.price.properties.amount.example,
        currency: body.properties.price.properties.currency.example,
      },
    };
    expect(example.observedAt).toBe("2026-11-19T10:00:00Z");
    expect((await post(TOKEN, example)).statusCode).toBe(201);
  });
});
