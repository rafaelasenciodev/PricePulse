/**
 * The Composition Root starts the Evaluation of feature 03 when a price is recorded. These
 * tests check that wiring, not the rules of the Evaluation (they are tested in its use case):
 * when the Evaluation runs, what it reads, and that it never changes the answer to the Provider.
 *
 * The clock is fixed at 2026-11-19T12:00:00Z so that the observations can be dated.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyBaseLogger } from "fastify";
import { composeInMemoryApp, logEvaluation, withEvaluation, type EvaluationReport } from "../src/composition-root";
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

describe("withEvaluation", () => {
  const command = {
    provider: ProviderId("simulator"),
    listingId: HEADPHONES,
    observedAt: "2026-11-19T11:00:00Z",
    price: null,
  };
  const outcome = {
    observation: { provider: "simulator", listingId: HEADPHONES, observedAt: "2026-11-19T11:00:00.000Z", price: null },
    recorded: true,
  };
  const empty = { triggered: [], failed: [] };

  it("evaluates the Listing of the command after a recording, and returns the result of the recording unchanged", async () => {
    const recorder = { execute: vi.fn(async () => outcome) };
    const evaluator = { execute: vi.fn(async () => empty) };
    const report = vi.fn();

    const result = await withEvaluation(recorder, evaluator, report).execute(command);

    expect(result).toBe(outcome);
    expect(evaluator.execute).toHaveBeenCalledWith({ listingId: HEADPHONES });
    expect(report).toHaveBeenCalledWith({ listingId: HEADPHONES, result: empty });
  });

  it("evaluates after a repeated recording too, which is how a failed Evaluation is finished", async () => {
    const recorder = { execute: vi.fn(async () => ({ ...outcome, recorded: false })) };
    const evaluator = { execute: vi.fn(async () => empty) };

    await withEvaluation(recorder, evaluator, vi.fn()).execute(command);

    expect(evaluator.execute).toHaveBeenCalledTimes(1);
  });

  it("evaluates nothing, and reports nothing, if the recording fails: its error goes on", async () => {
    const recorder = { execute: vi.fn(async () => Promise.reject(new Error("not valid"))) };
    const evaluator = { execute: vi.fn(async () => empty) };
    const report = vi.fn();

    await expect(withEvaluation(recorder, evaluator, report).execute(command)).rejects.toThrow("not valid");

    expect(evaluator.execute).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it("a failed Evaluation does not change the response of the recording: its error is reported", async () => {
    const failure = new Error("the store is down");
    const recorder = { execute: vi.fn(async () => outcome) };
    const evaluator = { execute: vi.fn(async () => Promise.reject(failure)) };
    const report = vi.fn();

    const result = await withEvaluation(recorder, evaluator, report).execute(command);

    expect(result).toBe(outcome);
    expect(report).toHaveBeenCalledWith({ listingId: HEADPHONES, error: failure });
  });

  it("a failure of the report does not change the response of the recording either", async () => {
    const recorder = { execute: vi.fn(async () => outcome) };
    const evaluator = { execute: vi.fn(async () => empty) };
    const report = vi.fn(() => {
      throw new Error("the log is closed");
    });

    await expect(withEvaluation(recorder, evaluator, report).execute(command)).resolves.toBe(outcome);
  });
});

describe("logEvaluation: what the development server writes", () => {
  const view = {
    alertId: "alert-1",
    owner: "demo-user-1",
    listingId: HEADPHONES,
    targetPrice: { amount: "80.00", currency: "EUR" },
    currentPrice: { amount: "79.90", currency: "EUR" },
    observedAt: "2026-11-19T11:00:00.000Z",
  };
  const logger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });
  const log = (fake: ReturnType<typeof logger>) => logEvaluation(fake as unknown as FastifyBaseLogger);

  it("Q6: a Notification that was produced is a line at the level of information, with what it states", () => {
    const fake = logger();
    log(fake)({ listingId: HEADPHONES, result: { triggered: [{ notification: view, produced: true }], failed: [] } });
    expect(fake.info).toHaveBeenCalledTimes(1);
    const [fields, message] = fake.info.mock.calls[0] ?? [];
    expect(fields).toMatchObject({ alertId: "alert-1", owner: "demo-user-1", currentPrice: view.currentPrice, produced: true });
    expect(message).toMatch(/Notification was produced/);
    expect(fake.warn).not.toHaveBeenCalled();
    expect(fake.error).not.toHaveBeenCalled();
  });

  it("an alert that was completed from a Notification that already existed says so", () => {
    const fake = logger();
    log(fake)({ listingId: HEADPHONES, result: { triggered: [{ notification: view, produced: false }], failed: [] } });
    const [fields, message] = fake.info.mock.calls[0] ?? [];
    expect(fields).toMatchObject({ produced: false });
    expect(message).toMatch(/already existed/);
  });

  it("an alert that could not be evaluated is a warning with its identifier and its error", () => {
    const fake = logger();
    const error = new Error("this one fails");
    log(fake)({ listingId: HEADPHONES, result: { triggered: [], failed: [{ alertId: "alert-2", error }] } });
    expect(fake.warn).toHaveBeenCalledTimes(1);
    expect(fake.warn.mock.calls[0]?.[0]).toMatchObject({ alertId: "alert-2", listingId: HEADPHONES, err: error });
    expect(fake.info).not.toHaveBeenCalled();
  });

  it("an Evaluation that failed as a whole is an error of the log, with the Listing", () => {
    const fake = logger();
    const error = new Error("the prices are not available");
    log(fake)({ listingId: HEADPHONES, error });
    expect(fake.error).toHaveBeenCalledTimes(1);
    expect(fake.error.mock.calls[0]?.[0]).toMatchObject({ err: error, listingId: HEADPHONES });
  });

  it("an Evaluation with nothing to say writes nothing", () => {
    const fake = logger();
    log(fake)({ listingId: HEADPHONES, result: { triggered: [], failed: [] } });
    expect(fake.info).not.toHaveBeenCalled();
    expect(fake.warn).not.toHaveBeenCalled();
    expect(fake.error).not.toHaveBeenCalled();
  });
});
