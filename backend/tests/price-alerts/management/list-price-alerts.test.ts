import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { ListPriceAlerts } from "../../../src/price-alerts/application";
import { AlertId, AlertStatus, UserId } from "../../../src/price-alerts/domain";
import { anAlert } from "../../support/alerts";

const USER = UserId("user-1");

let alerts: InMemoryPriceAlertRepository;

const list = (query: { owner?: UserId; status?: AlertStatus; limit?: number; offset?: number } = {}) => {
  const { owner = USER, status, limit = 20, offset = 0 } = query;
  return new ListPriceAlerts(alerts).execute(status === undefined ? { owner, limit, offset } : { owner, status, limit, offset });
};

const add = async (...specs: Parameters<typeof anAlert>[0][]) => {
  for (const spec of specs) await alerts.add(anAlert(spec));
};

beforeEach(() => {
  alerts = new InMemoryPriceAlertRepository();
});

describe("reading the Price Alerts of a User", () => {
  it("SC-01 / BR-02: lists them newest first, with what each one shows", async () => {
    await add(
      { listing: "headphones-shop-a", target: "80.00", createdAt: "2026-11-19T10:00:00Z" },
      { listing: "keyboard-shop-b", target: "45.50", currency: "USD", createdAt: "2026-11-19T12:00:00Z" },
    );

    const result = await list();

    expect(result.items.map((a) => a.listingId)).toEqual(["keyboard-shop-b", "headphones-shop-a"]);
    expect(result.items[0]).toMatchObject({
      listingId: "keyboard-shop-b",
      targetAmount: "45.50",
      currency: "USD",
      status: "active",
      createdAt: "2026-11-19T12:00:00.000Z",
    });
    expect(result.total).toBe(2);
  });

  it("SC-01 / BR-09: two alerts created at the same moment come in a stable order, by identifier", async () => {
    await add(
      { id: AlertId("b"), listing: "l-1", createdAt: "2026-11-19T10:00:00Z" },
      { id: AlertId("a"), listing: "l-2", createdAt: "2026-11-19T10:00:00Z" },
    );
    expect((await list()).items.map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("SC-02 / BR-02: can be filtered by state", async () => {
    await add(
      { listing: "l-1", status: AlertStatus.Active },
      { listing: "l-2", status: AlertStatus.Triggered },
      { listing: "l-3", status: AlertStatus.Cancelled },
    );

    const result = await list({ status: AlertStatus.Active });

    expect(result.items.map((a) => a.listingId)).toEqual(["l-1"]);
    expect(result.total).toBe(1);
  });

  it("without a filter it lists the alerts in every state", async () => {
    await add({ listing: "l-1", status: AlertStatus.Active }, { listing: "l-2", status: AlertStatus.Triggered }, { listing: "l-3", status: AlertStatus.Cancelled });
    expect((await list()).items.map((a) => a.status).sort()).toEqual(["active", "cancelled", "triggered"]);
  });

  it("SC-03 / BR-01: a User sees only their own, and the total counts only theirs", async () => {
    await add({ owner: "user-1", listing: "l-1" }, { owner: "user-2", listing: "l-2" }, { owner: "user-2", listing: "l-3" });

    const result = await list({ owner: USER });

    expect(result.items.map((a) => a.listingId)).toEqual(["l-1"]);
    expect(result.total).toBe(1);
  });

  it("SC-04 / BR-02: a User without alerts gets an empty list", async () => {
    await add({ owner: "user-2" });
    expect(await list()).toEqual({ items: [], total: 0, limit: 20, offset: 0 });
  });
});

describe("the pages of the list", () => {
  beforeEach(async () => {
    // Five alerts, created one hour apart: l-5 is the newest.
    for (let hour = 1; hour <= 5; hour++) {
      await add({ listing: `l-${hour}`, createdAt: `2026-11-19T0${hour}:00:00Z` });
    }
  });

  it("gives the page asked for, and the total of all of them", async () => {
    const result = await list({ limit: 2, offset: 0 });
    expect(result.items.map((a) => a.listingId)).toEqual(["l-5", "l-4"]);
    expect(result).toMatchObject({ total: 5, limit: 2, offset: 0 });
  });

  it("the next page continues where the first one ended", async () => {
    const result = await list({ limit: 2, offset: 2 });
    expect(result.items.map((a) => a.listingId)).toEqual(["l-3", "l-2"]);
  });

  it("the last page can be shorter than the limit", async () => {
    const result = await list({ limit: 2, offset: 4 });
    expect(result.items.map((a) => a.listingId)).toEqual(["l-1"]);
    expect(result.total).toBe(5);
  });

  it("a page beyond the end is empty, and the total is still known", async () => {
    const result = await list({ limit: 2, offset: 10 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(5);
  });

  it("the total counts the alerts that match the filter, not the page", async () => {
    await add({ listing: "l-6", status: AlertStatus.Cancelled });
    const result = await list({ status: AlertStatus.Cancelled, limit: 1 });
    expect(result.total).toBe(1);
  });
});
