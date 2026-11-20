/**
 * The Composition Root wires reading and managing Price Alerts with the rest. These tests follow
 * an alert through HTTP from creating it to cancelling it, and through the Evaluation that
 * a recorded price starts. The rules are tested in the use cases.
 *
 * The clock is fixed at 2026-11-19T12:00:00Z so that the observations can be dated.
 */

import { afterEach, describe, expect, it } from "vitest";
import { composeInMemoryApp } from "../src/composition-root";
import type { EvaluationReport } from "../src/evaluation-trigger";
import { AlertStatus } from "../src/price-alerts/domain";
import { ProviderId } from "../src/price-observations/domain";
import { ListingId } from "../src/shared/domain";
import { FAST_HASHER, signedInUser } from "./support/accounts";

const HEADPHONES = ListingId("headphones-shop-a");
let TOKEN_1 = ""; // the token of a User who signed in, set by compose()
let TOKEN_2 = ""; // the token of a User who signed in, set by compose()
const PROVIDER_TOKEN = "provider-token";
const NOW = new Date("2026-11-19T12:00:00Z");

let application: ReturnType<typeof composeInMemoryApp>;
let reports: EvaluationReport[];

afterEach(async () => {
  await application.app.close();
});

async function compose() {
  reports = [];
  application = composeInMemoryApp({ clock: { now: () => NOW }, passwordHasher: FAST_HASHER, onEvaluation: (report) => reports.push(report) });
  TOKEN_1 = (await signedInUser(application, "user1@example.com")).token;
  TOKEN_2 = (await signedInUser(application, "user2@example.com")).token;
  application.providerAuthenticator.addProvider(PROVIDER_TOKEN, ProviderId("simulator"));
  application.catalogue.addListing(HEADPHONES, "EUR");
  return application;
}

const inject = (method: "GET" | "POST" | "PATCH", url: string, token: string, payload?: object) =>
  application.app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload ? { payload } : {}) });

const observe = (hour: string, amount: string | null) =>
  inject("POST", `/listings/${HEADPHONES}/price-observations`, PROVIDER_TOKEN, {
    observedAt: `2026-11-19T${hour}:00:00Z`,
    price: amount === null ? null : { amount, currency: "EUR" },
  });

const create = (target: string, token = TOKEN_1) => inject("POST", `/listings/${HEADPHONES}/price-alerts`, token, { targetAmount: target });
const list = (query = "", token = TOKEN_1) => inject("GET", `/price-alerts${query}`, token);
const read = (id: string, token = TOKEN_1) => inject("GET", `/price-alerts/${id}`, token);
const patch = (id: string, payload: object, token = TOKEN_1) => inject("PATCH", `/price-alerts/${id}`, token, payload);

describe("composeInMemoryApp: reading and managing Price Alerts", () => {
  it("an alert that was created is in the list and can be read, with the creation moment of the clock", async () => {
    await compose();
    await observe("10", "100.00");
    const created = (await create("80.00")).json();

    const listed = (await list()).json();
    const one = await read(created.id);

    expect(listed.items).toEqual([created]);
    expect(one.json()).toEqual(created);
    expect(created.createdAt).toBe("2026-11-19T12:00:00.000Z");
  });

  it("SC-03 / BR-01: a User cannot see or change the alert of another User", async () => {
    await compose();
    await observe("10", "100.00");
    const mine = (await create("80.00", TOKEN_1)).json();

    expect((await list("", TOKEN_2)).json().items).toEqual([]);
    expect((await read(mine.id, TOKEN_2)).statusCode).toBe(404);
    expect((await patch(mine.id, { status: "cancelled" }, TOKEN_2)).statusCode).toBe(404);
    expect((await read(mine.id, TOKEN_1)).json().status).toBe("active");
  });

  it("SC-14: modifying the Target Price is read back, and the Listing's Current Price is the one of its observations", async () => {
    await compose();
    await observe("10", "100.00");
    const created = (await create("80.00")).json();

    expect((await patch(created.id, { targetAmount: "70.00" })).json().targetAmount).toBe("70.00");
    expect((await read(created.id)).json().targetAmount).toBe("70.00");
    // 100.00 is the Current Price, so a Target Price of 100.00 is already reached.
    expect((await patch(created.id, { targetAmount: "100.00" })).json().code).toBe("TARGET_ALREADY_REACHED");
  });

  it("SC-09 / BR-03: a Cancelled alert is not evaluated: a price that reaches its target triggers nothing", async () => {
    await compose();
    await observe("10", "100.00");
    const created = (await create("80.00")).json();
    expect((await patch(created.id, { status: "cancelled" })).json().status).toBe("cancelled");
    reports.length = 0;

    await observe("11", "75.00");

    expect((await read(created.id)).json().status).toBe("cancelled");
    expect(application.notifications.all()).toEqual([]);
    const last = reports.at(-1);
    expect(last && "result" in last && last.result).toEqual({ triggered: [], failed: [] });
  });

  it("SC-12 / BR-04: an alert that the Evaluation Triggered cannot be cancelled", async () => {
    await compose();
    await observe("10", "100.00");
    const created = (await create("80.00")).json();
    await observe("11", "75.00");
    expect((await read(created.id)).json().status).toBe("triggered");

    const response = await patch(created.id, { status: "cancelled" });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("ALERT_NOT_ACTIVE");
    expect(application.alerts.all()[0]?.status).toBe(AlertStatus.Triggered);
  });

  it("SC-10 / BR-03: after cancelling, the User can create another alert for the same Listing", async () => {
    await compose();
    await observe("10", "100.00");
    const first = (await create("80.00")).json();
    await patch(first.id, { status: "cancelled" });

    const second = await create("70.00");

    expect(second.statusCode).toBe(201);
    expect((await list()).json().total).toBe(2);
    expect((await list("?status=active")).json().total).toBe(1);
  });

  it("the Evaluation uses the Target Price that was modified, not the old one", async () => {
    await compose();
    await observe("10", "100.00");
    const created = (await create("80.00")).json();
    await patch(created.id, { targetAmount: "60.00" });

    await observe("11", "70.00"); // reaches 80.00, but not 60.00
    expect((await read(created.id)).json().status).toBe("active");

    await observe("12", "55.00"); // reaches 60.00
    expect((await read(created.id)).json().status).toBe("triggered");
    expect(application.notifications.all()).toHaveLength(1);
  });

  it("SC-13 / BR-07: cancelling or modifying starts no Evaluation and produces no Notification", async () => {
    await compose();
    await observe("10", "100.00");
    const created = (await create("80.00")).json();
    const other = (await create("85.00", TOKEN_2)).json();
    reports.length = 0;

    await patch(created.id, { targetAmount: "70.00" });
    await patch(other.id, { status: "cancelled" }, TOKEN_2);

    expect(reports).toEqual([]);
    expect(application.notifications.all()).toEqual([]);
  });

  it("SC-07: every route needs a token", async () => {
    await compose();
    for (const [method, url] of [["GET", "/price-alerts"], ["GET", "/price-alerts/x"], ["PATCH", "/price-alerts/x"]] as const) {
      const response = await application.app.inject({ method, url });
      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it("the token of a price provider does not open the routes of the Users", async () => {
    await compose();
    expect((await list("", PROVIDER_TOKEN)).statusCode).toBe(401);
  });
});
