/**
 * The policy that starts the Evaluation of the Price Alerts when a price is recorded: when it
 * runs, that it never changes the answer to the Provider, and what it writes to the log.
 * The wiring through HTTP is tested in `composition-root-evaluation.test.ts`.
 */

import type { FastifyBaseLogger } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { logEvaluation, withEvaluation } from "../src/evaluation-trigger";
import { ProviderId } from "../src/price-observations/domain";
import { ListingId } from "../src/shared/domain";

const HEADPHONES = ListingId("headphones-shop-a");

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
