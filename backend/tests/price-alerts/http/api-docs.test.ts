/**
 * The interactive API documentation (OpenAPI and Swagger UI).
 *
 * The documentation is generated from the schemas of the route. These tests check that it
 * is served only when asked for, that it describes the endpoint, and above all that it does
 * not drift from what the API really answers.
 */

import { readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { API_VERSION, buildApp } from "../../../src/app";
import { InMemoryListingReader, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { CreatePriceAlert, type ListingReader } from "../../../src/price-alerts/application";
import { ListingId, Price, UserId } from "../../../src/price-alerts/domain";
import { InMemoryAuthenticator } from "../../../src/price-alerts/http";

const TOKEN = "token-1";
const OTHER_TOKEN = "token-2";
const HEADPHONES = ListingId("headphones-shop-a");
const PATH = "/listings/{listingId}/price-alerts";

let app: FastifyInstance;
afterEach(async () => {
  await app.close();
});

function start(options: { docs?: boolean; listings?: ListingReader } = {}) {
  const listings = new InMemoryListingReader();
  listings.addListing(HEADPHONES, "EUR", Price.fromDecimalString("100.00", "EUR"));
  const authenticator = new InMemoryAuthenticator();
  authenticator.addUser(TOKEN, UserId("user-1"));
  authenticator.addUser(OTHER_TOKEN, UserId("user-2"));
  app = buildApp({
    createPriceAlert: new CreatePriceAlert(options.listings ?? listings, new InMemoryPriceAlertRepository()),
    authenticator,
    apiDocs: options.docs === false ? undefined : { note: "Demo note for the tests" },
  });
}

const spec = async () => (await app.inject({ method: "GET", url: "/docs/json" })).json();

const post = (token: string | null, targetAmount: unknown, listing = HEADPHONES as string) =>
  app.inject({
    method: "POST",
    url: `/listings/${listing}/price-alerts`,
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
    payload: { targetAmount } as object,
  });

describe("when the documentation is not asked for", () => {
  it("is not served: there is no /docs and no OpenAPI document", async () => {
    start({ docs: false });
    for (const url of ["/docs", "/docs/", "/docs/json"]) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode, url).toBe(404);
    }
  });
});

describe("the OpenAPI document", () => {
  it("is served without a token", async () => {
    start();
    expect((await app.inject({ method: "GET", url: "/docs/json" })).statusCode).toBe(200);
  });

  it("identifies the API, with the version of the package and the note given", async () => {
    start();
    const { openapi, info } = await spec();
    expect(openapi).toBe("3.0.3");
    expect(info.title).toBe("PricePulse API");
    expect(info.description).toContain("Demo note for the tests");
    const pkg = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
    expect(info.version).toBe(pkg.version);
    expect(API_VERSION).toBe(pkg.version);
  });

  it("describes the endpoint and says that it needs a bearer token", async () => {
    start();
    const document = await spec();
    const operation = document.paths[PATH].post;
    expect(operation.summary).toBe("Create a Price Alert");
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(document.components.securitySchemes.bearerAuth).toMatchObject({ type: "http", scheme: "bearer" });
  });

  it("describes the body: targetAmount is required text, and nothing else is accepted", async () => {
    start();
    const body = (await spec()).paths[PATH].post.requestBody.content["application/json"].schema;
    expect(body.required).toEqual(["targetAmount"]);
    expect(body.properties.targetAmount.type).toBe("string");
    expect(body.additionalProperties).toBe(false);
  });

  it("documents every status the endpoint answers", async () => {
    start();
    const responses = (await spec()).paths[PATH].post.responses;
    expect(Object.keys(responses).sort()).toEqual(["200", "201", "400", "401", "404", "409", "422", "500"]);
  });
});

describe("the documentation does not drift from the behaviour", () => {
  const documentedCodes = async (status: number): Promise<string[]> => {
    const response = (await spec()).paths[PATH].post.responses[String(status)];
    return response.content["application/json"].schema.properties.code.enum;
  };

  /** Each case provokes a real answer and checks its error code is one the documentation lists. */
  it.each([
    ["400", 400, () => post(TOKEN, 80)],
    ["401", 401, () => post(null, "80.00")],
    ["404", 404, () => post(TOKEN, "80.00", "nonexistent")],
    ["409 (duplicate)", 409, async () => (await post(TOKEN, "80.00"), post(TOKEN, "70.00"))],
    ["409 (already reached)", 409, () => post(OTHER_TOKEN, "100.00")],
    ["422", 422, () => post(TOKEN, "79.999")],
  ])("%s: the code answered is documented", async (_name, status, provoke) => {
    start();
    const response = await provoke();
    expect(response.statusCode).toBe(status);
    expect(await documentedCodes(status)).toContain(response.json().code);
  });

  it("500: the code answered is documented", async () => {
    start({
      listings: {
        get: async () => {
          throw new Error("secret detail");
        },
      },
    });
    const response = await post(TOKEN, "80.00");
    expect(response.statusCode).toBe(500);
    expect(await documentedCodes(500)).toContain(response.json().code);
  });

  it("201 and 200: the Price Alert has exactly the documented fields", async () => {
    start();
    const documented = (await spec()).paths[PATH].post.responses["201"].content["application/json"].schema;
    const created = await post(TOKEN, "80.00");
    const repeated = await post(TOKEN, "80.00");
    expect(created.statusCode).toBe(201);
    expect(repeated.statusCode).toBe(200);
    expect(Object.keys(created.json()).sort()).toEqual(Object.keys(documented.properties).sort());
    expect(repeated.json()).toEqual(created.json());
  });
});

describe("Swagger UI", () => {
  it("is served as a page at /docs/", async () => {
    start();
    const response = await app.inject({ method: "GET", url: "/docs/" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body.toLowerCase()).toContain("swagger");
  });
});
