/**
 * The Catalogue meeting the rest of the application at the Composition Root: Users with real Sessions read it,
 * the credentials of Providers are not valid for it, the Current Price it shows follows the observations, and
 * what a User chooses in it can be watched (feature 07). Each test names the scenario (SC-nn) or the rule
 * (BR-nn) of that feature.
 */

import { afterEach, describe, expect, it } from "vitest";
import { composeInMemoryApp } from "../src/composition-root";
import { ProviderId } from "../src/price-observations/domain";
import { ListingId } from "../src/shared/domain";
import { MutableClock } from "./accounts/support/fakes";
import { DAY, START } from "./accounts/support/world";
import { FAST_HASHER, signedInUser } from "./support/accounts";

const HEADPHONES = ListingId("headphones-shop-a");
const KEYBOARD = ListingId("keyboard-shop-b");
const MONITOR = ListingId("monitor-shop-a");
const PROVIDER_TOKEN = "provider-token";

let application: ReturnType<typeof composeInMemoryApp>;
let clock: MutableClock;

afterEach(async () => {
  await application.app.close();
});

async function compose(options: { apiDocs?: boolean } = {}) {
  clock = new MutableClock(START);
  application = composeInMemoryApp({
    clock,
    passwordHasher: FAST_HASHER,
    onEvaluation: () => {},
    ...(options.apiDocs ? { apiDocs: {} } : {}),
  });
  application.providerAuthenticator.addProvider(PROVIDER_TOKEN, ProviderId("simulator"));
  application.catalogue.addListing(HEADPHONES, "EUR", { title: "Wireless headphones", retailer: "Shop A" });
  application.catalogue.addListing(KEYBOARD, "USD", { title: "Mechanical keyboard", retailer: "Shop B" });
  application.catalogue.addListing(MONITOR, "EUR", { title: "27-inch monitor", retailer: "Shop A" });
  await record(HEADPHONES, "2026-11-19T09:00:00Z", { amount: "100.00", currency: "EUR" });
  await record(KEYBOARD, "2026-11-19T09:00:00Z", { amount: "50.00", currency: "USD" });
  await record(MONITOR, "2026-11-19T09:00:00Z", null);
  return signedInUser(application, "ana@example.com");
}

const record = (listing: ListingId, observedAt: string, price: { amount: string; currency: string } | null) =>
  application.recordPriceObservation.execute({ provider: ProviderId("simulator"), listingId: listing, observedAt, price });

const call = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, token: string | null, payload?: object) =>
  application.app.inject({
    method,
    url,
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
    ...(payload ? { payload } : {}),
  });

describe("a User with a Session reads the Catalogue", () => {
  it("SC-01 / SC-04 / SC-05: lists the Listings in order, with their Current Price, and null where there is none", async () => {
    const { token } = await compose();
    const body = (await call("GET", "/listings", token)).json();
    expect(body.total).toBe(3);
    expect(body.items).toEqual([
      { id: "monitor-shop-a", title: "27-inch monitor", retailer: "Shop A", currency: "EUR", currentPrice: null },
      { id: "keyboard-shop-b", title: "Mechanical keyboard", retailer: "Shop B", currency: "USD", currentPrice: { amount: "50.00", currency: "USD", observedAt: "2026-11-19T09:00:00.000Z" } },
      { id: "headphones-shop-a", title: "Wireless headphones", retailer: "Shop A", currency: "EUR", currentPrice: { amount: "100.00", currency: "EUR", observedAt: "2026-11-19T09:00:00.000Z" } },
    ]);
  });

  it("SC-15: reads one Listing, the same view as the list shows", async () => {
    const { token } = await compose();
    const fromList = (await call("GET", "/listings", token)).json().items.find((l: { id: string }) => l.id === HEADPHONES);
    expect((await call("GET", `/listings/${HEADPHONES}`, token)).json()).toEqual(fromList);
  });

  it("SC-17: a Listing that is not in the Catalogue is not found", async () => {
    const { token } = await compose();
    expect((await call("GET", "/listings/no-such-listing", token)).statusCode).toBe(404);
  });
});

describe("the Current Price follows the observations (BR-03)", () => {
  it("SC-09: a price that a Provider records is what the Catalogue shows next, and the Price History agrees", async () => {
    const { token } = await compose();
    await call("POST", `/listings/${HEADPHONES}/price-observations`, PROVIDER_TOKEN, {
      observedAt: "2026-11-19T10:00:00Z",
      price: { amount: "79.90", currency: "EUR" },
    });
    const shown = (await call("GET", `/listings/${HEADPHONES}`, token)).json().currentPrice;
    expect(shown).toEqual({ amount: "79.90", currency: "EUR", observedAt: "2026-11-19T10:00:00.000Z" });
    const latest = (await call("GET", `/listings/${HEADPHONES}/price-observations?limit=1`, token)).json().items[0];
    expect(latest.price.amount).toBe(shown.amount);
    expect(latest.observedAt).toBe(shown.observedAt);
  });

  it("SC-06: a Listing that becomes unavailable shows no Current Price", async () => {
    const { token } = await compose();
    await record(HEADPHONES, "2026-11-19T10:00:00Z", null);
    expect((await call("GET", `/listings/${HEADPHONES}`, token)).json().currentPrice).toBeNull();
  });

  it("SC-07: an observation of an earlier moment, recorded later, does not change it", async () => {
    const { token } = await compose();
    await record(HEADPHONES, "2026-11-19T08:00:00Z", { amount: "120.00", currency: "EUR" });
    expect((await call("GET", `/listings/${HEADPHONES}`, token)).json().currentPrice.amount).toBe("100.00");
  });
});

describe("what a User chooses can be watched", () => {
  it("the round trip: choose a Listing of the Catalogue, create an alert for it, a price reaches it, read the Notification", async () => {
    const { token, userId } = await compose();
    const chosen = (await call("GET", "/listings", token)).json().items.find((l: { id: string }) => l.id === KEYBOARD);

    const created = await call("POST", `/listings/${chosen.id}/price-alerts`, token, { targetAmount: "45.00" });
    expect(created.statusCode).toBe(201);
    expect(created.json().currency).toBe(chosen.currency);

    await call("POST", `/listings/${chosen.id}/price-observations`, PROVIDER_TOKEN, {
      observedAt: "2026-11-19T10:00:00Z",
      price: { amount: "44.00", currency: "USD" },
    });
    const notifications = (await call("GET", "/notifications", token)).json();
    expect(notifications.total).toBe(1);
    expect(notifications.items[0]).toMatchObject({ owner: userId, listingId: KEYBOARD });
    expect((await call("GET", `/listings/${KEYBOARD}`, token)).json().currentPrice.amount).toBe("44.00");
  });

  it("an alert is refused for a target that the shown Current Price already reaches, as before", async () => {
    const { token } = await compose();
    const shown = (await call("GET", `/listings/${HEADPHONES}`, token)).json().currentPrice.amount;
    expect(shown).toBe("100.00");
    expect((await call("POST", `/listings/${HEADPHONES}/price-alerts`, token, { targetAmount: "100.00" })).statusCode).toBe(409);
  });
});

describe("the Current Price that the Catalogue shows is the one that the alerts use (BR-03)", () => {
  // The rule is written twice: in the Composition Root, for the alerts, and in the use cases of the Catalogue
  // (decision 9 of the design). These tests make the two agree, whichever is changed.
  it("with a Current Price, an alert for a target that it reaches is refused, and one that it does not is accepted", async () => {
    const { token } = await compose();
    expect((await call("GET", `/listings/${HEADPHONES}`, token)).json().currentPrice.amount).toBe("100.00");
    expect((await call("POST", `/listings/${HEADPHONES}/price-alerts`, token, { targetAmount: "100.00" })).statusCode).toBe(409);
    expect((await call("POST", `/listings/${HEADPHONES}/price-alerts`, token, { targetAmount: "99.99" })).statusCode).toBe(201);
  });

  it("with no Current Price because the Listing was never observed, an alert for any target is accepted", async () => {
    const { token } = await compose();
    application.catalogue.addListing(ListingId("webcam-shop-b"), "USD", { title: "HD webcam", retailer: "Shop B" });
    expect((await call("GET", "/listings/webcam-shop-b", token)).json().currentPrice).toBeNull();
    expect((await call("POST", "/listings/webcam-shop-b/price-alerts", token, { targetAmount: "1000.00" })).statusCode).toBe(201);
  });

  it("with no Current Price because the latest observation has no Price, an alert is accepted for a target that the earlier price reached", async () => {
    const { token } = await compose();
    await record(HEADPHONES, "2026-11-19T10:00:00Z", null);
    expect((await call("GET", `/listings/${HEADPHONES}`, token)).json().currentPrice).toBeNull();
    expect((await call("POST", `/listings/${HEADPHONES}/price-alerts`, token, { targetAmount: "150.00" })).statusCode).toBe(201);
  });
});

describe("who can read it (BR-06)", () => {
  it.each(["/listings", `/listings/${HEADPHONES}`])("SC-18: %s is not valid with the token of a Provider, with no token, or with a fixed one", async (url) => {
    await compose();
    for (const token of [PROVIDER_TOKEN, null, "demo-token-1", "no-such-token"]) {
      const response = await call("GET", url, token);
      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe("UNAUTHENTICATED");
    }
  });

  it("SC-19: a request that is not authenticated learns nothing, here with a real Session in the application", async () => {
    await compose();
    expect((await call("GET", "/listings?limit=abc", null)).statusCode).toBe(401);
    expect((await call("GET", "/listings/no-such-listing", null)).statusCode).toBe(401);
  });

  it("SC-18: after signing out, and after 7 days, the token no longer reads the Catalogue", async () => {
    const { token } = await compose();
    const second = (await application.signIn.execute({ email: "ana@example.com", password: "test-password-1" })).token;
    await call("DELETE", "/sessions/current", token);
    expect((await call("GET", "/listings", token)).statusCode).toBe(401);
    expect((await call("GET", "/listings", second)).statusCode).toBe(200);
    clock.advance(7 * DAY);
    expect((await call("GET", "/listings", second)).statusCode).toBe(401);
  });
});

describe("nothing writes to the Catalogue (BR-05, BR-08)", () => {
  it("SC-21: a request that would add, change or remove a Listing has no route, and the Catalogue is as it was", async () => {
    const { token } = await compose();
    for (const [method, url] of [["POST", "/listings"], ["PUT", `/listings/${HEADPHONES}`], ["DELETE", `/listings/${HEADPHONES}`]] as const) {
      const response = await call(method, url, token, method === "DELETE" ? undefined : { title: "Other" });
      expect(response.statusCode).toBe(404);
    }
    expect((await call("GET", "/listings", token)).json().total).toBe(3);
    expect((await call("GET", `/listings/${HEADPHONES}`, token)).json().title).toBe("Wireless headphones");
  });

  it("SC-20: reading does not record an observation or change an alert", async () => {
    const { token } = await compose();
    await call("POST", `/listings/${HEADPHONES}/price-alerts`, token, { targetAmount: "80.00" });
    const alertsNow = () => application.alerts.all().map((a) => `${a.id}:${a.status}`);
    const before = alertsNow();
    await call("GET", "/listings", token);
    await call("GET", `/listings/${HEADPHONES}`, token);
    expect(alertsNow()).toEqual(before);
    expect((await call("GET", `/listings/${HEADPHONES}/price-observations`, token)).json().total).toBe(1);
  });
});

describe("the documentation", () => {
  it("documents the Catalogue when it is asked for, next to the other features", async () => {
    await compose({ apiDocs: true });
    const spec = (await call("GET", "/docs/json", null)).json();
    expect(Object.keys(spec.paths)).toEqual(expect.arrayContaining(["/listings", "/listings/{listingId}"]));
    expect(spec.tags.map((t: { name: string }) => t.name)).toEqual(expect.arrayContaining(["Listings", "Accounts", "Price alerts"]));
  });
});
