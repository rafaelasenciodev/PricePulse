/**
 * The order and the pages are those of the contracts, and what is stored is exact (feature 11, SC-18 to SC-25).
 * They are read through the application over the database, as a person reads them.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/composition-root";
import type { Pool } from "../../src/database/connect";
import { ProviderId } from "../../src/price-observations/domain";
import { ListingId } from "../../src/shared/domain";
import { MutableClock } from "../accounts/support/fakes";
import { testPool, truncateAll } from "../support/database";
import { HEADPHONES, NOW, PROVIDER_TOKEN, call, createAlert, observe, seedHeadphones, signedIn, startPostgres } from "./support";

let pool: Pool;
let application: Application;
let clock: MutableClock;
let token: string;

beforeAll(async () => {
  pool = await testPool();
});
afterAll(async () => {
  await pool.end();
});
beforeEach(async () => {
  await truncateAll(pool);
  clock = new MutableClock(NOW.getTime());
  application = startPostgres(pool, clock);
  token = await signedIn(application, "ana@example.com");
});
afterEach(async () => {
  await application.app.close();
});

const get = async (url: string) => (await call(application, "GET", url, token)).json();
const addListing = (id: string, title: string) => application.catalogue.addListing(ListingId(id), "EUR", { title, retailer: "Shop" });

describe("the lists have a fixed order and a total", () => {
  it("SC-18 / BR-06: the Price Alerts are newest first, two of the same moment by identifier, with no gap and no repetition across pages", async () => {
    const created: { id: string; moment: number }[] = [];
    for (let i = 0; i < 25; i++) {
      await addListing(`listing-${i}`, `Item ${i}`);
      // Alerts 5 and 6 share a moment. Without a Current Price a target is always allowed.
      if (i !== 6) clock.advance(1000);
      const id = (await createAlert(application, token, "80.00", `listing-${i}`)).json().id as string;
      created.push({ id, moment: clock.now().getTime() });
    }
    const first = await get("/price-alerts?limit=20&offset=0");
    const second = await get("/price-alerts?limit=20&offset=20");
    const all = [...first.items, ...second.items].map((a: { id: string }) => a.id);

    // Newest first, and two of the same moment by identifier compared by the codes of their characters.
    const expected = [...created]
      .sort((a, b) => b.moment - a.moment || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((a) => a.id);
    expect(all).toEqual(expected);
    expect(new Set(all).size).toBe(25);
    expect([first.total, second.total]).toEqual([25, 25]);
    expect([first.items.length, second.items.length]).toEqual([20, 5]);
  });

  it("SC-19 / BR-06: the Notifications are listed by the moment their price was observed, newest first, two of the same moment by alert", async () => {
    const alerts: Record<string, string> = {};
    for (const listing of ["l-a", "l-b", "l-c"]) {
      await addListing(listing, listing);
      alerts[listing] = (await createAlert(application, token, "80.00", listing)).json().id;
    }
    await observe(application, "10:00:00", "79.00", "l-a");
    await observe(application, "10:00:00", "79.00", "l-b");
    await observe(application, "11:00:00", "79.00", "l-c");

    const { items } = await get("/notifications");

    const tied = [alerts["l-a"], alerts["l-b"]].sort() as string[];
    expect(items.map((n: { alertId: string }) => n.alertId)).toEqual([alerts["l-c"], ...tied]);
  });

  it("SC-20 / BR-06: the Price History is newest first, limited by a range, from included to excluded, two Providers at one moment by Provider", async () => {
    await seedHeadphones(application);
    application.providerAuthenticator.addProvider("other-token", ProviderId("another"));
    for (const hour of ["08", "09", "10", "11"]) await observe(application, `${hour}:00:00`, "90.00");
    await call(application, "POST", `/listings/${HEADPHONES}/price-observations`, "other-token", {
      observedAt: "2026-11-19T10:00:00Z",
      price: { amount: "91.00", currency: "EUR" },
    });

    const history = await get(`/listings/${HEADPHONES}/price-observations?from=2026-11-19T09:00:00Z&to=2026-11-19T11:00:00Z`);

    expect(history.items.map((o: { observedAt: string; provider: string }) => `${o.observedAt.slice(11, 16)} ${o.provider}`)).toEqual([
      "10:00 another",
      "10:00 simulator",
      "09:00 simulator",
    ]);
    expect(history.total).toBe(3);
    expect(PROVIDER_TOKEN).toBeTruthy();
  });

  it.each([
    [["banana", "Apple", "cherry"], ["Apple", "banana", "cherry"]],
    [["eclair", "Éclair", "zebra"], ["eclair", "zebra", "Éclair"]],
    [["Item 10", "Item 9", "item 1"], ["item 1", "Item 10", "Item 9"]],
  ])("SC-21 / BR-06: the Catalogue is ordered by the lower-cased title, by the codes of its characters: %j", async (titles, order) => {
    for (const [i, title] of titles.entries()) await addListing(`listing-${i}`, title as string);
    const { items } = await get("/listings");
    expect(items.map((l: { title: string }) => l.title)).toEqual(order);
  });

  it("SC-22 / BR-06: two Listings with the same title are ordered by identifier", async () => {
    await addListing("same-b", "Same");
    await addListing("same-a", "Same");
    expect((await get("/listings")).items.map((l: { id: string }) => l.id)).toEqual(["same-a", "same-b"]);
  });

  it("SC-23 / BR-06: a page of the Catalogue says the total of all the Listings, not of the page", async () => {
    for (let i = 0; i < 45; i++) await addListing(`listing-${String(i).padStart(2, "0")}`, `Item ${String(i).padStart(2, "0")}`);
    const page = await get("/listings?limit=20&offset=40");
    expect(page.items).toHaveLength(5);
    expect(page.total).toBe(45);
  });
});

describe("what is stored is exact", () => {
  it.each(["0.01", "79.90", "1234567.89"])("SC-24 / BR-08: a Target Price and a price come back with the text they were given: %s", async (amount) => {
    await addListing("l-x", "Item");
    const alert = (await createAlert(application, token, amount, "l-x")).json();
    await observe(application, "10:00:00", amount, "l-x");

    expect((await get(`/price-alerts/${alert.id}`)).targetAmount).toBe(amount);
    const history = await get("/listings/l-x/price-observations");
    expect(history.items[0].price.amount).toBe(amount);
  });

  it("SC-25 / BR-08: the moment of an observation comes back to the millisecond", async () => {
    await addListing("l-x", "Item");
    await observe(application, "10:00:00.123", "79.00", "l-x");
    expect((await get("/listings/l-x/price-observations")).items[0].observedAt).toBe("2026-11-19T10:00:00.123Z");
  });
});
