/**
 * The Composition Root starts the Evaluation of feature 03 when a price is recorded. These
 * tests check that wiring through HTTP, not the rules of the Evaluation (they are tested in its
 * use case): when the Evaluation runs and what it reads. The policy itself, and what it writes
 * to the log, is tested in `evaluation-trigger.test.ts`.
 *
 * The clock is fixed at 2026-11-19T12:00:00Z so that the observations can be dated.
 */

import { afterEach, describe, expect, it } from "vitest";
import { composeInMemoryApp } from "../src/composition-root";
import type { EvaluationReport } from "../src/evaluation-trigger";
import { AlertStatus, UserId } from "../src/price-alerts/domain";
import { ProviderId } from "../src/price-observations/domain";
import { ListingId } from "../src/shared/domain";

const HEADPHONES = ListingId("headphones-shop-a");
const KEYBOARD = ListingId("keyboard-shop-b");
const USER_TOKEN = "token-1";
const PROVIDER_TOKEN = "provider-token";
const NOW = new Date("2026-11-19T12:00:00Z");

let application: ReturnType<typeof composeInMemoryApp>;
let reports: EvaluationReport[];

afterEach(async () => {
  await application.app.close();
});

function compose() {
  reports = [];
  application = composeInMemoryApp({ clock: { now: () => NOW }, onEvaluation: (report) => reports.push(report) });
  application.authenticator.addUser(USER_TOKEN, UserId("user-1"));
  application.providerAuthenticator.addProvider(PROVIDER_TOKEN, ProviderId("simulator"));
  application.catalogue.addListing(HEADPHONES, "EUR");
  application.catalogue.addListing(KEYBOARD, "EUR");
  return application;
}

const observe = (hour: string, amount: string | null, listing: string = HEADPHONES, currency = "EUR") =>
  application.app.inject({
    method: "POST",
    url: `/listings/${listing}/price-observations`,
    headers: { authorization: `Bearer ${PROVIDER_TOKEN}` },
    payload: { observedAt: `2026-11-19T${hour}:00:00Z`, price: amount === null ? null : { amount, currency } },
  });

const create = (targetAmount: string, listing: string = HEADPHONES) =>
  application.app.inject({
    method: "POST",
    url: `/listings/${listing}/price-alerts`,
    headers: { authorization: `Bearer ${USER_TOKEN}` },
    payload: { targetAmount },
  });

const statuses = () => application.alerts.all().map((a) => a.status);

describe("composeInMemoryApp: recording a price evaluates the Price Alerts of its Listing", () => {
  it("SC-01 / BR-02 / BR-04: a price that reaches the target Triggers the alert and produces a Notification", async () => {
    compose();
    await observe("10", "100.00");
    expect((await create("80.00")).statusCode).toBe(201);

    const response = await observe("11", "79.90");

    expect(response.statusCode).toBe(201);
    expect(statuses()).toEqual([AlertStatus.Triggered]);
    const [notification] = application.notifications.all();
    expect(application.notifications.all()).toHaveLength(1);
    expect(notification?.owner).toBe("user-1");
    expect(notification?.currentPrice.toDecimalString()).toBe("79.90");
    expect(notification?.observedAt.toIsoString()).toBe("2026-11-19T11:00:00.000Z");
  });

  it("SC-03 / BR-02: a price that does not reach the target leaves the alert Active", async () => {
    compose();
    await observe("10", "100.00");
    await create("80.00");
    await observe("11", "90.00");
    expect(statuses()).toEqual([AlertStatus.Active]);
    expect(application.notifications.all()).toEqual([]);
  });

  it("SC-05 / BR-03: an observation without a Price triggers nothing", async () => {
    compose();
    await observe("10", "100.00");
    await create("80.00");
    await observe("11", null);
    expect(statuses()).toEqual([AlertStatus.Active]);
  });

  it("SC-10 / BR-01: recording the price of another Listing evaluates that Listing and not this one", async () => {
    compose();
    await observe("10", "100.00");
    await create("80.00");
    reports.length = 0;
    await observe("11", "10.00", KEYBOARD);
    expect(statuses()).toEqual([AlertStatus.Active]);
    expect(reports.map((r) => r.listingId)).toEqual([KEYBOARD]);
  });

  it("SC-12 / BR-07: a repeated recording (200) evaluates again and produces nothing new", async () => {
    compose();
    await observe("10", "100.00");
    await create("80.00");
    await observe("11", "79.90");

    const repeated = await observe("11", "79.90");

    expect(repeated.statusCode).toBe(200);
    expect(application.notifications.all()).toHaveLength(1);
    expect(reports).toHaveLength(3); // the first price, the new one and the repeated one
    const last = reports.at(-1);
    expect(last && "result" in last && last.result).toEqual({ triggered: [], failed: [] });
  });

  it("a recording that fails evaluates nothing", async () => {
    compose();
    await observe("10", "100.00");
    await create("80.00");
    reports.length = 0;

    const rejected = await observe("11", "79.90", HEADPHONES, "USD");

    expect(rejected.statusCode).toBe(422);
    expect(reports).toEqual([]);
    expect(statuses()).toEqual([AlertStatus.Active]);
  });

  it("the report says which Price Alerts were Triggered by the recording", async () => {
    compose();
    await observe("10", "100.00");
    await create("80.00");
    await observe("11", "75.00");
    const last = reports.at(-1);
    expect(last && "result" in last && last.result.triggered.map((t) => t.produced)).toEqual([true]);
  });

  it("BR-11 of feature 01: a Triggered alert does not block a new one for the same Listing", async () => {
    compose();
    await observe("10", "100.00");
    await create("80.00");
    await observe("11", "79.90");
    expect(statuses()).toEqual([AlertStatus.Triggered]);

    const again = await create("70.00");

    expect(again.statusCode).toBe(201);
    expect(statuses()).toEqual([AlertStatus.Triggered, AlertStatus.Active]);
  });

  it("BR-11 of feature 02: the use case of recording does not evaluate; the Composition Root does", async () => {
    compose();
    await observe("10", "100.00");
    await create("80.00");
    reports.length = 0;

    await application.recordPriceObservation.execute({
      provider: ProviderId("simulator"),
      listingId: HEADPHONES,
      observedAt: "2026-11-19T11:00:00Z",
      price: { amount: "75.00", currency: "EUR" },
    });

    expect(statuses()).toEqual([AlertStatus.Active]);
    expect(reports).toEqual([]);
  });
});
