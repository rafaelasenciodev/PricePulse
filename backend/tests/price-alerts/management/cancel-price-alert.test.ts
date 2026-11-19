import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryListingReader, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import {
  AlertConflict,
  AlertNotActive,
  AlertNotFound,
  ApplicationError,
  CancelPriceAlert,
  CreatePriceAlert,
  ListPriceAlerts,
  type PriceAlertRepository,
} from "../../../src/price-alerts/application";
import { AlertId, AlertStatus, PriceAlert, UserId } from "../../../src/price-alerts/domain";
import { ListingId, Price } from "../../../src/shared/domain";
import { anAlert } from "../../support/alerts";
import { FIXED_CLOCK } from "../../support/created-at";

const USER = UserId("user-1");
const LISTING = ListingId("headphones-shop-a");

let alerts: InMemoryPriceAlertRepository;

const cancel = (alertId: AlertId, owner: UserId = USER, repository: PriceAlertRepository = alerts) =>
  new CancelPriceAlert(repository).execute({ owner, alertId });

const stored = (alert: PriceAlert) => alerts.all().find((a) => a.id === alert.id) as PriceAlert;

beforeEach(() => {
  alerts = new InMemoryPriceAlertRepository();
});

describe("cancelling a Price Alert", () => {
  it("SC-08 / BR-03: an Active alert becomes Cancelled", async () => {
    const alert = anAlert({ owner: "user-1", listing: LISTING });
    await alerts.add(alert);

    const result = await cancel(alert.id);

    expect(result.changed).toBe(true);
    expect(result.alert.status).toBe("cancelled");
    expect(stored(alert).status).toBe(AlertStatus.Cancelled);
  });

  it("SC-08 / BR-03: it keeps its data, and it is still in the list of the User", async () => {
    const alert = anAlert({ owner: "user-1", listing: LISTING, target: "80.00", createdAt: "2026-11-19T10:00:00Z" });
    await alerts.add(alert);

    await cancel(alert.id);

    const listed = await new ListPriceAlerts(alerts).execute({ owner: USER, limit: 20, offset: 0 });
    expect(listed.items).toEqual([
      expect.objectContaining({ id: alert.id, status: "cancelled", targetAmount: "80.00", createdAt: "2026-11-19T10:00:00.000Z" }),
    ]);
  });

  it("cancels the one that was asked for, and no other of the same User", async () => {
    const first = anAlert({ owner: "user-1", listing: "l-1" });
    const second = anAlert({ owner: "user-1", listing: "l-2" });
    await alerts.add(first);
    await alerts.add(second);

    await cancel(second.id);

    expect(stored(first).status).toBe(AlertStatus.Active);
    expect(stored(second).status).toBe(AlertStatus.Cancelled);
  });

  it("SC-10 / BR-03: afterwards the User can create another Active alert for the same Listing", async () => {
    const listings = new InMemoryListingReader();
    listings.addListing(LISTING, "EUR", Price.fromDecimalString("100.00", "EUR"));
    const create = (target: string) =>
      new CreatePriceAlert(listings, alerts, FIXED_CLOCK).execute({ owner: USER, listingId: LISTING, targetAmount: target });
    const first = (await create("80.00")).alert;

    await cancel(AlertId(first.id));
    const second = await create("70.00");

    expect(second.created).toBe(true);
    expect(second.alert.status).toBe("active");
    expect(stored(anAlert({ id: AlertId(first.id) })).status).toBe(AlertStatus.Cancelled);
  });
});

describe("cancelling twice, or an alert that has ended", () => {
  it("SC-11 / BR-04: cancelling a Cancelled alert succeeds and changes nothing", async () => {
    const alert = anAlert({ owner: "user-1", status: AlertStatus.Cancelled });
    await alerts.add(alert);

    const result = await cancel(alert.id);

    expect(result.changed).toBe(false);
    expect(result.alert.status).toBe("cancelled");
  });

  it("SC-11 / BR-04: cancelling an alert twice in a row succeeds both times", async () => {
    const alert = anAlert({ owner: "user-1" });
    await alerts.add(alert);
    expect((await cancel(alert.id)).changed).toBe(true);
    expect((await cancel(alert.id)).changed).toBe(false);
  });

  it("SC-12 / BR-04: a Triggered alert cannot be cancelled, and it stays Triggered", async () => {
    const alert = anAlert({ owner: "user-1", status: AlertStatus.Triggered });
    await alerts.add(alert);

    const outcome = await cancel(alert.id).catch((error: unknown) => error);

    expect(outcome).toBeInstanceOf(AlertNotActive);
    expect((outcome as AlertNotActive).status).toBe(AlertStatus.Triggered);
    expect(stored(alert).status).toBe(AlertStatus.Triggered);
  });
});

describe("whose alert it is (BR-01)", () => {
  it("SC-06: an alert of another User is not found, and it is not cancelled", async () => {
    const theirs = anAlert({ owner: "user-2" });
    await alerts.add(theirs);
    await expect(cancel(theirs.id, USER)).rejects.toThrow(AlertNotFound);
    expect(stored(theirs).status).toBe(AlertStatus.Active);
  });

  it("SC-06: an alert that does not exist is not found", async () => {
    await expect(cancel(AlertId("no-such-alert"))).rejects.toThrow(AlertNotFound);
  });
});

describe("when the alert changes while the User acts (BR-08)", () => {
  /** An Evaluation Triggers the alert between the moment the request reads it and the moment it saves it. */
  class TriggeredBeforeSave extends InMemoryPriceAlertRepository {
    override async save(alert: PriceAlert, expectedStatus: AlertStatus): Promise<void> {
      const storedAlert = this.all().find((a) => a.id === alert.id) as PriceAlert;
      await super.save(storedAlert.trigger(), AlertStatus.Active);
      return super.save(alert, expectedStatus);
    }
  }

  it("SC-20: it is rejected as a Conflict, and the alert stays Triggered", async () => {
    const racing = new TriggeredBeforeSave();
    const alert = anAlert({ owner: "user-1" });
    await racing.add(alert);

    await expect(cancel(alert.id, USER, racing)).rejects.toThrow(AlertConflict);

    expect(racing.all()[0]?.status).toBe(AlertStatus.Triggered);
  });

  it("two cancellations at the same time both succeed", async () => {
    const alert = anAlert({ owner: "user-1" });
    await alerts.add(alert);
    const outcomes = await Promise.allSettled([cancel(alert.id), cancel(alert.id)]);
    expect(outcomes.map((o) => o.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(stored(alert).status).toBe(AlertStatus.Cancelled);
  });
});

describe("a failure that is not about the state of the alert", () => {
  it("a failure of the store is not hidden or turned into a business error", async () => {
    class Down extends InMemoryPriceAlertRepository {
      override async save(): Promise<void> {
        throw new Error("the store is down");
      }
    }
    const down = new Down();
    const alert = anAlert({ owner: "user-1" });
    await down.add(alert);

    const outcome = await cancel(alert.id, USER, down).catch((error: unknown) => error);

    expect((outcome as Error).message).toBe("the store is down");
    expect(outcome).not.toBeInstanceOf(ApplicationError);
  });
});

describe("what the use case does and does not do (BR-07)", () => {
  it("SC-13 / BR-07: only reads the alert and saves it once: it has no way to notify or evaluate", async () => {
    const alert = anAlert({ owner: "user-1" });
    await alerts.add(alert);
    const calls: string[] = [];
    const spy = Object.create(alerts, {
      find: { value: async (...args: Parameters<typeof alerts.find>) => (calls.push("find"), alerts.find(...args)) },
      save: { value: async (...args: Parameters<typeof alerts.save>) => (calls.push("save"), alerts.save(...args)) },
    }) as PriceAlertRepository;

    await cancel(alert.id, USER, spy);

    expect(calls).toEqual(["find", "save"]);
  });
});
