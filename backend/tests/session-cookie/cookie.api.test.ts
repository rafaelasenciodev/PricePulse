/**
 * The Session cookie over HTTP (feature 08), through the whole application with real Accounts and Sessions:
 * setting it, being recognised by it in the four modules of Users, the check of the origin, signing out, and
 * what does not change. Each test names the scenario (SC-nn) or the rule (BR-nn) of feature 08.
 */

import type { LightMyRequestResponse } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { composeInMemoryApp } from "../../src/composition-root";
import { ProviderId } from "../../src/price-observations/domain";
import { ListingId } from "../../src/shared/domain";
import { MutableClock } from "../accounts/support/fakes";
import { DAY, START } from "../accounts/support/world";
import { FAST_HASHER } from "../support/accounts";

const ORIGIN = "http://app.example";
const HEADPHONES = ListingId("headphones-shop-a");
const KEYBOARD = ListingId("keyboard-shop-b");
const PROVIDER_TOKEN = "provider-token";
const PASSWORD = "first-password-1";
const CLEARED = "pricepulse_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict";
const FOREIGN_ORIGINS = ["http://evil.example", "http://app.example:3001", "https://app.example", "null"];

let application: ReturnType<typeof composeInMemoryApp>;
let clock: MutableClock;

afterEach(async () => {
  await application.app.close();
});

async function compose(options: { cookie?: false | { secure?: boolean }; apiDocs?: boolean } = {}) {
  clock = new MutableClock(START);
  const cookie = options.cookie === false ? undefined : { origin: ORIGIN, ...(options.cookie ?? {}) };
  application = composeInMemoryApp({
    clock,
    passwordHasher: FAST_HASHER,
    onEvaluation: () => {},
    ...(cookie ? { sessionCookie: cookie } : {}),
    ...(options.apiDocs ? { apiDocs: {} } : {}),
  });
  application.providerAuthenticator.addProvider(PROVIDER_TOKEN, ProviderId("simulator"));
  application.catalogue.addListing(HEADPHONES, "EUR", { title: "Wireless headphones", retailer: "Shop A" });
  application.catalogue.addListing(KEYBOARD, "EUR", { title: "Mechanical keyboard", retailer: "Shop B" });
  for (const listing of [HEADPHONES, KEYBOARD]) {
    await application.recordPriceObservation.execute({
      provider: ProviderId("simulator"),
      listingId: listing,
      observedAt: "2026-11-19T09:00:00Z",
      price: { amount: "100.00", currency: "EUR" },
    });
  }
  await application.registerAccount.execute({ email: "ana@example.com", password: PASSWORD });
  await application.registerAccount.execute({ email: "luis@example.com", password: PASSWORD });
}

interface Options {
  headers?: Record<string, string>;
  payload?: object;
}
const send = (method: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, { headers = {}, payload }: Options = {}) =>
  application.app.inject({ method, url, headers, ...(payload ? { payload } : {}) });

const signIn = (email = "ana@example.com", headers: Record<string, string> = {}) =>
  send("POST", "/sessions", { headers, payload: { email, password: PASSWORD } });
const setCookies = (response: LightMyRequestResponse): string[] => {
  const header = response.headers["set-cookie"];
  return header === undefined ? [] : Array.isArray(header) ? header : [header];
};
/** What the browser sends back: the name and the token of the cookie that an answer set. */
const cookieOf = (response: LightMyRequestResponse) => setCookies(response)[0]!.split(";")[0]!;
/** A person who signed in: the browser holds the cookie, and the body had the token. */
async function person(email = "ana@example.com") {
  const response = await signIn(email);
  return { cookie: cookieOf(response), token: response.json().token as string };
}
const fromApp = (cookie: string, extra: Record<string, string> = {}) => ({ cookie, origin: ORIGIN, ...extra });
const create = (listing: ListingId, headers: Record<string, string>) =>
  send("POST", `/listings/${listing}/price-alerts`, { headers, payload: { targetAmount: "80.00" } });

describe("setting the cookie", () => {
  it("SC-01 / BR-01 / BR-02: signing in sets the cookie with the token, and the body still has it", async () => {
    await compose();
    const response = await signIn();
    expect(response.statusCode).toBe(201);
    const [cookie] = setCookies(response);
    expect(setCookies(response)).toHaveLength(1);
    expect(cookie).toBe(`pricepulse_session=${response.json().token}; Max-Age=604800; Path=/; HttpOnly; SameSite=Strict`);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("SC-02 / BR-02: the cookie lasts the 7 days that the Session has, whenever the person signs in", async () => {
    await compose();
    expect(setCookies(await signIn())[0]).toContain("Max-Age=604800;");
    clock.advance(3 * DAY);
    expect(setCookies(await signIn())[0]).toContain("Max-Age=604800;");
  });

  it.each([
    [true, true],
    [false, false],
  ])("SC-03 / BR-02: with secure set to %s the cookie is marked as secure: %s", async (secure, marked) => {
    await compose({ cookie: { secure } });
    expect(/; Secure$/.test(setCookies(await signIn())[0]!)).toBe(marked);
  });

  it("SC-03: the cookie is not marked as secure unless it is said", async () => {
    await compose({ cookie: {} });
    expect(setCookies(await signIn())[0]).not.toContain("Secure");
  });

  it("SC-04 / BR-03: a sign-in that fails sets no cookie: a wrong password, an unknown email, a locked email, a bad body", async () => {
    await compose();
    const wrong = await send("POST", "/sessions", { payload: { email: "ana@example.com", password: "wrong-password-0" } });
    const unknown = await send("POST", "/sessions", { payload: { email: "ghost@example.com", password: PASSWORD } });
    const malformed = await send("POST", "/sessions", { payload: { email: "ana@example.com" } });
    expect([wrong.statusCode, unknown.statusCode, malformed.statusCode]).toEqual([401, 401, 400]);
    for (let i = 0; i < 5; i++) await send("POST", "/sessions", { payload: { email: "luis@example.com", password: "wrong-password-0" } });
    const locked = await signIn("luis@example.com");
    expect(locked.statusCode).toBe(429);
    for (const response of [wrong, unknown, malformed, locked]) expect(setCookies(response)).toEqual([]);
  });
});

describe("being recognised by the cookie", () => {
  it.each([
    ["their Account", "/accounts/me"],
    ["their Price Alerts", "/price-alerts"],
    ["their Notifications", "/notifications"],
    ["the Price History of a Listing", `/listings/${HEADPHONES}/price-observations`],
    ["the Catalogue", "/listings"],
  ])("SC-05 / BR-04: reads %s with the cookie and no header", async (_what, url) => {
    await compose();
    const { cookie } = await person();
    expect((await send("GET", url, { headers: { cookie } })).statusCode).toBe(200);
  });

  it("SC-05 / BR-04: it is the User of the Account that signed in", async () => {
    await compose();
    const { cookie } = await person("luis@example.com");
    expect((await send("GET", "/accounts/me", { headers: { cookie } })).json().email).toBe("luis@example.com");
  });

  it.each([
    ["pricepulse_session=TOKEN", 200],
    ["theme=dark; pricepulse_session=TOKEN; lang=en", 200],
    ["pricepulse_session=", 401],
    ["other_session=TOKEN", 401],
    ["pricepulse_session_old=TOKEN", 401],
  ])("SC-06 / BR-04: the cookie header %j is answered %i", async (header, status) => {
    await compose();
    const { token } = await person();
    expect((await send("GET", "/accounts/me", { headers: { cookie: header.replace("TOKEN", token) } })).statusCode).toBe(status);
  });

  it("SC-07 / BR-04: a Session that was signed out does not authenticate its cookie", async () => {
    await compose();
    const { cookie } = await person();
    expect((await send("DELETE", "/sessions/current", { headers: fromApp(cookie) })).statusCode).toBe(204);
    expect((await send("GET", "/accounts/me", { headers: { cookie } })).statusCode).toBe(401);
  });

  it("SC-07 / BR-04: nor does a Session that expired, or a value that nobody has", async () => {
    await compose();
    const { cookie } = await person();
    clock.advance(7 * DAY);
    expect((await send("GET", "/accounts/me", { headers: { cookie } })).statusCode).toBe(401);
    expect((await send("GET", "/accounts/me", { headers: { cookie: "pricepulse_session=nobody" } })).statusCode).toBe(401);
  });

  it("SC-08 / BR-05: when there is a header and a cookie, only the header is read", async () => {
    await compose();
    const ana = await person("ana@example.com");
    const luis = await person("luis@example.com");
    const response = await send("GET", "/accounts/me", { headers: { authorization: `Bearer ${luis.token}`, cookie: ana.cookie } });
    expect(response.json().email).toBe("luis@example.com");
  });

  it("SC-09 / BR-05: a header that is not valid is not replaced by the cookie", async () => {
    await compose();
    const { cookie } = await person();
    expect((await send("GET", "/accounts/me", { headers: { authorization: "Bearer nobody", cookie } })).statusCode).toBe(401);
    expect((await send("GET", "/accounts/me", { headers: { authorization: "Basic YW5hOnBhc3M=", cookie } })).statusCode).toBe(401);
  });
});

describe("the cookie never identifies a Provider", () => {
  const record = (headers: Record<string, string>) =>
    send("POST", `/listings/${HEADPHONES}/price-observations`, {
      headers,
      payload: { observedAt: "2026-11-19T10:00:00Z", price: { amount: "99.00", currency: "EUR" } },
    });

  it("SC-10 / BR-06: neither the credential of a Provider nor the token of a Session in the cookie records a price", async () => {
    await compose();
    const { token } = await person();
    for (const value of [PROVIDER_TOKEN, token]) {
      const response = await record(fromApp(`pricepulse_session=${value}`));
      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe("UNAUTHENTICATED");
    }
  });

  it("SC-10 / BR-06: and it is not refused for its origin either, since the route does not read the cookie", async () => {
    await compose();
    const response = await record({ cookie: `pricepulse_session=${PROVIDER_TOKEN}`, origin: "http://evil.example" });
    expect(response.statusCode).toBe(401);
  });

  it("SC-11 / BR-05 / BR-06: a Provider records with its credential in the header, whatever cookie comes with it", async () => {
    await compose();
    const { cookie } = await person();
    expect((await record({ authorization: `Bearer ${PROVIDER_TOKEN}`, cookie })).statusCode).toBe(201);
  });
});

describe("a change that the cookie authenticates must come from the application", () => {
  it("SC-12 / BR-07: is carried out from the application's origin: create, change a target, cancel and sign out", async () => {
    await compose();
    const { cookie } = await person();
    const created = await create(HEADPHONES, fromApp(cookie));
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    const changed = await send("PATCH", `/price-alerts/${id}`, { headers: fromApp(cookie), payload: { targetAmount: "70.00" } });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().targetAmount).toBe("70.00");
    const cancelled = await send("PATCH", `/price-alerts/${id}`, { headers: fromApp(cookie), payload: { status: "cancelled" } });
    expect(cancelled.json().status).toBe("cancelled");
    expect((await send("DELETE", "/sessions/current", { headers: fromApp(cookie) })).statusCode).toBe(204);
  });

  it.each([...FOREIGN_ORIGINS.map((o) => [`the origin ${o}`, o] as const), ["no origin", undefined] as const])(
    "SC-13 / BR-07: with %s it is refused, and nothing is created",
    async (_what, origin) => {
      await compose();
      const { cookie } = await person();
      const response = await create(HEADPHONES, { cookie, ...(origin === undefined ? {} : { origin }) });
      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe("FORBIDDEN_ORIGIN");
      expect(application.alerts.all()).toEqual([]);
    },
  );

  it("SC-13 / BR-07: it is refused for a change of a target and a cancellation too, and the alert stays as it was", async () => {
    await compose();
    const { cookie } = await person();
    const id = (await create(HEADPHONES, fromApp(cookie))).json().id;
    const foreign = { cookie, origin: "http://evil.example" };
    expect((await send("PATCH", `/price-alerts/${id}`, { headers: foreign, payload: { status: "cancelled" } })).statusCode).toBe(403);
    expect((await send("PATCH", `/price-alerts/${id}`, { headers: foreign, payload: { targetAmount: "10.00" } })).statusCode).toBe(403);
    const [alert] = application.alerts.all();
    expect([alert?.status, alert?.targetPrice.toDecimalString()]).toEqual(["active", "80.00"]);
  });

  it("SC-14 / BR-07: a sign-out that is refused leaves the Session, and does not clear the cookie", async () => {
    await compose();
    const { cookie } = await person();
    const response = await send("DELETE", "/sessions/current", { headers: { cookie, origin: "http://evil.example" } });
    expect(response.statusCode).toBe(403);
    expect(setCookies(response)).toEqual([]);
    expect((await send("GET", "/accounts/me", { headers: { cookie } })).statusCode).toBe(200);
  });

  it.each([undefined, ORIGIN, "http://evil.example", "null"])("SC-15 / BR-07: a read is answered with the origin %j", async (origin) => {
    await compose();
    const { cookie } = await person();
    for (const url of ["/price-alerts", "/accounts/me", "/listings"]) {
      const response = await send("GET", url, { headers: { cookie, ...(origin === undefined ? {} : { origin }) } });
      expect(response.statusCode).toBe(200);
    }
  });

  it("SC-15 / BR-07: a HEAD is a read too", async () => {
    await compose();
    const { cookie } = await person();
    expect((await send("HEAD", "/listings", { headers: { cookie, origin: "http://evil.example" } })).statusCode).toBe(200);
  });

  it.each([undefined, "http://evil.example", "null"])(
    "SC-16 / BR-07 / BR-11: a change that the header authenticates is carried out with the origin %j",
    async (origin) => {
      await compose();
      const { token } = await person();
      const listing = origin === undefined ? HEADPHONES : KEYBOARD;
      const response = await create(listing, { authorization: `Bearer ${token}`, ...(origin === undefined ? {} : { origin }) });
      expect(response.statusCode).toBe(201);
    },
  );
});

describe("signing in and registering from another origin (BR-08)", () => {
  it.each([...FOREIGN_ORIGINS])("SC-17: signing in with the origin %s is refused, with no cookie", async (origin) => {
    await compose();
    const response = await signIn("ana@example.com", { origin });
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("FORBIDDEN_ORIGIN");
    expect(setCookies(response)).toEqual([]);
  });

  it.each([...FOREIGN_ORIGINS])("SC-17: registering with the origin %s is refused, and no Account is created", async (origin) => {
    await compose();
    const response = await send("POST", "/accounts", { headers: { origin }, payload: { email: "eve@example.com", password: PASSWORD } });
    expect(response.statusCode).toBe(403);
    expect((await signIn("eve@example.com")).statusCode).toBe(401);
  });

  it.each([undefined, ORIGIN])("SC-18: signing in and registering with the origin %j are carried out", async (origin) => {
    await compose();
    const headers: Record<string, string> = origin === undefined ? {} : { origin };
    expect((await signIn("ana@example.com", headers)).statusCode).toBe(201);
    const registered = await send("POST", "/accounts", { headers, payload: { email: "eve@example.com", password: PASSWORD } });
    expect(registered.statusCode).toBe(201);
  });
});

describe("signing out", () => {
  it("SC-19 / BR-09: ends the Session and clears the cookie, and the next request with it is not authenticated", async () => {
    await compose();
    const { cookie } = await person();
    const response = await send("DELETE", "/sessions/current", { headers: fromApp(cookie) });
    expect(response.statusCode).toBe(204);
    expect(setCookies(response)).toEqual([CLEARED]);
    expect((await send("GET", "/accounts/me", { headers: { cookie } })).statusCode).toBe(401);
  });

  it("SC-19 / BR-09: the cleared cookie has the same name, path and attributes, and is secure when the other was", async () => {
    await compose({ cookie: { secure: true } });
    const signedIn = await signIn();
    const cookie = cookieOf(signedIn);
    const response = await send("DELETE", "/sessions/current", { headers: fromApp(cookie) });
    expect(setCookies(response)).toEqual([`${CLEARED}; Secure`]);
    expect(setCookies(signedIn)[0]!.split("; ").slice(2)).toEqual(setCookies(response)[0]!.split("; ").slice(2));
  });

  it("SC-20 / BR-09: signing out with the token in the header also clears the cookie", async () => {
    await compose();
    const { token, cookie } = await person();
    const response = await send("DELETE", "/sessions/current", { headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(204);
    expect(setCookies(response)).toEqual([CLEARED]);
    expect((await send("GET", "/accounts/me", { headers: { cookie } })).statusCode).toBe(401);
  });

  it("SC-21 / BR-09: a sign-out whose Session ended in another place answers 401 and clears the cookie", async () => {
    await compose();
    const { token, cookie } = await person();
    await send("DELETE", "/sessions/current", { headers: { authorization: `Bearer ${token}` } });
    const response = await send("DELETE", "/sessions/current", { headers: fromApp(cookie) });
    expect(response.statusCode).toBe(401);
    expect(setCookies(response)).toEqual([CLEARED]);
  });

  it("SC-21 / BR-09: so does one whose Session expired, and one with a value that nobody has", async () => {
    await compose();
    const { cookie } = await person();
    clock.advance(7 * DAY);
    for (const value of [cookie, "pricepulse_session=nobody"]) {
      const response = await send("DELETE", "/sessions/current", { headers: fromApp(value) });
      expect(response.statusCode).toBe(401);
      expect(setCookies(response)).toEqual([CLEARED]);
    }
  });

  it("SC-22 / BR-09: a request that is not authenticated, on another route, neither sets nor clears the cookie", async () => {
    await compose();
    const { cookie, token } = await person();
    await send("DELETE", "/sessions/current", { headers: { authorization: `Bearer ${token}` } });
    for (const url of ["/price-alerts", "/accounts/me", "/notifications", "/listings"]) {
      const response = await send("GET", url, { headers: { cookie } });
      expect(response.statusCode).toBe(401);
      expect(setCookies(response)).toEqual([]);
    }
  });
});

describe("what does not change", () => {
  it("SC-23 / BR-10: without the setting, signing in sets no cookie and a cookie authenticates nothing", async () => {
    await compose({ cookie: false });
    const response = await signIn();
    expect(response.statusCode).toBe(201);
    expect(setCookies(response)).toEqual([]);
    const cookie = `pricepulse_session=${response.json().token}`;
    expect((await send("GET", "/accounts/me", { headers: { cookie } })).statusCode).toBe(401);
    expect((await send("GET", "/price-alerts", { headers: { cookie } })).statusCode).toBe(401);
  });

  it("SC-23 / BR-10: and no origin is looked at: it behaves as it did", async () => {
    await compose({ cookie: false });
    expect((await signIn("ana@example.com", { origin: "http://evil.example" })).statusCode).toBe(201);
    const { token } = (await signIn()).json();
    expect((await create(HEADPHONES, { authorization: `Bearer ${token}`, origin: "http://evil.example" })).statusCode).toBe(201);
    const out = await send("DELETE", "/sessions/current", { headers: { authorization: `Bearer ${token}` } });
    expect(out.statusCode).toBe(204);
    expect(setCookies(out)).toEqual([]);
  });

  it("SC-24 / BR-11: a client that sends the token in the header works as it did, with the cookie on", async () => {
    await compose();
    const { token } = (await signIn()).json();
    const headers = { authorization: `Bearer ${token}` };
    const created = await create(HEADPHONES, headers);
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    const statuses = [
      (await send("GET", "/price-alerts", { headers })).statusCode,
      (await send("PATCH", `/price-alerts/${id}`, { headers, payload: { targetAmount: "70.00" } })).statusCode,
      (await send("PATCH", `/price-alerts/${id}`, { headers, payload: { status: "cancelled" } })).statusCode,
      (await send("GET", "/notifications", { headers })).statusCode,
      (await send("GET", "/listings", { headers })).statusCode,
      (await send("GET", `/listings/${HEADPHONES}/price-observations`, { headers })).statusCode,
      (await send("GET", "/accounts/me", { headers })).statusCode,
      (await send("DELETE", "/sessions/current", { headers })).statusCode,
    ];
    expect(statuses).toEqual([200, 200, 200, 200, 200, 200, 200, 204]);
  });
});

describe("the setting", () => {
  it("is written in its normal form, so the origin that the browser sends matches", async () => {
    clock = new MutableClock(START);
    application = composeInMemoryApp({ clock, passwordHasher: FAST_HASHER, onEvaluation: () => {}, sessionCookie: { origin: "http://APP.example/" } });
    await application.registerAccount.execute({ email: "ana@example.com", password: PASSWORD });
    expect((await signIn("ana@example.com", { origin: "http://app.example" })).statusCode).toBe(201);
  });

  it.each(["app.example", "ftp://app.example", "http://app.example/path", "", "http://user:pw@app.example"])(
    "an origin that is not one (%j) makes it throw when the application is built, not when a request comes",
    (origin) => {
      expect(() => composeInMemoryApp({ sessionCookie: { origin } })).toThrow(RangeError);
    },
  );
});

describe("the documentation", () => {
  it("documents the 403 on the routes that can be refused, with the code that is answered", async () => {
    await compose({ apiDocs: true });
    const spec = (await send("GET", "/docs/json")).json();
    const codes = (path: string, method: string) =>
      spec.paths[path][method].responses["403"].content["application/json"].schema.properties.code.enum;
    for (const [path, method] of [
      ["/accounts", "post"],
      ["/sessions", "post"],
      ["/sessions/current", "delete"],
      ["/listings/{listingId}/price-alerts", "post"],
      ["/price-alerts/{alertId}", "patch"],
    ] as const) {
      expect(codes(path, method)).toEqual(["FORBIDDEN_ORIGIN"]);
    }
    const { cookie } = await person();
    expect((await create(HEADPHONES, { cookie, origin: "http://evil.example" })).json().code).toBe("FORBIDDEN_ORIGIN");
  });

  it("describes the cookie in the description of the API and in the one of signing in", async () => {
    await compose({ apiDocs: true });
    const spec = (await send("GET", "/docs/json")).json();
    expect(spec.info.description).toContain("session cookie");
    expect(spec.paths["/sessions"].post.description).toContain("session cookie");
  });

  it("does not mention the cookie in the description of the API when it is off", async () => {
    await compose({ cookie: false, apiDocs: true });
    expect((await send("GET", "/docs/json")).json().info.description).not.toContain("session cookie");
  });
});
