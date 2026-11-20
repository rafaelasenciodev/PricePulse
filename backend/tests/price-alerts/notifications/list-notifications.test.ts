import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryNotificationRepository, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { ListNotifications, type NotificationRepository } from "../../../src/price-alerts/application";
import { AlertId, AlertStatus } from "../../../src/price-alerts/domain";
import { anAlert } from "../../support/alerts";
import { aNotification, type NotificationSpec } from "../../support/notifications";
import { UserId } from "../../../src/shared/domain";

const USER = UserId("user-1");

let notifications: InMemoryNotificationRepository;

const list = (query: { owner?: UserId; limit?: number; offset?: number } = {}, repository: NotificationRepository = notifications) => {
  const { owner = USER, limit = 20, offset = 0 } = query;
  return new ListNotifications(repository).execute({ owner, limit, offset });
};

const add = async (...specs: NotificationSpec[]) => {
  for (const spec of specs) await notifications.add(aNotification(spec));
};

const alertIds = (result: { items: readonly { alertId: string }[] }) => result.items.map((n) => n.alertId);

beforeEach(() => {
  notifications = new InMemoryNotificationRepository();
});

describe("reading the Notifications of a User", () => {
  it("SC-01 / BR-02: lists them newest first by the Observed At of the price that reached the target", async () => {
    await add(
      { alertId: AlertId("older"), observedAt: "2026-11-19T10:00:00Z" },
      { alertId: AlertId("newer"), observedAt: "2026-11-19T12:00:00Z" },
    );
    expect(alertIds(await list())).toEqual(["newer", "older"]);
  });

  it("SC-01 / BR-03: each one shows its Price Alert, the Listing, the Target Price, and the Current Price with its Observed At", async () => {
    await add({ alertId: AlertId("alert-1"), listing: "keyboard-shop-b", target: "80.00", price: "79.90", observedAt: "2026-11-19T10:00:00Z" });

    const [first] = (await list()).items;

    expect(first).toEqual({
      alertId: "alert-1",
      owner: "user-1",
      listingId: "keyboard-shop-b",
      targetPrice: { amount: "80.00", currency: "EUR" },
      currentPrice: { amount: "79.90", currency: "EUR" },
      observedAt: "2026-11-19T10:00:00.000Z",
    });
  });

  it("SC-01 / BR-02: tells the milliseconds of the Observed At apart", async () => {
    await add(
      { alertId: AlertId("a"), observedAt: "2026-11-19T10:00:00.001Z" },
      { alertId: AlertId("b"), observedAt: "2026-11-19T10:00:00.002Z" },
    );
    expect(alertIds(await list())).toEqual(["b", "a"]);
  });

  it("SC-02 / BR-02: two Notifications observed at the same moment come ordered by the identifier of their Price Alert", async () => {
    await add(
      { alertId: AlertId("c"), observedAt: "2026-11-19T10:00:00Z" },
      { alertId: AlertId("a"), observedAt: "2026-11-19T10:00:00Z" },
      { alertId: AlertId("b"), observedAt: "2026-11-19T10:00:00Z" },
    );
    expect(alertIds(await list())).toEqual(["a", "b", "c"]);
  });

  it("SC-03 / BR-01: a User sees only their own, and the total counts only theirs", async () => {
    await add(
      { alertId: AlertId("mine"), owner: "user-1" },
      { alertId: AlertId("theirs-1"), owner: "user-2" },
      { alertId: AlertId("theirs-2"), owner: "user-2" },
    );

    const result = await list({ owner: USER });

    expect(alertIds(result)).toEqual(["mine"]);
    expect(result.total).toBe(1);
    expect(alertIds(await list({ owner: UserId("user-2") })).sort()).toEqual(["theirs-1", "theirs-2"]);
  });

  it("SC-04 / BR-02: a User without Notifications gets an empty list", async () => {
    await add({ owner: "user-2" });
    expect(await list()).toEqual({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it("SC-05 / BR-01 / BR-03: the Notification of a Price Alert that was cancelled afterwards is still listed", async () => {
    const alert = anAlert({ id: AlertId("cancelled-later"), owner: "user-1" });
    const alerts = new InMemoryPriceAlertRepository();
    await alerts.add(alert);
    await add({ alertId: alert.id, owner: "user-1" });
    await alerts.save(alert.cancel(), AlertStatus.Active);

    expect(alertIds(await list())).toEqual(["cancelled-later"]);
  });
});

describe("the pages of the Notifications", () => {
  beforeEach(async () => {
    // Five Notifications, observed one hour apart: n-5 is the newest.
    for (let hour = 1; hour <= 5; hour++) await add({ alertId: AlertId(`n-${hour}`), observedAt: `2026-11-19T0${hour}:00:00Z` });
  });

  it("SC-06 / BR-02 / BR-08: gives the page asked for, and the total of all of them", async () => {
    const result = await list({ limit: 2, offset: 2 });
    expect(alertIds(result)).toEqual(["n-3", "n-2"]);
    expect(result).toMatchObject({ total: 5, limit: 2, offset: 2 });
  });

  it("the first page starts with the newest", async () => {
    expect(alertIds(await list({ limit: 2, offset: 0 }))).toEqual(["n-5", "n-4"]);
  });

  it("the last page can be shorter than the limit", async () => {
    expect(alertIds(await list({ limit: 2, offset: 4 }))).toEqual(["n-1"]);
  });

  it("a page beyond the end is empty, and the total is still known", async () => {
    const result = await list({ limit: 2, offset: 10 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(5);
  });

  it("walking the pages returns every Notification once and in order", async () => {
    const seen: string[] = [];
    for (let offset = 0; offset < 5; offset += 2) seen.push(...alertIds(await list({ limit: 2, offset })));
    expect(seen).toEqual(["n-5", "n-4", "n-3", "n-2", "n-1"]);
  });
});

describe("what the use case does and does not do (BR-09)", () => {
  it("SC-09 / BR-09: only reads: it has no way to produce a Notification or to evaluate", async () => {
    await add({ alertId: AlertId("n-1") });
    const calls: string[] = [];
    const spy = Object.create(notifications, {
      findByOwner: { value: async (...args: Parameters<typeof notifications.findByOwner>) => (calls.push("findByOwner"), notifications.findByOwner(...args)) },
      add: { value: async () => calls.push("add") },
      findByAlert: { value: async () => calls.push("findByAlert") },
    }) as NotificationRepository;

    await list({}, spy);

    expect(calls).toEqual(["findByOwner"]);
    expect(notifications.all()).toHaveLength(1);
  });
});
