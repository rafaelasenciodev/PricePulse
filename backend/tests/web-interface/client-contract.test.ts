/**
 * The client of the interface (frontend/src/api) against the real application, listening on a port of its own
 * (decision 13 of the design of feature 09). If the API changes what it answers, or the client expects something
 * that the API does not give, a test here breaks. Each test names the scenario (SC-nn) or the rule (BR-nn).
 *
 * The `fetch` that the client is given imitates what a browser does for a page of the application: it keeps the
 * cookie that an answer sets, sends it back, and adds the `Origin` of the page to a request that is not a read.
 * That a real browser does the same is not tested here: it is SC-36, checked by hand.
 */

import { createServer } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiClient, type ApiClient, type FetchLike } from "../../../frontend/src/api";
import { FAST_SCRYPT_PARAMETERS, ScryptPasswordHasher } from "../../src/accounts/adapters";
import { composeInMemoryApp } from "../../src/composition-root";
import { ProviderId } from "../../src/price-observations/domain";
import { ListingId } from "../../src/shared/domain";

const PASSWORD = "first-password-1";

let application: ReturnType<typeof composeInMemoryApp>;
let base: string;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

/** A browser for one person: it holds the cookie, and says where the page it is on comes from. */
function browser(options: { sendsOrigin?: boolean } = {}): FetchLike {
  let cookie: string | null = null;
  return async (input, init) => {
    const headers = new Headers(init.headers as HeadersInit);
    if (cookie !== null) headers.set("cookie", cookie);
    const method = (init.method ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD" && options.sendsOrigin !== false) headers.set("origin", base);
    const response = await fetch(base + input, { ...init, headers, redirect: "manual" });
    for (const setCookie of response.headers.getSetCookie()) {
      const [pair = ""] = setCookie.split(";");
      const [name, value = ""] = pair.split("=");
      if (name === "pricepulse_session") cookie = value === "" ? null : `${name}=${value}`;
    }
    return response;
  };
}

const person = (options?: { sendsOrigin?: boolean }): ApiClient => createApiClient({ fetch: browser(options) });

beforeAll(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  application = composeInMemoryApp({
    passwordHasher: new ScryptPasswordHasher(FAST_SCRYPT_PARAMETERS),
    onEvaluation: () => {},
    sessionCookie: { origin: base },
  });
  application.providerAuthenticator.addProvider("provider-token", ProviderId("simulator"));
  const listings: [string, string, string, string, string | null][] = [
    ["monitor-shop-a", "27-inch monitor", "Shop A", "EUR", null],
    ["keyboard-shop-b", "Mechanical keyboard", "Shop B", "USD", "50.00"],
    ["headphones-shop-a", "Wireless headphones", "Shop A", "EUR", "100.00"],
  ];
  for (const [id, title, retailer, currency, price] of listings) {
    application.catalogue.addListing(ListingId(id), currency, { title, retailer });
    await application.recordPriceObservation.execute({
      provider: ProviderId("simulator"),
      listingId: ListingId(id),
      observedAt: "2026-11-19T09:00:00Z",
      price: price === null ? null : { amount: price, currency },
    });
  }
  for (const email of ["ana@example.com", "luis@example.com", "lock@example.com", "out@example.com", "alerts@example.com"]) {
    await application.registerAccount.execute({ email, password: PASSWORD });
  }
  await application.app.listen({ port, host: "127.0.0.1" });
});

afterAll(async () => {
  await application.app.close();
});

describe("signing in and out", () => {
  it("SC-03 / BR-03: signs in and is then recognised by the cookie alone", async () => {
    const ana = person();
    const signedIn = await ana.signIn("ana@example.com", PASSWORD);
    expect(signedIn.ok && signedIn.data.email).toBe("ana@example.com");
    const account = await ana.account();
    expect(account).toEqual(signedIn);
  });

  it("SC-07 / BR-01: what the client gives has no token, although the application sends one", async () => {
    const result = await person().signIn("ana@example.com", PASSWORD);
    expect(JSON.stringify(result)).not.toMatch(/token|expiresAt|scrypt|hash/i);
    expect(Object.keys(result.ok ? result.data : {}).sort()).toEqual(["email", "id"]);
  });

  it("SC-04 / BR-03: a wrong password and an email that has no Account are the same answer", async () => {
    const wrong = await person().signIn("ana@example.com", "wrong-password-0");
    const unknown = await person().signIn("ghost@example.com", PASSWORD);
    for (const result of [wrong, unknown]) {
      expect(result.ok === false && result.failure.kind === "answer" && [result.failure.status, result.failure.code]).toEqual([401, "INVALID_CREDENTIALS"]);
    }
  });

  it("SC-05 / BR-03: a locked email carries the seconds to wait", async () => {
    const attacker = person();
    for (let i = 0; i < 5; i++) await attacker.signIn("lock@example.com", "wrong-password-0");
    const locked = await person().signIn("lock@example.com", PASSWORD);
    expect(locked.ok === false && locked.failure.kind === "answer" && [locked.failure.status, locked.failure.code, locked.failure.retryAfterSeconds]).toEqual([
      429,
      "TOO_MANY_ATTEMPTS",
      900,
    ]);
  });

  it("SC-12 / BR-05: signing out is confirmed, and the cookie is then not a Session", async () => {
    const out = person();
    await out.signIn("out@example.com", PASSWORD);
    expect(await out.signOut()).toEqual({ ok: true, data: null });
    const after = await out.account();
    expect(after.ok === false && after.failure.kind === "answer" && [after.failure.status, after.failure.code]).toEqual([401, "UNAUTHENTICATED"]);
  });

  it("SC-14 / BR-06: a Session that ended in another place is an answer 401 UNAUTHENTICATED, on every read", async () => {
    const first = person();
    await first.signIn("luis@example.com", PASSWORD);
    // The same Account signs in from another place and signs out, which ends only that Session.
    // A cookie that the application does not know gives the 401 of a Session that ended.
    const stranger = createApiClient({ fetch: async (input, init) => fetch(base + input, { ...init, headers: { ...(init.headers as object), cookie: "pricepulse_session=nobody" } }) });
    for (const result of [await stranger.account(), await stranger.listings({ limit: 20, offset: 0 }), await stranger.listing("headphones-shop-a")]) {
      expect(result.ok === false && result.failure.kind === "answer" && [result.failure.status, result.failure.code]).toEqual([401, "UNAUTHENTICATED"]);
    }
  });
});

describe("registering", () => {
  it("SC-08 / BR-04: registers an Account, which does not sign the person in", async () => {
    const eve = person();
    const registered = await eve.register("eve@example.com", PASSWORD);
    expect(registered.ok && registered.data.email).toBe("eve@example.com");
    const account = await eve.account();
    expect(account.ok).toBe(false);
  });

  it("SC-09 / BR-04: an email that is registered is an answer 409 EMAIL_ALREADY_REGISTERED", async () => {
    const again = await person().register("ana@example.com", PASSWORD);
    expect(again.ok === false && again.failure.kind === "answer" && [again.failure.status, again.failure.code]).toEqual([409, "EMAIL_ALREADY_REGISTERED"]);
  });

  it.each([
    ["an email that is not one", "eve2", PASSWORD, "EMAIL_NOT_VALID"],
    ["a password that is too short", "eve3@example.com", "short", "PASSWORD_TOO_SHORT"],
    ["a password that is too long", "eve4@example.com", "x".repeat(129), "PASSWORD_TOO_LONG"],
    ["a password that is the email", "eve5@example.com", "eve5@example.com", "PASSWORD_IS_EMAIL"],
  ])("SC-09 / BR-04: %s is an answer 422 INVALID_REGISTRATION with the reason %s", async (_what, email, password, reason) => {
    const result = await person().register(email, password);
    expect(result.ok === false && result.failure.kind === "answer" && [result.failure.status, result.failure.code, result.failure.reason]).toEqual([
      422,
      "INVALID_REGISTRATION",
      reason,
    ]);
  });
});

describe("the Catalogue", () => {
  it("SC-15 / SC-16 / SC-17 / BR-07: gives the Listings in the order of the API, with a price or with null", async () => {
    const ana = person();
    await ana.signIn("ana@example.com", PASSWORD);
    const result = await ana.listings({ limit: 20, offset: 0 });
    expect(result.ok && result.data.items.map((l) => l.id)).toEqual(["monitor-shop-a", "keyboard-shop-b", "headphones-shop-a"]);
    expect(result.ok && result.data.items.map((l) => l.currentPrice?.amount ?? null)).toEqual([null, "50.00", "100.00"]);
    expect(result.ok && result.data.items[2]).toEqual({
      id: "headphones-shop-a",
      title: "Wireless headphones",
      retailer: "Shop A",
      currency: "EUR",
      currentPrice: { amount: "100.00", currency: "EUR", observedAt: "2026-11-19T09:00:00.000Z" },
    });
  });

  it("SC-18 / BR-07: a page of 2 says the total, and the next one has the rest", async () => {
    const ana = person();
    await ana.signIn("ana@example.com", PASSWORD);
    const first = await ana.listings({ limit: 2, offset: 0 });
    const second = await ana.listings({ limit: 2, offset: 2 });
    expect(first.ok && [first.data.items.length, first.data.total, first.data.offset]).toEqual([2, 3, 0]);
    expect(second.ok && [second.data.items.length, second.data.total, second.data.offset]).toEqual([1, 3, 2]);
  });

  it("SC-21: reads one Listing, the same view as the list", async () => {
    const ana = person();
    await ana.signIn("ana@example.com", PASSWORD);
    const list = await ana.listings({ limit: 20, offset: 0 });
    const one = await ana.listing("keyboard-shop-b");
    expect(one.ok).toBe(true);
    expect(list.ok).toBe(true);
    if (one.ok && list.ok) expect(one.data).toEqual(list.data.items[1]);
  });

  it("SC-22: a Listing that is not in the Catalogue is an answer 404 LISTING_NOT_FOUND", async () => {
    const ana = person();
    await ana.signIn("ana@example.com", PASSWORD);
    const result = await ana.listing("no-such-listing");
    expect(result.ok === false && result.failure.kind === "answer" && [result.failure.status, result.failure.code]).toEqual([404, "LISTING_NOT_FOUND"]);
  });

  it("SC-14 / BR-06: without signing in, the Catalogue is an answer 401", async () => {
    const result = await person().listings({ limit: 20, offset: 0 });
    expect(result.ok === false && result.failure.kind === "answer" && result.failure.status).toBe(401);
  });
});

describe("creating a Price Alert", () => {
  async function signedIn(email = "alerts@example.com") {
    const client = person();
    await client.signIn(email, PASSWORD);
    return client;
  }
  const code = (result: Awaited<ReturnType<ApiClient["createAlert"]>>) =>
    result.ok === false && result.failure.kind === "answer" ? [result.failure.status, result.failure.code] : result.ok ? "ok" : result.failure.kind;

  it("SC-23 / BR-10: a target that the price does not reach creates the Price Alert", async () => {
    const client = await signedIn("ana@example.com");
    const result = await client.createAlert("keyboard-shop-b", "40.00");
    expect(result.ok && result.data.created).toBe(true);
    expect(result.ok && [result.data.alert.listingId, result.data.alert.targetAmount, result.data.alert.currency, result.data.alert.status]).toEqual([
      "keyboard-shop-b",
      "40.00",
      "USD",
      "active",
    ]);
  });

  it("SC-24 / BR-10: asking again for the same alert gives the one that existed", async () => {
    const client = await signedIn("luis@example.com");
    const first = await client.createAlert("headphones-shop-a", "80.00");
    const second = await client.createAlert("headphones-shop-a", "80.00");
    expect(first.ok && first.data.created).toBe(true);
    expect(second.ok && second.data.created).toBe(false);
    expect(first.ok && second.ok && second.data.alert.id).toBe(first.ok && first.data.alert.id);
  });

  it("SC-25 / BR-10: another target for a Listing that has an Active alert is a Conflict", async () => {
    const client = await signedIn("out@example.com");
    await client.createAlert("headphones-shop-a", "80.00");
    expect(code(await client.createAlert("headphones-shop-a", "70.00"))).toEqual([409, "DUPLICATE_ALERT"]);
  });

  it.each(["100.00", "120.00"])("SC-25 / BR-10: a target of %s, which the Current Price of 100.00 already reaches, is a Conflict", async (amount) => {
    const client = await signedIn();
    expect(code(await client.createAlert("headphones-shop-a", amount))).toEqual([409, "TARGET_ALREADY_REACHED"]);
  });

  it.each(["abc", "0", "-5", "80.001", "80,00", "", "1e3"])("SC-26 / BR-09: the amount %j, sent as it is, is an answer 422 INVALID_TARGET_PRICE", async (amount) => {
    const client = await signedIn();
    expect(code(await client.createAlert("keyboard-shop-b", amount))).toEqual([422, "INVALID_TARGET_PRICE"]);
  });

  it("SC-27 / BR-09: an amount written as 80.50 is stored as the text that was sent", async () => {
    const client = await signedIn("alerts@example.com");
    const result = await client.createAlert("monitor-shop-a", "80.50");
    expect(result.ok && result.data.alert.targetAmount).toBe("80.50");
  });

  it("SC-22: a Listing that is not in the Catalogue is a 404", async () => {
    const client = await signedIn();
    expect(code(await client.createAlert("no-such-listing", "10.00"))).toEqual([404, "LISTING_NOT_FOUND"]);
  });
});

describe("what the check of the origin needs from a page (SC-36)", () => {
  it("BR-01: a change from a page that does not send its Origin is refused, which is why a browser must (that it does is checked by hand)", async () => {
    const client = person({ sendsOrigin: false });
    const signedIn = await client.signIn("ana@example.com", PASSWORD);
    // Signing in with no Origin is accepted: it is what a program does. What is refused is a change with the cookie alone.
    expect(signedIn.ok).toBe(true);
    const refused = await client.createAlert("monitor-shop-a", "10.00");
    expect(refused.ok === false && refused.failure.kind === "answer" && [refused.failure.status, refused.failure.code]).toEqual([403, "FORBIDDEN_ORIGIN"]);
  });
});
