/**
 * Reading the Notifications over HTTP: the route, its answers and its validation. The rules are
 * tested in the use case. Here: that the answer is the one it should be, that a request that is
 * not authenticated learns nothing, and that what is not valid is rejected.
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
import { AlertId, UserId } from "../../../src/price-alerts/domain";
import { InMemoryAuthenticator } from "../../../src/price-alerts/http";
import { FIXED_CLOCK } from "../../support/created-at";
import { aNotification, type NotificationSpec } from "../../support/notifications";

const TOKEN_1 = "token-1";
const TOKEN_2 = "token-2";

let app: FastifyInstance;
let notifications: InMemoryNotificationRepository;

beforeEach(() => {
  notifications = new InMemoryNotificationRepository();
  const alerts = new InMemoryPriceAlertRepository();
  const listings = new InMemoryListingReader();
  const authenticator = new InMemoryAuthenticator();
  authenticator.addUser(TOKEN_1, UserId("user-1"));
  authenticator.addUser(TOKEN_2, UserId("user-2"));
  app = buildApp({
    createPriceAlert: new CreatePriceAlert(listings, alerts, FIXED_CLOCK),
    authenticator,
    priceAlertManagement: {
      listPriceAlerts: new ListPriceAlerts(alerts),
      listNotifications: new ListNotifications(notifications),
      getPriceAlert: new GetPriceAlert(alerts),
      modifyTargetPrice: new ModifyTargetPrice(alerts, listings),
      cancelPriceAlert: new CancelPriceAlert(alerts),
    },
  });
});

afterEach(async () => {
  await app.close();
});

const list = (query = "", token: string | null = TOKEN_1) =>
  app.inject({ method: "GET", url: `/notifications${query}`, headers: token === null ? {} : { authorization: `Bearer ${token}` } });

const add = async (...specs: NotificationSpec[]) => {
  for (const spec of specs) await notifications.add(aNotification(spec));
};

describe("authentication (BR-01, SC-07)", () => {
  it("SC-07: without a token it answers 401 UNAUTHENTICATED", async () => {
    const response = await list("", null);
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHENTICATED");
  });

  it("SC-07: with a token that is not valid it answers 401", async () => {
    expect((await list("", "not-a-token")).statusCode).toBe(401);
  });

  it("a request that is not authenticated learns nothing about what a valid one looks like", async () => {
    expect((await list("?limit=abc&foo=1", null)).statusCode).toBe(401);
  });
});

describe("listing the Notifications", () => {
  it("SC-01 / BR-02 / BR-03: answers 200 with a page, newest first, with what each one states", async () => {
    await add(
      { alertId: AlertId("older"), listing: "headphones-shop-a", target: "80.00", price: "79.90", observedAt: "2026-11-19T10:00:00Z" },
      { alertId: AlertId("newer"), listing: "keyboard-shop-b", target: "50.00", price: "45.00", observedAt: "2026-11-19T12:00:00Z" },
    );

    const response = await list();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 2, limit: 20, offset: 0 });
    expect(response.json().items.map((n: { alertId: string }) => n.alertId)).toEqual(["newer", "older"]);
    expect(response.json().items[0]).toEqual({
      alertId: "newer",
      owner: "user-1",
      listingId: "keyboard-shop-b",
      targetPrice: { amount: "50.00", currency: "EUR" },
      currentPrice: { amount: "45.00", currency: "EUR" },
      observedAt: "2026-11-19T12:00:00.000Z",
    });
  });

  it("SC-03 / BR-01: lists only the Notifications of the authenticated User", async () => {
    await add({ alertId: AlertId("mine"), owner: "user-1" }, { alertId: AlertId("theirs"), owner: "user-2" });
    expect((await list("", TOKEN_1)).json().items.map((n: { alertId: string }) => n.alertId)).toEqual(["mine"]);
    expect((await list("", TOKEN_2)).json().items.map((n: { alertId: string }) => n.alertId)).toEqual(["theirs"]);
  });

  it("SC-04 / BR-02: a User without Notifications gets 200 and an empty list", async () => {
    const response = await list();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it("SC-06 / BR-08: the pages follow limit and offset, written as numbers in the URL", async () => {
    for (let hour = 1; hour <= 5; hour++) await add({ alertId: AlertId(`n-${hour}`), observedAt: `2026-11-19T0${hour}:00:00Z` });

    const body = (await list("?limit=2&offset=2")).json();

    expect(body.items.map((n: { alertId: string }) => n.alertId)).toEqual(["n-3", "n-2"]);
    expect(body).toMatchObject({ total: 5, limit: 2, offset: 2 });
  });

  it("accepts the largest limit", async () => {
    expect((await list("?limit=100")).statusCode).toBe(200);
  });

  it.each([["limit=0"], ["limit=101"], ["limit=-1"], ["limit=abc"], ["limit=1.5"], ["limit="], ["offset=-1"], ["offset=abc"], ["foo=1"]])(
    "SC-20 / BR-08: answers 400 BAD_REQUEST to ?%s",
    async (query) => {
      const response = await list(`?${query}`);
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe("BAD_REQUEST");
    },
  );

  it("SC-09 / BR-09: reading changes nothing", async () => {
    await add({ alertId: AlertId("n-1") });
    await list();
    await list("?limit=1");
    expect(notifications.all()).toHaveLength(1);
  });
});
