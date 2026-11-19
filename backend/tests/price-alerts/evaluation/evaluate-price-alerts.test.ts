/**
 * UC-01 Evaluate the Price Alerts of a Listing, tested through its use case and without HTTP.
 *
 * The three repositories and the source of prices are the in-memory adapters. The classes
 * written here only add what a test needs on top of them: a way to make them fail, and a
 * record of what was read.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  InMemoryCurrentPriceSource,
  InMemoryNotificationRepository,
  InMemoryPriceAlertRepository,
} from "../../../src/price-alerts/adapters";
import {
  EvaluatePriceAlerts,
  NotificationAlreadyExists,
} from "../../../src/price-alerts/application";
import {
  AlertStatus,
  CurrencyMismatch,
  Notification,
  PriceAlert,
  TargetPrice,
  newAlertId,
  type AlertId,
} from "../../../src/price-alerts/domain";
import { ListingId, ObservedAt, Price, UserId } from "../../../src/shared/domain";
import { CREATED_AT } from "../../support/created-at";

const OWNER = UserId("user-1");
const OTHER_OWNER = UserId("user-2");
const LISTING = ListingId("headphones-shop-a");
const OTHER_LISTING = ListingId("keyboard-shop-b");
const OBSERVED_AT = "2026-11-19T10:00:00Z";

class FailableNotifications extends InMemoryNotificationRepository {
  failAdd = false;

  override async add(notification: Notification): Promise<void> {
    if (this.failAdd) throw new Error("the store is down");
    return super.add(notification);
  }
}

/** Simulates a concurrent Evaluation: the first search finds nothing even though a Notification is stored. */
class StaleFirstRead extends FailableNotifications {
  private stale = true;

  override async findByAlert(alertId: AlertId): Promise<Notification | null> {
    if (this.stale) {
      this.stale = false;
      return null;
    }
    return super.findByAlert(alertId);
  }
}

class RecordingPrices extends InMemoryCurrentPriceSource {
  readonly reads: ListingId[] = [];
  failing = false;

  /** Give the Listing a Current Price in EUR from its amount, or none (null). */
  setPrice(listingId: ListingId, amount: string | null, observedAt = OBSERVED_AT): void {
    this.set(
      listingId,
      amount === null ? null : { price: Price.fromDecimalString(amount, "EUR"), observedAt: ObservedAt.fromIsoString(observedAt) },
    );
  }

  override async currentPriceOf(listingId: ListingId) {
    this.reads.push(listingId);
    if (this.failing) throw new Error("the prices are not available");
    return super.currentPriceOf(listingId);
  }
}

class AlertsWithFailingSave extends InMemoryPriceAlertRepository {
  failSave = false;

  override async save(alert: PriceAlert, expectedStatus: AlertStatus): Promise<void> {
    if (this.failSave) throw new Error("the store is down");
    return super.save(alert, expectedStatus);
  }
}

let alerts: AlertsWithFailingSave;
let notifications: FailableNotifications;
let prices: RecordingPrices;

const build = () => new EvaluatePriceAlerts(alerts, notifications, prices);
const evaluate = (listingId: ListingId = LISTING) => build().execute({ listingId });

/** An Active Price Alert, stored. */
async function givenAlert(target: string, owner: UserId = OWNER, listingId: ListingId = LISTING): Promise<PriceAlert> {
  const alert = PriceAlert.create({
    id: newAlertId(),
    owner,
    listingId,
    targetPrice: TargetPrice.fromDecimalString(target, "EUR"),
    currentPrice: null,
    createdAt: CREATED_AT,
  });
  await alerts.add(alert);
  return alert;
}

const stored = (alert: PriceAlert) => alerts.all().find((a) => a.id === alert.id) as PriceAlert;
const statusOf = (alert: PriceAlert) => stored(alert).status;

beforeEach(() => {
  alerts = new AlertsWithFailingSave();
  notifications = new FailableNotifications();
  prices = new RecordingPrices();
});

describe("a Price Alert that is reached", () => {
  it("SC-01 / BR-01 / BR-02 / BR-04 / BR-05: becomes Triggered and produces a Notification that states what was reached", async () => {
    const alert = await givenAlert("80.00");
    prices.setPrice(LISTING, "79.90");

    const result = await evaluate();

    expect(statusOf(alert)).toBe(AlertStatus.Triggered);
    expect(notifications.all()).toHaveLength(1);
    expect(result.failed).toEqual([]);
    expect(result.triggered).toEqual([
      {
        produced: true,
        notification: {
          alertId: alert.id,
          owner: OWNER,
          listingId: LISTING,
          targetPrice: { amount: "80.00", currency: "EUR" },
          currentPrice: { amount: "79.90", currency: "EUR" },
          observedAt: "2026-11-19T10:00:00.000Z",
        },
      },
    ]);
  });

  it("SC-02 / BR-02: a Current Price equal to the Target Price reaches it", async () => {
    const alert = await givenAlert("80.00");
    prices.setPrice(LISTING, "80.00");
    await evaluate();
    expect(statusOf(alert)).toBe(AlertStatus.Triggered);
    expect(notifications.all()).toHaveLength(1);
  });

  it("SC-04 / BR-02: a Current Price of zero reaches any Target Price", async () => {
    const alert = await givenAlert("10.00");
    prices.setPrice(LISTING, "0.00");
    await evaluate();
    expect(statusOf(alert)).toBe(AlertStatus.Triggered);
  });
});

describe("a Price Alert that is not reached", () => {
  it("SC-03 / BR-02: a Current Price above the Target Price leaves it Active, with no Notification", async () => {
    const alert = await givenAlert("80.00");
    prices.setPrice(LISTING, "80.01");
    const result = await evaluate();
    expect(statusOf(alert)).toBe(AlertStatus.Active);
    expect(notifications.all()).toEqual([]);
    expect(result).toEqual({ triggered: [], failed: [] });
  });

  it("SC-05 / SC-06 / BR-03: a Listing with no Current Price triggers nothing", async () => {
    const alert = await givenAlert("80.00");
    prices.setPrice(LISTING, null);
    const result = await evaluate();
    expect(statusOf(alert)).toBe(AlertStatus.Active);
    expect(notifications.all()).toEqual([]);
    expect(result).toEqual({ triggered: [], failed: [] });
  });

  it("SC-07 / BR-03: a Listing that has a Price again is evaluated against that Price", async () => {
    const alert = await givenAlert("80.00");
    prices.setPrice(LISTING, null);
    await evaluate();
    prices.setPrice(LISTING, "75.00", "2026-11-19T12:00:00Z");
    const result = await evaluate();
    expect(statusOf(alert)).toBe(AlertStatus.Triggered);
    expect(result.triggered).toHaveLength(1);
  });
});

describe("several Price Alerts", () => {
  it("SC-08 / BR-01 / BR-02: only the alerts whose Target Price is reached are Triggered", async () => {
    const low = await givenAlert("70.00", OWNER);
    const middle = await givenAlert("80.00", OTHER_OWNER);
    const high = await givenAlert("90.00", UserId("user-3"));
    prices.setPrice(LISTING, "85.00");

    const result = await evaluate();

    expect(statusOf(high)).toBe(AlertStatus.Triggered);
    expect(statusOf(low)).toBe(AlertStatus.Active);
    expect(statusOf(middle)).toBe(AlertStatus.Active);
    expect(result.triggered).toHaveLength(1);
    expect(notifications.all()).toHaveLength(1);
  });

  it("SC-09 / BR-04 / BR-05: each alert that is reached has its own Notification", async () => {
    await givenAlert("80.00", OWNER);
    await givenAlert("80.00", OTHER_OWNER);
    prices.setPrice(LISTING, "75.00");

    const result = await evaluate();

    expect(result.triggered.map((t) => t.notification.owner).sort()).toEqual([OWNER, OTHER_OWNER]);
    expect(notifications.all().map((n) => n.owner).sort()).toEqual([OWNER, OTHER_OWNER]);
  });

  it("SC-10 / BR-01: the alerts of another Listing are not evaluated", async () => {
    const here = await givenAlert("80.00", OWNER, LISTING);
    const elsewhere = await givenAlert("80.00", OWNER, OTHER_LISTING);
    prices.setPrice(LISTING, "70.00");
    prices.setPrice(OTHER_LISTING, "70.00");

    await evaluate(LISTING);

    expect(statusOf(here)).toBe(AlertStatus.Triggered);
    expect(statusOf(elsewhere)).toBe(AlertStatus.Active);
    expect(notifications.all()).toHaveLength(1);
  });

  it("decision 3: the Current Price is read once, and every alert of the run is compared with it", async () => {
    await givenAlert("70.00", OWNER);
    await givenAlert("80.00", OTHER_OWNER);
    await givenAlert("90.00", UserId("user-3"));
    prices.setPrice(LISTING, "75.00");
    await evaluate();
    expect(prices.reads).toEqual([LISTING]);
  });
});

describe("once, and repeating", () => {
  it("SC-11 / BR-01: a Triggered Price Alert is not evaluated again", async () => {
    const alert = await givenAlert("80.00");
    prices.setPrice(LISTING, "75.00");
    await evaluate();
    prices.setPrice(LISTING, "60.00", "2026-11-19T12:00:00Z");

    const result = await evaluate();

    expect(statusOf(alert)).toBe(AlertStatus.Triggered);
    expect(result).toEqual({ triggered: [], failed: [] });
    expect(notifications.all()).toHaveLength(1);
  });

  it("SC-12 / BR-07: repeating an Evaluation when nothing has changed changes nothing", async () => {
    const alert = await givenAlert("80.00");
    prices.setPrice(LISTING, "75.00");
    await evaluate();
    const before = notifications.all();

    const second = await evaluate();

    expect(second).toEqual({ triggered: [], failed: [] });
    expect(statusOf(alert)).toBe(AlertStatus.Triggered);
    expect(notifications.all()).toEqual(before);
  });
});

describe("concurrency (contract, decision 8)", () => {
  it("SC-13 / BR-05 / BR-07: two Evaluations at the same time produce a single Notification", async () => {
    const alert = await givenAlert("80.00");
    prices.setPrice(LISTING, "75.00");

    const [first, second] = await Promise.all([evaluate(), evaluate()]);

    expect(notifications.all()).toHaveLength(1);
    expect(statusOf(alert)).toBe(AlertStatus.Triggered);
    const produced = [...first.triggered, ...second.triggered].filter((t) => t.produced);
    expect(produced).toHaveLength(1);
    expect(first.failed).toEqual([]);
    expect(second.failed).toEqual([]);
  });

  it("an Evaluation that finds the Notification stored by another one goes on with it: produced is false", async () => {
    notifications = new StaleFirstRead();
    const alert = await givenAlert("80.00");
    prices.setPrice(LISTING, "75.00");
    await notifications.add(
      Notification.produce({ alert, currentPrice: Price.fromDecimalString("75.00", "EUR"), observedAt: ObservedAt.fromIsoString(OBSERVED_AT) }),
    );

    const result = await evaluate();

    expect(result.triggered).toHaveLength(1);
    expect(result.triggered[0]?.produced).toBe(false);
    expect(statusOf(alert)).toBe(AlertStatus.Triggered);
    expect(notifications.all()).toHaveLength(1);
  });

  it("a Notification refused as existing that cannot be found is reported as a failure of that alert", async () => {
    class Inconsistent extends FailableNotifications {
      override async add(): Promise<void> {
        throw new NotificationAlreadyExists();
      }
    }
    notifications = new Inconsistent();
    const alert = await givenAlert("80.00");
    prices.setPrice(LISTING, "75.00");

    const result = await evaluate();

    expect(result.triggered).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(statusOf(alert)).toBe(AlertStatus.Active);
  });
});

describe("failures between the two changes (BR-06)", () => {
  it("SC-14: if the Notification cannot be produced the alert stays Active, and a later Evaluation completes it", async () => {
    const alert = await givenAlert("80.00");
    prices.setPrice(LISTING, "75.00");
    notifications.failAdd = true;

    const failed = await evaluate();
    expect(statusOf(alert)).toBe(AlertStatus.Active);
    expect(notifications.all()).toEqual([]);
    expect(failed.triggered).toEqual([]);
    expect(failed.failed.map((f) => f.alertId)).toEqual([alert.id]);

    notifications.failAdd = false;
    const second = await evaluate();
    expect(statusOf(alert)).toBe(AlertStatus.Triggered);
    expect(notifications.all()).toHaveLength(1);
    expect(second.triggered).toHaveLength(1);
    expect(second.triggered[0]?.produced).toBe(true);
  });

  it("BR-06: if the alert cannot be saved after the Notification, the next Evaluation makes it Triggered without a second Notification", async () => {
    const alert = await givenAlert("80.00");
    prices.setPrice(LISTING, "75.00");
    alerts.failSave = true;

    const interrupted = await evaluate();
    expect(interrupted.failed).toHaveLength(1);
    expect(statusOf(alert)).toBe(AlertStatus.Active);
    expect(notifications.all()).toHaveLength(1);

    alerts.failSave = false;
    const completed = await evaluate();
    expect(statusOf(alert)).toBe(AlertStatus.Triggered);
    expect(notifications.all()).toHaveLength(1);
    expect(completed.triggered[0]?.produced).toBe(false);
  });

  it("SC-15 / BR-05 / BR-06: a Notification exists and the alert is still Active: the next Evaluation makes it Triggered", async () => {
    const alert = await givenAlert("80.00");
    await notifications.add(
      Notification.produce({ alert, currentPrice: Price.fromDecimalString("75.00", "EUR"), observedAt: ObservedAt.fromIsoString(OBSERVED_AT) }),
    );
    prices.setPrice(LISTING, "75.00");

    const result = await evaluate();

    expect(statusOf(alert)).toBe(AlertStatus.Triggered);
    expect(notifications.all()).toHaveLength(1);
    expect(result.triggered[0]?.produced).toBe(false);
  });

  it.each([["95.00"], [null]])(
    "SC-16 / BR-06: the existing Notification decides, even if the Current Price is now %s",
    async (price) => {
      const alert = await givenAlert("80.00");
      await notifications.add(
        Notification.produce({ alert, currentPrice: Price.fromDecimalString("75.00", "EUR"), observedAt: ObservedAt.fromIsoString(OBSERVED_AT) }),
      );
      prices.setPrice(LISTING, price);

      const result = await evaluate();

      expect(statusOf(alert)).toBe(AlertStatus.Triggered);
      expect(notifications.all()).toHaveLength(1);
      expect(result.triggered[0]?.notification.currentPrice).toEqual({ amount: "75.00", currency: "EUR" });
    },
  );
});

describe("one alert that fails does not stop the others (contract, decision 5)", () => {
  it("the others are processed, and the failure is returned and not raised", async () => {
    const broken = await givenAlert("80.00", OWNER);
    const fine = await givenAlert("80.00", OTHER_OWNER);
    prices.setPrice(LISTING, "75.00");
    const add = notifications.add.bind(notifications);
    notifications.add = async (notification) => {
      if (notification.alertId === broken.id) throw new Error("this one fails");
      return add(notification);
    };

    const result = await evaluate();

    expect(statusOf(fine)).toBe(AlertStatus.Triggered);
    expect(statusOf(broken)).toBe(AlertStatus.Active);
    expect(result.triggered).toHaveLength(1);
    expect(result.failed.map((f) => [f.alertId, f.error.message])).toEqual([[broken.id, "this one fails"]]);
  });

  it("an alert whose Target Price is in another currency than the Current Price is a failure of that alert only", async () => {
    const inconsistent = new PriceAlert(newAlertId(), OWNER, LISTING, TargetPrice.fromDecimalString("80.00", "USD"), AlertStatus.Active, CREATED_AT);
    await alerts.add(inconsistent);
    const fine = await givenAlert("80.00", OTHER_OWNER);
    prices.setPrice(LISTING, "75.00");

    const result = await evaluate();

    expect(statusOf(fine)).toBe(AlertStatus.Triggered);
    expect(statusOf(inconsistent)).toBe(AlertStatus.Active);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.error).toBeInstanceOf(CurrencyMismatch);
  });

  it("a failure that is not an Error is still reported as one", async () => {
    const alert = await givenAlert("80.00");
    prices.setPrice(LISTING, "75.00");
    notifications.add = async () => Promise.reject("the store said no");

    const result = await evaluate();

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.alertId).toBe(alert.id);
    expect(result.failed[0]?.error).toBeInstanceOf(Error);
    expect(result.failed[0]?.error.message).toBe("the store said no");
  });

  it("a failure of the source of the Current Price is not about one alert: it is raised", async () => {
    await givenAlert("80.00");
    prices.failing = true;
    await expect(evaluate()).rejects.toThrow("the prices are not available");
  });
});

describe("boundaries", () => {
  it("SC-17 / BR-08: the Notification of the result has no channel and nothing is delivered", async () => {
    await givenAlert("80.00");
    prices.setPrice(LISTING, "75.00");
    const result = await evaluate();
    expect(Object.keys(result.triggered[0]?.notification ?? {}).sort()).toEqual(
      ["alertId", "currentPrice", "listingId", "observedAt", "owner", "targetPrice"],
    );
  });

  it("SC-18 / BR-09: only the state of the alert that is Triggered changes", async () => {
    const reached = await givenAlert("80.00", OWNER);
    const notReached = await givenAlert("70.00", OTHER_OWNER);
    prices.setPrice(LISTING, "75.00");

    await evaluate();

    expect(alerts.all()).toHaveLength(2);
    expect(statusOf(notReached)).toBe(AlertStatus.Active);
    expect(stored(notReached).equals(notReached)).toBe(true);
    expect(stored(notReached).targetPrice.equals(notReached.targetPrice)).toBe(true);
    expect(stored(reached).owner).toBe(OWNER);
    expect(stored(reached).targetPrice.equals(reached.targetPrice)).toBe(true);
    expect(stored(reached).listingId).toBe(LISTING);
  });

  it("SC-19 / BR-10: a Listing that does not exist has nothing to evaluate, and it is not an error", async () => {
    const result = await evaluate(ListingId("no-such-listing"));
    expect(result).toEqual({ triggered: [], failed: [] });
    expect(notifications.all()).toEqual([]);
    expect(prices.reads).toEqual([]);
  });
});
