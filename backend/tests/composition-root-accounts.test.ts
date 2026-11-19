/**
 * Accounts meeting the other features at the Composition Root: the Session of a User opens what a User
 * can use, and the credentials of Users and of Providers are not interchangeable (feature 06). Each
 * test names the scenario (SC-nn) or the rule (BR-nn) of that feature.
 */

import { afterEach, describe, expect, it } from "vitest";
import { composeInMemoryApp } from "../src/composition-root";
import { ProviderId } from "../src/price-observations/domain";
import { ListingId } from "../src/shared/domain";
import { FAST_HASHER, signedInUser } from "./support/accounts";
import { FakeHasher, MutableClock } from "./accounts/support/fakes";
import { DAY, START } from "./accounts/support/world";

const HEADPHONES = ListingId("headphones-shop-a");
const PROVIDER_TOKEN = "provider-token";

let application: ReturnType<typeof composeInMemoryApp>;
let clock: MutableClock;

afterEach(async () => {
  await application.app.close();
});

async function compose() {
  clock = new MutableClock(START);
  application = composeInMemoryApp({ clock, passwordHasher: FAST_HASHER, onEvaluation: () => {} });
  application.providerAuthenticator.addProvider(PROVIDER_TOKEN, ProviderId("simulator"));
  application.catalogue.addListing(HEADPHONES, "EUR");
  await application.recordPriceObservation.execute({
    provider: ProviderId("simulator"),
    listingId: HEADPHONES,
    observedAt: "2026-11-19T09:00:00Z",
    price: { amount: "100.00", currency: "EUR" },
  });
  return signedInUser(application, "ana@example.com");
}

const call = (method: "GET" | "POST" | "DELETE", url: string, token: string | null, payload?: object) =>
  application.app.inject({
    method,
    url,
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
    ...(payload ? { payload } : {}),
  });

const OBSERVE = { observedAt: "2026-11-19T10:00:00Z", price: { amount: "99.00", currency: "EUR" } };

describe("SC-23 / BR-08: the Session of a User opens what a User can use", () => {
  it.each([
    ["creates a Price Alert", "POST", `/listings/${HEADPHONES}/price-alerts`, { targetAmount: "80.00" }, 201],
    ["reads their Price Alerts", "GET", "/price-alerts", undefined, 200],
    ["reads their Notifications", "GET", "/notifications", undefined, 200],
    ["reads the Price History of a Listing", "GET", `/listings/${HEADPHONES}/price-observations`, undefined, 200],
    ["reads their Account", "GET", "/accounts/me", undefined, 200],
  ] as const)("SC-23 / BR-08: the User %s", async (_what, method, url, payload, status) => {
    const { token } = await compose();
    expect((await call(method, url, token, payload)).statusCode).toBe(status);
  });

  it("SC-16: the owner of what the User creates is the identifier of their Account", async () => {
    const { token, userId } = await compose();
    await call("POST", `/listings/${HEADPHONES}/price-alerts`, token, { targetAmount: "80.00" });
    const [alert] = await application.alerts.all();
    expect(alert?.owner).toBe(userId);
    expect((await call("GET", "/accounts/me", token)).json().id).toBe(userId);
  });

  it("SC-23: each User sees only their own, as before: two Accounts, two Users", async () => {
    const { token: first } = await compose();
    const { token: second } = await signedInUser(application, "luis@example.com");
    await call("POST", `/listings/${HEADPHONES}/price-alerts`, first, { targetAmount: "80.00" });
    expect((await call("GET", "/price-alerts", first)).json().total).toBe(1);
    expect((await call("GET", "/price-alerts", second)).json().total).toBe(0);
  });
});

describe("SC-22 / BR-11: the credentials of a User and of a Provider are not interchangeable", () => {
  it("SC-22 / BR-11: the token of a User cannot record a Price Observation", async () => {
    const { token } = await compose();
    const response = await call("POST", `/listings/${HEADPHONES}/price-observations`, token, OBSERVE);
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHENTICATED");
  });

  it.each([
    ["read the Account of a User", "GET", "/accounts/me"],
    ["read the Price History", "GET", `/listings/${HEADPHONES}/price-observations`],
    ["read the Notifications", "GET", "/notifications"],
    ["read the Price Alerts", "GET", "/price-alerts"],
    ["sign out", "DELETE", "/sessions/current"],
  ] as const)("SC-22 / BR-11: the token of a Provider cannot %s", async (_what, method, url) => {
    await compose();
    expect((await call(method, url, PROVIDER_TOKEN)).statusCode).toBe(401);
  });

  it("SC-22 / BR-11: the token of a Provider cannot create a Price Alert", async () => {
    await compose();
    expect((await call("POST", `/listings/${HEADPHONES}/price-alerts`, PROVIDER_TOKEN, { targetAmount: "80.00" })).statusCode).toBe(401);
  });

  it("SC-22 / BR-11: the Provider still records with its own token", async () => {
    await compose();
    expect((await call("POST", `/listings/${HEADPHONES}/price-observations`, PROVIDER_TOKEN, OBSERVE)).statusCode).toBe(201);
  });
});

describe("the hash of passwords is chosen at the Composition Root", () => {
  it("uses the hasher it is given, to hash when registering and to check when signing in", async () => {
    const hasher = new FakeHasher();
    application = composeInMemoryApp({ passwordHasher: hasher });
    const before = hasher.hashes;
    await application.registerAccount.execute({ email: "ana@example.com", password: "first-password-1" });
    expect(hasher.hashes).toBe(before + 1);
    const verifications = hasher.verifications.length;
    await application.signIn.execute({ email: "ana@example.com", password: "first-password-1" });
    expect(hasher.verifications.length).toBe(verifications + 1);
  });
});

describe("SC-24 / BR-12: nothing fixed in the code identifies a User", () => {
  it.each(["demo-token-1", "demo-token-2", "token-1", "user-1", ""])("SC-24 / BR-12: %j identifies nobody", async (token) => {
    await compose();
    for (const [method, url] of [["GET", "/price-alerts"], ["GET", "/accounts/me"], ["GET", `/listings/${HEADPHONES}/price-observations`]] as const) {
      expect((await call(method, url, token === "" ? null : token)).statusCode).toBe(401);
    }
  });
});

describe("the life of a Session across the application (BR-07, BR-08, BR-09)", () => {
  it("SC-19 / BR-09: after signing out, the token stops opening everything a User can use", async () => {
    const { token } = await compose();
    expect((await call("DELETE", "/sessions/current", token)).statusCode).toBe(204);
    for (const [method, url] of [["GET", "/price-alerts"], ["GET", "/notifications"], ["GET", `/listings/${HEADPHONES}/price-observations`], ["GET", "/accounts/me"]] as const) {
      expect((await call(method, url, token)).statusCode).toBe(401);
    }
  });

  it("SC-18: after 7 days the token stops opening everything a User can use", async () => {
    const { token } = await compose();
    clock.advance(7 * DAY - 1);
    expect((await call("GET", "/price-alerts", token)).statusCode).toBe(200);
    clock.advance(1);
    for (const [method, url] of [["GET", "/price-alerts"], ["GET", "/notifications"], ["GET", `/listings/${HEADPHONES}/price-observations`]] as const) {
      expect((await call(method, url, token)).statusCode).toBe(401);
    }
  });

  it("SC-19: signing out with one token leaves the other Session of the Account open", async () => {
    const { token: first } = await compose();
    const second = (await application.signIn.execute({ email: "ana@example.com", password: "test-password-1" })).token;
    await call("DELETE", "/sessions/current", first);
    expect((await call("GET", "/price-alerts", first)).statusCode).toBe(401);
    expect((await call("GET", "/price-alerts", second)).statusCode).toBe(200);
  });

  it("the whole round trip over HTTP: register, sign in, create an alert, a price reaches it, read the Notification", async () => {
    await compose();
    const registered = await call("POST", "/accounts", null, { email: "eve@example.com", password: "eve-password-12" });
    const session = await call("POST", "/sessions", null, { email: "eve@example.com", password: "eve-password-12" });
    const token = session.json().token;
    expect((await call("POST", `/listings/${HEADPHONES}/price-alerts`, token, { targetAmount: "80.00" })).statusCode).toBe(201);
    const observed = await call("POST", `/listings/${HEADPHONES}/price-observations`, PROVIDER_TOKEN, { observedAt: "2026-11-19T10:00:00Z", price: { amount: "79.00", currency: "EUR" } });
    expect(observed.statusCode).toBe(201);
    const notifications = (await call("GET", "/notifications", token)).json();
    expect(notifications.total).toBe(1);
    expect(notifications.items[0].owner).toBe(registered.json().id);
  });
});
