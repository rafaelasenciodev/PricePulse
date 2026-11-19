/**
 * The Composition Root wires the reading of Notifications and of the Price History with the rest.
 * These tests follow what a Provider records and what an Evaluation produces, through HTTP, to
 * what a User reads. The rules are tested in the use cases.
 *
 * The clock is fixed at 2026-11-19T12:00:00Z so that the observations can be dated.
 */

import { afterEach, describe, expect, it } from "vitest";
import { composeInMemoryApp } from "../src/composition-root";
import type { EvaluationReport } from "../src/evaluation-trigger";
import { ProviderId } from "../src/price-observations/domain";
import { ListingId, UserId } from "../src/shared/domain";
import { FAST_HASHER, signedInUser } from "./support/accounts";

const HEADPHONES = ListingId("headphones-shop-a");
const KEYBOARD = ListingId("keyboard-shop-b");
let USER_1 = ""; // the token of a User who signed in, set by compose()
let USER_ID_1 = UserId("");
let USER_2 = ""; // the token of a User who signed in, set by compose()
const PROVIDER = "provider-token";
const NOW = new Date("2026-11-19T12:00:00Z");

let application: ReturnType<typeof composeInMemoryApp>;
let reports: EvaluationReport[];

afterEach(async () => {
  await application.app.close();
});

async function compose() {
  reports = [];
  application = composeInMemoryApp({ clock: { now: () => NOW }, passwordHasher: FAST_HASHER, onEvaluation: (report) => reports.push(report) });
  ({ token: USER_1, userId: USER_ID_1 } = await signedInUser(application, "user1@example.com"));
  USER_2 = (await signedInUser(application, "user2@example.com")).token;
  application.providerAuthenticator.addProvider(PROVIDER, ProviderId("simulator"));
  application.catalogue.addListing(HEADPHONES, "EUR");
  application.catalogue.addListing(KEYBOARD, "EUR");
  return application;
}

const inject = (method: "GET" | "POST", url: string, token: string, payload?: object) =>
  application.app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload ? { payload } : {}) });

const observe = (listing: ListingId, hour: string, amount: string | null, token = PROVIDER) =>
  inject("POST", `/listings/${listing}/price-observations`, token, {
    observedAt: `2026-11-19T${hour}:00:00Z`,
    price: amount === null ? null : { amount, currency: "EUR" },
  });

const history = (listing: ListingId, query = "", token = USER_1) => inject("GET", `/listings/${listing}/price-observations${query}`, token);
const notificationsOf = (token = USER_1, query = "") => inject("GET", `/notifications${query}`, token);
const create = (listing: ListingId, target: string, token = USER_1) => inject("POST", `/listings/${listing}/price-alerts`, token, { targetAmount: target });

describe("composeInMemoryApp: the Price History", () => {
  it("SC-10: what a Provider records is what a User reads, newest first, with the Provider that reported it", async () => {
    await compose();
    await observe(HEADPHONES, "10", "100.00");
    await observe(HEADPHONES, "11", "90.00");

    const response = await history(HEADPHONES);

    expect(response.statusCode).toBe(200);
    expect(response.json().items.map((o: { observedAt: string; price: { amount: string } }) => [o.observedAt.slice(11, 16), o.price.amount])).toEqual([
      ["11:00", "90.00"],
      ["10:00", "100.00"],
    ]);
    expect(response.json().items[0].provider).toBe("simulator");
  });

  it("SC-11: a moment when the Provider reported the Listing as unavailable is in the history", async () => {
    await compose();
    await observe(HEADPHONES, "10", "100.00");
    await observe(HEADPHONES, "11", null);
    expect((await history(HEADPHONES)).json().items[0].price).toBeNull();
  });

  it("SC-12: an observation recorded late is in its place by Observed At", async () => {
    await compose();
    await observe(HEADPHONES, "11", "90.00");
    await observe(HEADPHONES, "10", "100.00");
    expect((await history(HEADPHONES)).json().items.map((o: { observedAt: string }) => o.observedAt.slice(11, 16))).toEqual(["11:00", "10:00"]);
  });

  it("SC-16: a range limits what is read, with the start included and the end excluded", async () => {
    await compose();
    for (const hour of ["10", "11"]) await observe(HEADPHONES, hour, "100.00");
    const response = await history(HEADPHONES, "?from=2026-11-19T10:00:00Z&to=2026-11-19T11:00:00Z");
    expect(response.json().total).toBe(1);
  });

  it("SC-08 / BR-04: the credential of a Provider does not open the history, and the one of a User does not record prices", async () => {
    await compose();
    expect((await history(HEADPHONES, "", PROVIDER)).statusCode).toBe(401);
    expect((await observe(HEADPHONES, "10", "100.00", USER_1)).statusCode).toBe(401);
  });

  it("SC-07: without a token the history is not served", async () => {
    await compose();
    expect((await application.app.inject({ method: "GET", url: `/listings/${HEADPHONES}/price-observations` })).statusCode).toBe(401);
  });

  it("SC-15: a Listing that is not in the catalogue is not found", async () => {
    await compose();
    expect((await history(ListingId("no-such-listing"))).statusCode).toBe(404);
  });

  it("the same path answers each method with its own credential: the history is not hidden by the recording, nor the other way round", async () => {
    await compose();
    expect((await observe(HEADPHONES, "10", "100.00")).statusCode).toBe(201);
    expect((await history(HEADPHONES)).statusCode).toBe(200);
  });
});

describe("composeInMemoryApp: the Notifications", () => {
  it("SC-01 / BR-03: the Notification that an Evaluation produced is what the owner reads", async () => {
    await compose();
    await observe(HEADPHONES, "10", "100.00");
    const alert = (await create(HEADPHONES, "80.00")).json();

    await observe(HEADPHONES, "11", "79.90");

    const response = await notificationsOf();
    expect(response.statusCode).toBe(200);
    expect(response.json().total).toBe(1);
    expect(response.json().items[0]).toEqual({
      alertId: alert.id,
      owner: USER_ID_1,
      listingId: HEADPHONES,
      targetPrice: { amount: "80.00", currency: "EUR" },
      currentPrice: { amount: "79.90", currency: "EUR" },
      observedAt: "2026-11-19T11:00:00.000Z",
    });
  });

  it("SC-03 / BR-01: another User does not see it", async () => {
    await compose();
    await observe(HEADPHONES, "10", "100.00");
    await create(HEADPHONES, "80.00", USER_1);
    await observe(HEADPHONES, "11", "79.90");

    expect((await notificationsOf(USER_1)).json().total).toBe(1);
    expect((await notificationsOf(USER_2)).json()).toEqual({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it("SC-01 / BR-02: several Notifications come newest first by the Observed At of the price that reached the target", async () => {
    await compose();
    await observe(HEADPHONES, "10", "100.00");
    await observe(KEYBOARD, "10", "60.00");
    const first = (await create(HEADPHONES, "80.00")).json();
    const second = (await create(KEYBOARD, "50.00")).json();

    await observe(KEYBOARD, "11", "45.00"); // reaches the second alert
    await observe(HEADPHONES, "12", "75.00"); // reaches the first, later

    const items = (await notificationsOf()).json().items as { alertId: string }[];
    expect(items.map((n) => n.alertId)).toEqual([first.id, second.id]);
  });

  it("SC-04: a User whose alerts were not reached has no Notifications", async () => {
    await compose();
    await observe(HEADPHONES, "10", "100.00");
    await create(HEADPHONES, "80.00");
    await observe(HEADPHONES, "11", "90.00");
    expect((await notificationsOf()).json().total).toBe(0);
  });

  it("SC-08 / BR-01: the credential of a Provider does not open the Notifications", async () => {
    await compose();
    expect((await notificationsOf(PROVIDER)).statusCode).toBe(401);
  });

  it("SC-06: the Notifications are read in pages", async () => {
    await compose();
    await observe(HEADPHONES, "10", "100.00");
    await observe(KEYBOARD, "10", "60.00");
    await create(HEADPHONES, "80.00");
    await create(KEYBOARD, "50.00");
    await observe(HEADPHONES, "11", "75.00");
    await observe(KEYBOARD, "12", "45.00");

    const body = (await notificationsOf(USER_1, "?limit=1&offset=1")).json();

    expect(body).toMatchObject({ total: 2, limit: 1, offset: 1 });
    expect(body.items).toHaveLength(1);
  });
});

describe("composeInMemoryApp: reading changes nothing (BR-09)", () => {
  it("SC-09: reading the Notifications and the history starts no Evaluation and changes no alert or observation", async () => {
    await compose();
    await observe(HEADPHONES, "10", "100.00");
    await create(HEADPHONES, "80.00");
    await observe(HEADPHONES, "11", "79.90");
    reports.length = 0;
    const before = { alerts: application.alerts.all().map((a) => a.status), notifications: application.notifications.all().length };

    await notificationsOf();
    await history(HEADPHONES);
    await history(HEADPHONES, "?from=2026-11-19T10:00:00Z");

    expect(reports).toEqual([]);
    expect(application.alerts.all().map((a) => a.status)).toEqual(before.alerts);
    expect(application.notifications.all()).toHaveLength(before.notifications);
    expect((await history(HEADPHONES)).json().total).toBe(2);
  });
});
