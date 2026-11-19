/**
 * Reading and managing Price Alerts over HTTP: the routes, their answers and their validation.
 * The rules are tested in the use cases. Here: that each answer is the one it should be, that
 * a request that is not authenticated learns nothing, and that what is not valid is rejected.
 */

import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../../src/app";
import { InMemoryListingReader, InMemoryNotificationRepository, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import {
  CancelPriceAlert,
  CreatePriceAlert,
  GetPriceAlert,
  ListNotifications,
  ListPriceAlerts,
  ModifyTargetPrice,
} from "../../../src/price-alerts/application";
import { AlertStatus, UserId, type PriceAlert } from "../../../src/price-alerts/domain";
import { InMemoryAuthenticator } from "../../../src/price-alerts/http";
import { ListingId, Price } from "../../../src/shared/domain";
import { anAlert, type AlertSpec } from "../../support/alerts";
import { FIXED_CLOCK } from "../../support/created-at";

const TOKEN_1 = "token-1";
const TOKEN_2 = "token-2";
const HEADPHONES = "headphones-shop-a";
const eur = (amount: string) => Price.fromDecimalString(amount, "EUR");

let app: FastifyInstance;
let alerts: InMemoryPriceAlertRepository;
let listings: InMemoryListingReader;

function start(repository: InMemoryPriceAlertRepository = alerts) {
  const authenticator = new InMemoryAuthenticator();
  authenticator.addUser(TOKEN_1, UserId("user-1"));
  authenticator.addUser(TOKEN_2, UserId("user-2"));
  app = buildApp({
    createPriceAlert: new CreatePriceAlert(listings, repository, FIXED_CLOCK),
    authenticator,
    priceAlertManagement: {
      listPriceAlerts: new ListPriceAlerts(repository),
      listNotifications: new ListNotifications(new InMemoryNotificationRepository()),
      getPriceAlert: new GetPriceAlert(repository),
      modifyTargetPrice: new ModifyTargetPrice(repository, listings),
      cancelPriceAlert: new CancelPriceAlert(repository),
    },
  });
}

beforeEach(() => {
  alerts = new InMemoryPriceAlertRepository();
  listings = new InMemoryListingReader();
  listings.addListing(ListingId(HEADPHONES), "EUR", eur("100.00"));
  start();
});

afterEach(async () => {
  await app.close();
});

const auth = (token: string | null) => (token === null ? {} : { authorization: `Bearer ${token}` });

const list = (query = "", token: string | null = TOKEN_1) =>
  app.inject({ method: "GET", url: `/price-alerts${query}`, headers: auth(token) });
const read = (id: string, token: string | null = TOKEN_1) =>
  app.inject({ method: "GET", url: `/price-alerts/${id}`, headers: auth(token) });
const patch = (id: string, payload: unknown, token: string | null = TOKEN_1) =>
  app.inject({ method: "PATCH", url: `/price-alerts/${id}`, headers: auth(token), payload: payload as object });

/** An alert in the store, and the identifier to ask for it. */
async function given(spec: AlertSpec & { status?: AlertStatus } = {}): Promise<PriceAlert> {
  const { status = AlertStatus.Active, ...rest } = spec;
  const alert = anAlert({ owner: "user-1", listing: HEADPHONES, ...rest });
  await alerts.add(alert);
  if (status === AlertStatus.Triggered) await alerts.save(alert.trigger(), AlertStatus.Active);
  if (status === AlertStatus.Cancelled) await alerts.save(alert.cancel(), AlertStatus.Active);
  return alert;
}

describe("authentication (BR-01, SC-07)", () => {
  const requests: [string, (token: string | null) => ReturnType<typeof list>][] = [
    ["GET /price-alerts", (token) => list("", token)],
    ["GET /price-alerts/{id}", (token) => read("any", token)],
    ["PATCH /price-alerts/{id}", (token) => patch("any", { status: "cancelled" }, token)],
  ];

  it.each(requests)("SC-07: %s without a token answers 401", async (_name, send) => {
    const response = await send(null);
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHENTICATED");
  });

  it.each(requests)("SC-07: %s with a token that is not valid answers 401", async (_name, send) => {
    expect((await send("not-a-token")).statusCode).toBe(401);
  });

  it("a request that is not authenticated learns nothing about what a valid one looks like", async () => {
    expect((await list("?limit=abc&foo=1", null)).statusCode).toBe(401);
    expect((await patch("any", { nonsense: true }, null)).statusCode).toBe(401);
  });
});

describe("listing the Price Alerts", () => {
  it("SC-01 / BR-02: answers 200 with a page, newest first, with what each alert shows", async () => {
    await given({ listing: "l-1", target: "80.00", createdAt: "2026-11-19T10:00:00Z" });
    await given({ listing: "l-2", target: "45.50", currency: "USD", createdAt: "2026-11-19T12:00:00Z" });

    const response = await list();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 2, limit: 20, offset: 0 });
    expect(response.json().items.map((a: { listingId: string }) => a.listingId)).toEqual(["l-2", "l-1"]);
    expect(response.json().items[0]).toEqual({
      id: expect.any(String),
      listingId: "l-2",
      targetAmount: "45.50",
      currency: "USD",
      status: "active",
      createdAt: "2026-11-19T12:00:00.000Z",
    });
  });

  it.each([[AlertStatus.Active], [AlertStatus.Triggered], [AlertStatus.Cancelled]])(
    "SC-02 / BR-02: ?status=%s keeps only the alerts in that state",
    async (status) => {
      await given({ listing: "l-1", status: AlertStatus.Active });
      await given({ listing: "l-2", status: AlertStatus.Triggered });
      await given({ listing: "l-3", status: AlertStatus.Cancelled });

      const body = (await list(`?status=${status}`)).json();

      expect(body.items.map((a: { status: string }) => a.status)).toEqual([status]);
      expect(body.total).toBe(1);
    },
  );

  it("SC-03 / BR-01: lists only the alerts of the authenticated User", async () => {
    await given({ owner: "user-1", listing: "l-1" });
    await given({ owner: "user-2", listing: "l-2" });
    expect((await list("", TOKEN_1)).json().items.map((a: { listingId: string }) => a.listingId)).toEqual(["l-1"]);
    expect((await list("", TOKEN_2)).json().items.map((a: { listingId: string }) => a.listingId)).toEqual(["l-2"]);
  });

  it("SC-04 / BR-02: a User without alerts gets 200 and an empty list", async () => {
    const response = await list();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it("the pages follow limit and offset, written as numbers in the URL", async () => {
    for (let hour = 1; hour <= 3; hour++) await given({ listing: `l-${hour}`, createdAt: `2026-11-19T0${hour}:00:00Z` });

    const body = (await list("?limit=1&offset=1")).json();

    expect(body.items.map((a: { listingId: string }) => a.listingId)).toEqual(["l-2"]);
    expect(body).toMatchObject({ total: 3, limit: 1, offset: 1 });
  });

  it("accepts the largest limit", async () => {
    expect((await list("?limit=100")).statusCode).toBe(200);
  });

  it.each([
    ["limit=0"],
    ["limit=101"],
    ["limit=-1"],
    ["limit=abc"],
    ["limit=1.5"],
    ["limit="],
    ["offset=-1"],
    ["offset=abc"],
    ["status=bogus"],
    ["foo=1"],
  ])("answers 400 BAD_REQUEST to ?%s", async (query) => {
    const response = await list(`?${query}`);
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("BAD_REQUEST");
  });
});

describe("reading one Price Alert", () => {
  it("SC-05 / BR-02: answers 200 with the alert", async () => {
    const alert = await given({ target: "80.00", createdAt: "2026-11-19T10:00:00Z" });
    const response = await read(alert.id);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: alert.id,
      listingId: HEADPHONES,
      targetAmount: "80.00",
      currency: "EUR",
      status: "active",
      createdAt: "2026-11-19T10:00:00.000Z",
    });
  });

  it("SC-06 / BR-01: an alert of another User answers 404 ALERT_NOT_FOUND", async () => {
    const theirs = await given({ owner: "user-2" });
    const response = await read(theirs.id, TOKEN_1);
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("ALERT_NOT_FOUND");
  });

  it("SC-06 / BR-01: one that does not exist answers the same: the two cannot be told apart", async () => {
    const theirs = await given({ owner: "user-2" });
    const ofAnother = await read(theirs.id, TOKEN_1);
    const missing = await read("no-such-alert", TOKEN_1);
    expect(missing.statusCode).toBe(ofAnother.statusCode);
    expect(missing.json().code).toBe(ofAnother.json().code);
    expect(missing.json().message.replace("no-such-alert", "ID")).toBe(ofAnother.json().message.replace(theirs.id, "ID"));
  });
});

describe("modifying the Target Price", () => {
  it("SC-14 / BR-05: answers 200 with the alert, with its new Target Price", async () => {
    const alert = await given({ target: "80.00", createdAt: "2026-11-19T10:00:00Z" });
    const response = await patch(alert.id, { targetAmount: "70.00" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: alert.id, targetAmount: "70.00", status: "active", createdAt: "2026-11-19T10:00:00.000Z" });
    expect((await read(alert.id)).json().targetAmount).toBe("70.00");
  });

  it.each([["0.00"], ["-5.00"], ["79.999"], ["abc"]])(
    "SC-15 / BR-05: %s answers 422 INVALID_TARGET_PRICE and the Target Price stays",
    async (amount) => {
      const alert = await given({ target: "80.00" });
      const response = await patch(alert.id, { targetAmount: amount });
      expect(response.statusCode).toBe(422);
      expect(response.json().code).toBe("INVALID_TARGET_PRICE");
      expect((await read(alert.id)).json().targetAmount).toBe("80.00");
    },
  );

  it("SC-16 / BR-05: a Target Price that the Current Price already reaches answers 409 TARGET_ALREADY_REACHED", async () => {
    const alert = await given({ target: "80.00" });
    const response = await patch(alert.id, { targetAmount: "100.00" });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("TARGET_ALREADY_REACHED");
  });

  it.each([[AlertStatus.Triggered], [AlertStatus.Cancelled]])(
    "SC-17 / BR-05: a %s alert answers 409 ALERT_NOT_ACTIVE",
    async (status) => {
      const alert = await given({ target: "80.00", status });
      const response = await patch(alert.id, { targetAmount: "70.00" });
      expect(response.statusCode).toBe(409);
      expect(response.json().code).toBe("ALERT_NOT_ACTIVE");
      expect((await read(alert.id)).json().targetAmount).toBe("80.00");
    },
  );

  it("SC-18 / BR-06: the same Target Price answers 200 and changes nothing", async () => {
    const alert = await given({ target: "80.00" });
    const response = await patch(alert.id, { targetAmount: "80.00" });
    expect(response.statusCode).toBe(200);
    expect(response.json().targetAmount).toBe("80.00");
  });

  it("SC-19 / BR-05: a Listing without a Current Price allows any valid Target Price", async () => {
    const alert = await given({ target: "80.00" });
    listings.addListing(ListingId(HEADPHONES), "EUR");
    expect((await patch(alert.id, { targetAmount: "150.00" })).json().targetAmount).toBe("150.00");
  });

  it("SC-06 / BR-01: an alert of another User answers 404 and is not changed", async () => {
    const theirs = await given({ owner: "user-2", target: "80.00" });
    const response = await patch(theirs.id, { targetAmount: "70.00" }, TOKEN_1);
    expect(response.statusCode).toBe(404);
    expect((await read(theirs.id, TOKEN_2)).json().targetAmount).toBe("80.00");
  });
});

describe("cancelling a Price Alert", () => {
  it("SC-08 / BR-03: answers 200 with the alert Cancelled, and it stays in the list", async () => {
    const alert = await given();
    const response = await patch(alert.id, { status: "cancelled" });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("cancelled");
    expect((await list("?status=cancelled")).json().total).toBe(1);
  });

  it("SC-11 / BR-04: cancelling it again answers 200 and changes nothing", async () => {
    const alert = await given();
    await patch(alert.id, { status: "cancelled" });
    const again = await patch(alert.id, { status: "cancelled" });
    expect(again.statusCode).toBe(200);
    expect(again.json().status).toBe("cancelled");
  });

  it("SC-12 / BR-04: a Triggered alert answers 409 ALERT_NOT_ACTIVE and stays Triggered", async () => {
    const alert = await given({ status: AlertStatus.Triggered });
    const response = await patch(alert.id, { status: "cancelled" });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("ALERT_NOT_ACTIVE");
    expect((await read(alert.id)).json().status).toBe("triggered");
  });

  it("SC-06 / BR-01: an alert of another User, or one that does not exist, answers 404", async () => {
    const theirs = await given({ owner: "user-2" });
    expect((await patch(theirs.id, { status: "cancelled" }, TOKEN_1)).statusCode).toBe(404);
    expect((await patch("no-such-alert", { status: "cancelled" })).statusCode).toBe(404);
    expect((await read(theirs.id, TOKEN_2)).json().status).toBe("active");
  });
});

describe("the body of a PATCH: exactly one of the two changes", () => {
  it.each([
    ["an empty body", {}],
    ["both changes", { targetAmount: "70.00", status: "cancelled" }],
    ["a state that is not cancelled: active", { status: "active" }],
    ["a state that is not cancelled: triggered", { status: "triggered" }],
    ["a number instead of text", { targetAmount: 70 }],
    ["an unknown field", { targetAmount: "70.00", owner: "user-2" }],
    ["an unknown field alone", { nonsense: true }],
  ])("answers 400 BAD_REQUEST to %s", async (_name, payload) => {
    const alert = await given({ target: "80.00" });
    const response = await patch(alert.id, payload);
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("BAD_REQUEST");
    expect((await read(alert.id)).json()).toMatchObject({ targetAmount: "80.00", status: "active" });
  });

  it("answers 400 to a body that is not JSON", async () => {
    const alert = await given();
    const response = await app.inject({
      method: "PATCH",
      url: `/price-alerts/${alert.id}`,
      headers: { ...auth(TOKEN_1), "content-type": "application/json" },
      payload: "{not json",
    });
    expect(response.statusCode).toBe(400);
  });
});

describe("when the alert changes while the request is applied (SC-20, BR-08)", () => {
  /** An Evaluation Triggers the alert between the moment the request reads it and the moment it saves it. */
  class TriggeredBeforeSave extends InMemoryPriceAlertRepository {
    override async save(alert: PriceAlert, expectedStatus: AlertStatus): Promise<void> {
      const stored = this.all().find((a) => a.id === alert.id) as PriceAlert;
      await super.save(stored.trigger(), AlertStatus.Active);
      return super.save(alert, expectedStatus);
    }
  }

  it.each([
    ["cancelling", { status: "cancelled" }],
    ["modifying the Target Price", { targetAmount: "70.00" }],
  ])("SC-20 / BR-08: %s answers 409 ALERT_CONFLICT, and the alert stays Triggered", async (_name, payload) => {
    await app.close();
    const racing = new TriggeredBeforeSave();
    start(racing);
    const alert = anAlert({ owner: "user-1", listing: HEADPHONES, target: "80.00" });
    await racing.add(alert);

    const response = await patch(alert.id, payload);

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("ALERT_CONFLICT");
    expect(racing.all()[0]?.status).toBe(AlertStatus.Triggered);
    expect(racing.all()[0]?.targetPrice.toDecimalString()).toBe("80.00");
  });
});

describe("what creating an alert shows (SC-22, BR-09)", () => {
  it("the alert that was created shows when, and the list has it", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/listings/${HEADPHONES}/price-alerts`,
      headers: auth(TOKEN_1),
      payload: { targetAmount: "80.00" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().createdAt).toBe("2026-11-19T10:00:00.000Z");
    expect((await list()).json().items[0]).toMatchObject({ id: created.json().id, createdAt: "2026-11-19T10:00:00.000Z" });
  });
});
