import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { AlertNotFound, GetPriceAlert } from "../../../src/price-alerts/application";
import { AlertId, AlertStatus, UserId } from "../../../src/price-alerts/domain";
import { anAlert } from "../../support/alerts";

const USER = UserId("user-1");

let alerts: InMemoryPriceAlertRepository;

const get = (alertId: AlertId, owner: UserId = USER) => new GetPriceAlert(alerts).execute({ owner, alertId });

beforeEach(() => {
  alerts = new InMemoryPriceAlertRepository();
});

describe("reading one Price Alert", () => {
  it("SC-05 / BR-02: shows its Listing, Target Price with its currency, state and creation moment", async () => {
    const alert = anAlert({ owner: "user-1", listing: "headphones-shop-a", target: "80.00", createdAt: "2026-11-19T10:00:00Z" });
    await alerts.add(alert);

    const result = await get(alert.id);

    expect(result.alert).toEqual({
      id: alert.id,
      listingId: "headphones-shop-a",
      targetAmount: "80.00",
      currency: "EUR",
      status: "active",
      createdAt: "2026-11-19T10:00:00.000Z",
    });
  });

  it.each([[AlertStatus.Active], [AlertStatus.Triggered], [AlertStatus.Cancelled]])(
    "SC-05 / BR-02: an alert in the state %s can be read",
    async (status) => {
      const alert = anAlert({ status });
      await alerts.add(alert);
      expect((await get(alert.id)).alert.status).toBe(status);
    },
  );

  it("reads the one that was asked for, among several of the same User", async () => {
    const first = anAlert({ listing: "l-1", target: "80.00" });
    const second = anAlert({ listing: "l-2", target: "45.50" });
    await alerts.add(first);
    await alerts.add(second);

    expect((await get(second.id)).alert).toMatchObject({ id: second.id, listingId: "l-2", targetAmount: "45.50" });
    expect((await get(first.id)).alert).toMatchObject({ id: first.id, listingId: "l-1" });
  });

  it("SC-06 / BR-01: an alert that does not exist is not found", async () => {
    await expect(get(AlertId("no-such-alert"))).rejects.toThrow(AlertNotFound);
  });

  it("SC-06 / BR-01: an alert of another User is not found either", async () => {
    const alert = anAlert({ owner: "user-2" });
    await alerts.add(alert);
    await expect(get(alert.id, USER)).rejects.toThrow(AlertNotFound);
  });

  it("SC-06 / BR-01: the two cases cannot be told apart, not even by the message", async () => {
    const theirs = anAlert({ owner: "user-2" });
    await alerts.add(theirs);

    const ofAnother = await get(theirs.id, USER).catch((error: unknown) => error);
    const missing = await get(AlertId("no-such-alert"), USER).catch((error: unknown) => error);

    expect(ofAnother).toBeInstanceOf(AlertNotFound);
    expect(missing).toBeInstanceOf(AlertNotFound);
    expect((ofAnother as Error).message).toBe(new AlertNotFound(theirs.id).message);
    expect((missing as Error).message).toBe(new AlertNotFound(AlertId("no-such-alert")).message);
  });
});
