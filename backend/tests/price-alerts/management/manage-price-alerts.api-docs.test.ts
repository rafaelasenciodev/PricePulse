/**
 * The API documentation of the routes that read and manage Price Alerts. It is generated from
 * the schemas that validate the requests, so these tests check that it says what the API does.
 */

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app";
import { InMemoryListingReader, InMemoryNotificationRepository, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { CancelPriceAlert, CreatePriceAlert, GetPriceAlert, ListNotifications, ListPriceAlerts, ModifyTargetPrice } from "../../../src/price-alerts/application";
import { InMemoryAuthenticator } from "../../../src/price-alerts/http";
import { FIXED_CLOCK } from "../../support/created-at";

let app: FastifyInstance;
afterEach(async () => {
  await app.close();
});

function start(withManagement: boolean) {
  const alerts = new InMemoryPriceAlertRepository();
  const listings = new InMemoryListingReader();
  app = buildApp({
    createPriceAlert: new CreatePriceAlert(listings, alerts, FIXED_CLOCK),
    authenticator: new InMemoryAuthenticator(),
    apiDocs: {},
    ...(withManagement
      ? {
          priceAlertManagement: {
            listPriceAlerts: new ListPriceAlerts(alerts),
            listNotifications: new ListNotifications(new InMemoryNotificationRepository()),
            getPriceAlert: new GetPriceAlert(alerts),
            modifyTargetPrice: new ModifyTargetPrice(alerts, listings),
            cancelPriceAlert: new CancelPriceAlert(alerts),
          },
        }
      : {}),
  });
}

const spec = async () => (await app.inject({ method: "GET", url: "/docs/json" })).json();
const codes = (operation: { responses: object }) => Object.keys(operation.responses).sort();

describe("the OpenAPI document with the routes of reading and managing", () => {
  it("describes the three routes, and says that each needs a bearer token", async () => {
    start(true);
    const { paths } = await spec();
    expect(Object.keys(paths).sort()).toEqual(["/listings/{listingId}/price-alerts", "/notifications", "/price-alerts", "/price-alerts/{alertId}"]);
    expect(Object.keys(paths["/price-alerts"])).toEqual(["get"]);
    expect(Object.keys(paths["/price-alerts/{alertId}"]).sort()).toEqual(["get", "patch"]);
    for (const operation of [paths["/price-alerts"].get, paths["/price-alerts/{alertId}"].get, paths["/price-alerts/{alertId}"].patch]) {
      expect(operation.security).toEqual([{ bearerAuth: [] }]);
      expect(operation.tags).toEqual(["Price alerts"]);
    }
  });

  it("documents the answers that each route gives", async () => {
    start(true);
    const { paths } = await spec();
    expect(codes(paths["/price-alerts"].get)).toEqual(["200", "400", "401", "500"]);
    expect(codes(paths["/price-alerts/{alertId}"].get)).toEqual(["200", "401", "404", "500"]);
    expect(codes(paths["/price-alerts/{alertId}"].patch)).toEqual(["200", "400", "401", "403", "404", "409", "422", "500"]);
  });

  it("documents the codes of the errors that are new", async () => {
    start(true);
    const { paths } = await spec();
    const code = (operation: { responses: Record<string, { content: { "application/json": { schema: { properties: { code: { enum: string[] } } } } } }> }, status: string) =>
      operation.responses[status]?.content["application/json"].schema.properties.code.enum;
    expect(code(paths["/price-alerts/{alertId}"].get, "404")).toEqual(["ALERT_NOT_FOUND"]);
    expect(code(paths["/price-alerts/{alertId}"].patch, "409")).toEqual(["ALERT_NOT_ACTIVE", "ALERT_CONFLICT", "TARGET_ALREADY_REACHED"]);
  });

  it("documents the query of the list: the state, and the limit and offset with their range", async () => {
    start(true);
    const { paths } = await spec();
    const parameters = paths["/price-alerts"].get.parameters as { name: string; in: string; schema: Record<string, unknown> }[];
    const byName = Object.fromEntries(parameters.map((p) => [p.name, p.schema]));
    expect(parameters.every((p) => p.in === "query")).toBe(true);
    expect(byName["status"]).toMatchObject({ enum: ["active", "triggered", "cancelled"] });
    expect(byName["limit"]).toMatchObject({ type: "integer", minimum: 1, maximum: 100, default: 20 });
    expect(byName["offset"]).toMatchObject({ type: "integer", minimum: 0, default: 0 });
  });

  it("documents the body of the PATCH as one of two changes", async () => {
    start(true);
    const { paths } = await spec();
    const body = paths["/price-alerts/{alertId}"].patch.requestBody.content["application/json"].schema;
    expect(body.oneOf).toHaveLength(2);
    expect(body.oneOf[0].required).toEqual(["targetAmount"]);
    expect(body.oneOf[1].required).toEqual(["status"]);
    expect(body.oneOf[1].properties.status.enum).toEqual(["cancelled"]);
  });

  it("documents the states that an alert can have, now including cancelled", async () => {
    start(true);
    const { paths } = await spec();
    const alert = paths["/price-alerts/{alertId}"].get.responses["200"].content["application/json"].schema;
    expect(alert.properties.status.enum).toEqual(["active", "triggered", "cancelled"]);
    expect(alert.required).toContain("createdAt");
  });

  it("says in the description of the API that alerts can be read and managed", async () => {
    start(true);
    expect((await spec()).info.description).toContain("read them and manage them");
  });
});

describe("without the routes of reading and managing", () => {
  it("only the creation is documented, and the routes do not exist", async () => {
    start(false);
    expect(Object.keys((await spec()).paths)).toEqual(["/listings/{listingId}/price-alerts"]);
    expect((await app.inject({ method: "GET", url: "/price-alerts" })).statusCode).toBe(404);
  });
});
