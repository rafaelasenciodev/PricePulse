/**
 * The client of the API (feature 09), with a fake `fetch`. Each test names the scenario (SC-nn) or the rule (BR-nn)
 * of feature 09. That the client reads what the real application answers is checked in the tests of the backend.
 */

import { describe, expect, it } from "vitest";
import { createApiClient } from "../../src/api";
import { ALERT, ANA, HEADPHONES, answer, fakeFetch, json, noContent } from "./support";

const clientWith = (...replies: Parameters<typeof fakeFetch>) => {
  const fake = fakeFetch(...replies);
  return { client: createApiClient({ fetch: fake.fetch }), calls: fake.calls };
};
const headersOf = (init: RequestInit): Record<string, string> => Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>));

describe("signing in", () => {
  it("SC-03 / BR-03: gives the Account that the answer has", async () => {
    const { client } = clientWith(json({ token: "secret-token", expiresAt: "2026-11-26T10:00:00.000Z", account: ANA }, 201));
    expect(await client.signIn("ana@example.com", "first-password-1")).toEqual({ ok: true, data: ANA });
  });

  it("SC-07 / BR-01: does not copy the token: it is nowhere in what the client gives", async () => {
    const { client } = clientWith(json({ token: "secret-token", expiresAt: "x", account: { ...ANA, token: "another-secret" } }, 201));
    const result = await client.signIn("ana@example.com", "first-password-1");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("token");
  });

  it("SC-03: asks with POST /sessions and the email and the password as JSON", async () => {
    const { client, calls } = clientWith(json({ token: "t", account: ANA }, 201));
    await client.signIn("ana@example.com", "first-password-1");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe("/sessions");
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ email: "ana@example.com", password: "first-password-1" });
    expect(headersOf(calls[0]!.init)["content-type"]).toBe("application/json");
  });

  it("SC-04 / BR-03: an answer that the credentials are not valid is a failure with its status and code", async () => {
    const { client } = clientWith(answer(401, "INVALID_CREDENTIALS"));
    expect(await client.signIn("ana@example.com", "wrong")).toEqual({
      ok: false,
      failure: { kind: "answer", status: 401, code: "INVALID_CREDENTIALS", message: "a message for people who read the API" },
    });
  });

  it("SC-05 / BR-03: carries the seconds to wait from Retry-After", async () => {
    const { client } = clientWith(answer(429, "TOO_MANY_ATTEMPTS", "x", { "retry-after": "900" }));
    const result = await client.signIn("ana@example.com", "wrong");
    expect(result.ok === false && result.failure.kind === "answer" && result.failure.retryAfterSeconds).toBe(900);
  });

  it.each(["abc", "1.5", "-5", "", "Wed, 21 Oct 2026 07:28:00 GMT", "99999999999"])("SC-05: a Retry-After of %j is not read as seconds", async (value) => {
    const { client } = clientWith(answer(429, "TOO_MANY_ATTEMPTS", "x", value === "" ? {} : { "retry-after": value }));
    const result = await client.signIn("ana@example.com", "wrong");
    expect(result.ok === false && result.failure.kind === "answer" && "retryAfterSeconds" in result.failure).toBe(false);
  });

  it("SC-03: an answer that has no Account is not what the API gives", async () => {
    for (const body of [{ token: "t" }, { account: { id: "x" } }, { account: null }, [], "text", 7]) {
      const { client } = clientWith(json(body, 201));
      expect(await client.signIn("a@b.c", "p")).toEqual({ ok: false, failure: { kind: "unexpected" } });
    }
  });
});

describe("registering", () => {
  it("SC-08 / BR-04: gives the Account that was created, and only its identifier and email", async () => {
    const { client, calls } = clientWith(json({ ...ANA, passwordHash: "scrypt$x" }, 201));
    expect(await client.register("ana@example.com", "first-password-1")).toEqual({ ok: true, data: ANA });
    expect(calls[0]?.input).toBe("/accounts");
    expect(calls[0]?.init.method).toBe("POST");
  });

  it.each(["EMAIL_NOT_VALID", "PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG", "PASSWORD_IS_EMAIL"])(
    "SC-09 / BR-04: carries the reason %s of a registration that is not valid",
    async (reason) => {
      const { client } = clientWith(answer(422, "INVALID_REGISTRATION", "x", {}, reason));
      const result = await client.register("ana", "short");
      expect(result.ok === false && result.failure.kind === "answer" && result.failure.reason).toBe(reason);
    },
  );

  it.each([[undefined], [5], [null], [["EMAIL_NOT_VALID"]]])("SC-09: a reason that is %j, and so is not text, is not read", async (reason) => {
    const { client } = clientWith(answer(422, "INVALID_REGISTRATION", "x", {}, reason));
    const result = await client.register("ana", "short");
    expect(result.ok === false && result.failure.kind === "answer" && "reason" in result.failure).toBe(false);
  });

  it.each([
    [409, "EMAIL_ALREADY_REGISTERED"],
    [422, "INVALID_REGISTRATION"],
  ])("SC-09 / BR-04: an answer %i %s is a failure with its code", async (status, code) => {
    const { client } = clientWith(answer(status, code));
    const result = await client.register("ana", "short");
    expect(result.ok === false && result.failure.kind === "answer" && [result.failure.status, result.failure.code]).toEqual([status, code]);
  });
});

describe("signing out and reading the Account", () => {
  it("SC-12 / BR-05: signs out with DELETE /sessions/current and an answer with no body is a success", async () => {
    const { client, calls } = clientWith(noContent());
    expect(await client.signOut()).toEqual({ ok: true, data: null });
    expect(calls[0]?.input).toBe("/sessions/current");
    expect(calls[0]?.init.method).toBe("DELETE");
    expect(calls[0]?.init.body).toBeUndefined();
  });

  it("SC-13 / BR-05: a sign-out that gets no answer is a failure, not a success", async () => {
    const { client } = clientWith(new TypeError("Failed to fetch"));
    expect(await client.signOut()).toEqual({ ok: false, failure: { kind: "network" } });
  });

  it("SC-14 / BR-06: an answer that the Session is not valid is a failure with the status 401", async () => {
    const { client } = clientWith(answer(401, "UNAUTHENTICATED"));
    const result = await client.signOut();
    expect(result.ok === false && result.failure.kind === "answer" && result.failure.status).toBe(401);
  });

  it("asks for the Account with GET /accounts/me", async () => {
    const { client, calls } = clientWith(json(ANA));
    expect(await client.account()).toEqual({ ok: true, data: ANA });
    expect(calls[0]?.input).toBe("/accounts/me");
    expect(calls[0]?.init.method).toBe("GET");
  });
});

describe("reading the Catalogue", () => {
  const page = (items: unknown[], extra = {}) => ({ items, total: items.length, limit: 20, offset: 0, ...extra });

  it("SC-15 / BR-07: gives each Listing with its text and its Current Price and when it was observed", async () => {
    const { client } = clientWith(json(page([HEADPHONES])));
    expect(await client.listings({ limit: 20, offset: 0 })).toEqual({
      ok: true,
      data: { items: [HEADPHONES], total: 1, limit: 20, offset: 0 },
    });
  });

  it("SC-16 / BR-07: a Listing with no Current Price has null, and not zero or an empty price", async () => {
    const { client } = clientWith(json(page([{ ...HEADPHONES, currentPrice: null }])));
    const result = await client.listings({ limit: 20, offset: 0 });
    expect(result.ok && result.data.items[0]?.currentPrice).toBeNull();
  });

  it("SC-17 / BR-07: keeps the order of the answer", async () => {
    const ids = ["monitor-shop-a", "keyboard-shop-b", "headphones-shop-a", "headphones-shop-b"];
    const { client } = clientWith(json(page(ids.map((id) => ({ ...HEADPHONES, id })))));
    const result = await client.listings({ limit: 20, offset: 0 });
    expect(result.ok && result.data.items.map((l) => l.id)).toEqual(ids);
  });

  it.each([
    [{ limit: 20, offset: 0 }, "/listings?limit=20&offset=0"],
    [{ limit: 20, offset: 40 }, "/listings?limit=20&offset=40"],
    [{ limit: 100, offset: 0 }, "/listings?limit=100&offset=0"],
  ])("SC-18 / BR-07: asks for a page with %j as %s", async (query, address) => {
    const { client, calls } = clientWith(json(page([])));
    await client.listings(query);
    expect(calls[0]?.input).toBe(address);
  });

  it("SC-18: gives the total, so that a screen knows whether there is a next page", async () => {
    const { client } = clientWith(json(page([HEADPHONES], { total: 25, offset: 20 })));
    const result = await client.listings({ limit: 20, offset: 20 });
    expect(result.ok && [result.data.total, result.data.offset]).toEqual([25, 20]);
  });

  it.each([
    ["a body that is not a page", { listings: [] }],
    ["items that is not a list", page([], { items: "no" })],
    ["a Listing with a price that is a number", page([{ ...HEADPHONES, currentPrice: 100 }])],
    ["a Listing with no title", page([{ ...HEADPHONES, title: undefined }])],
    ["a current price with no moment", page([{ ...HEADPHONES, currentPrice: { amount: "1.00", currency: "EUR" } }])],
    ["a total that is not a number", page([], { total: "25" })],
    ["a negative offset", page([], { offset: -1 })],
    ["null", null],
  ])("is not what the API gives: %s", async (_what, body) => {
    const { client } = clientWith(json(body));
    expect(await client.listings({ limit: 20, offset: 0 })).toEqual({ ok: false, failure: { kind: "unexpected" } });
  });

  it("reads one Listing with GET, and writes an identifier so that it cannot change the address", async () => {
    const { client, calls } = clientWith(json(HEADPHONES));
    await client.listing("a/b?c=d e#f");
    expect(calls[0]?.input).toBe("/listings/a%2Fb%3Fc%3Dd%20e%23f");
  });

  it("SC-21: gives a Listing", async () => {
    const { client } = clientWith(json(HEADPHONES));
    expect(await client.listing("headphones-shop-a")).toEqual({ ok: true, data: HEADPHONES });
  });

  it("SC-22: a Listing that is not in the Catalogue is an answer 404", async () => {
    const { client } = clientWith(answer(404, "LISTING_NOT_FOUND"));
    const result = await client.listing("no-such-listing");
    expect(result.ok === false && result.failure.kind === "answer" && [result.failure.status, result.failure.code]).toEqual([404, "LISTING_NOT_FOUND"]);
  });
});

describe("creating a Price Alert", () => {
  it("writes the identifier of the Listing so that it cannot change the address", async () => {
    const { client, calls } = clientWith(json(ALERT, 201));
    await client.createAlert("a/b?c=d e#f", "80.00");
    expect(calls[0]?.input).toBe("/listings/a%2Fb%3Fc%3Dd%20e%23f/price-alerts");
  });

  it("SC-23 / BR-10: an answer 201 is a Price Alert that was created", async () => {
    const { client, calls } = clientWith(json(ALERT, 201));
    expect(await client.createAlert("headphones-shop-a", "80.00")).toEqual({ ok: true, data: { alert: ALERT, created: true } });
    expect(calls[0]?.input).toBe("/listings/headphones-shop-a/price-alerts");
    expect(calls[0]?.init.method).toBe("POST");
  });

  it("SC-24 / BR-10: an answer 200 is the one that already existed", async () => {
    const { client } = clientWith(json(ALERT, 200));
    const result = await client.createAlert("headphones-shop-a", "80.00");
    expect(result.ok && result.data.created).toBe(false);
  });

  it.each(["80.00", "80.5", "080.00", " 80.00", "80,00", "abc", "", "1e3", "0x10"])("SC-27 / BR-09: sends the amount %j as the text that it is, and not as a number", async (amount) => {
    const { client, calls } = clientWith(json(ALERT, 201));
    await client.createAlert("headphones-shop-a", amount);
    expect(String(calls[0]?.init.body)).toBe(JSON.stringify({ targetAmount: amount }));
    expect(typeof JSON.parse(String(calls[0]?.init.body)).targetAmount).toBe("string");
  });

  it.each([
    [409, "DUPLICATE_ALERT"],
    [409, "TARGET_ALREADY_REACHED"],
    [422, "INVALID_TARGET_PRICE"],
    [404, "LISTING_NOT_FOUND"],
  ])("SC-25 / SC-26 / BR-10: an answer %i %s is a failure with its code", async (status, code) => {
    const { client } = clientWith(answer(status, code));
    const result = await client.createAlert("headphones-shop-a", "80.00");
    expect(result.ok === false && result.failure.kind === "answer" && [result.failure.status, result.failure.code]).toEqual([status, code]);
  });

  it.each([
    ["a status that is not a state", { ...ALERT, status: "paused" }],
    ["no identifier", { ...ALERT, id: undefined }],
    ["an amount that is a number", { ...ALERT, targetAmount: 80 }],
  ])("is not what the API gives: %s", async (_what, body) => {
    const { client } = clientWith(json(body, 201));
    expect(await client.createAlert("headphones-shop-a", "80.00")).toEqual({ ok: false, failure: { kind: "unexpected" } });
  });
});

describe("what is never done (BR-01, BR-12)", () => {
  const everyOperation = (client: ReturnType<typeof createApiClient>) => [
    () => client.signIn("a@b.c", "p"),
    () => client.register("a@b.c", "p"),
    () => client.signOut(),
    () => client.account(),
    () => client.listings({ limit: 20, offset: 0 }),
    () => client.listing("x"),
    () => client.createAlert("x", "1.00"),
  ];

  it("SC-07 / BR-01: no request carries a header that names a credential, and every address is relative", async () => {
    const fake = fakeFetch(json({ token: "t", account: ANA }, 201));
    const client = createApiClient({ fetch: fake.fetch });
    for (const operation of everyOperation(client)) await operation();
    expect(fake.calls).toHaveLength(7);
    for (const { input, init } of fake.calls) {
      expect(input.startsWith("/") && !input.startsWith("//")).toBe(true);
      expect(Object.keys(headersOf(init)).map((h) => h.toLowerCase())).not.toContain("authorization");
      expect(init.credentials).toBe("same-origin");
    }
  });

  it("says that it sends JSON only when a request has a body", async () => {
    const fake = fakeFetch(json({ token: "t", account: ANA }, 201));
    const client = createApiClient({ fetch: fake.fetch });
    for (const operation of everyOperation(client)) await operation();
    const withBody = fake.calls.filter((c) => c.init.body !== undefined).map((c) => c.input);
    expect(withBody).toEqual(["/sessions", "/accounts", "/listings/x/price-alerts"]);
    for (const { init } of fake.calls) {
      expect("content-type" in headersOf(init)).toBe(init.body !== undefined);
      expect(headersOf(init)["accept"]).toBe("application/json");
    }
  });

  it("SC-07 / BR-01: it keeps nothing between calls: a second call does not carry what the first answered", async () => {
    const fake = fakeFetch(json({ token: "t-1", account: ANA }, 201), json(ANA));
    const client = createApiClient({ fetch: fake.fetch });
    await client.signIn("ana@example.com", "first-password-1");
    await client.account();
    expect(JSON.stringify(fake.calls[1])).not.toContain("t-1");
  });

  it.each([
    ["a fetch that rejects", new TypeError("Failed to fetch"), { kind: "network" }],
    ["a fetch that throws", () => { throw new Error("boom"); }, { kind: "network" }],
    ["a page of HTML with a 200", new Response("<html></html>", { status: 200 }), { kind: "unexpected" }],
    ["a page of HTML with a 500", new Response("<h1>Bad gateway</h1>", { status: 502 }), { kind: "unexpected" }],
    ["a 500 with no body", new Response(null, { status: 500 }), { kind: "unexpected" }],
    ["an error that has no code", json({ error: "nope" }, 500), { kind: "unexpected" }],
    ["an error whose code is not text", json({ code: 5, message: "x" }, 500), { kind: "unexpected" }],
    ["a body that is not JSON", new Response("not json", { status: 400, headers: { "content-type": "application/json" } }), { kind: "unexpected" }],
  ])("SC-30 / BR-12: %s is a failure that is a value, for every operation, and never throws", async (_what, reply, failure) => {
    for (const operation of everyOperation(createApiClient({ fetch: fakeFetch(reply as never).fetch }))) {
      await expect(operation()).resolves.toEqual({ ok: false, failure });
    }
  });

  it.each([
    ["a sign-out answered 200", () => clientWith(json({}, 200)).client.signOut()],
    ["a sign-in answered 200", () => clientWith(json({ token: "t", account: ANA }, 200)).client.signIn("a@b.c", "p")],
    ["a registration answered 200", () => clientWith(json(ANA, 200)).client.register("a@b.c", "p")],
    ["an Account answered 201", () => clientWith(json(ANA, 201)).client.account()],
    ["a Catalogue answered 201", () => clientWith(json({ items: [], total: 0, limit: 20, offset: 0 }, 201)).client.listings({ limit: 20, offset: 0 })],
    ["a Listing answered 201", () => clientWith(json(HEADPHONES, 201)).client.listing("x")],
    ["a Price Alert answered 202", () => clientWith(json(ALERT, 202)).client.createAlert("x", "1.00")],
  ])("BR-05 / BR-12: %s", async (_what, run) => {
    expect(await run()).toEqual({ ok: false, failure: { kind: "unexpected" } });
  });

  it("SC-30 / BR-12: an unexpected failure of the API is still an answer, with its code, for the texts to choose", async () => {
    const { client } = clientWith(answer(500, "INTERNAL_ERROR"));
    const result = await client.listings({ limit: 20, offset: 0 });
    expect(result.ok === false && result.failure.kind === "answer" && [result.failure.status, result.failure.code]).toEqual([500, "INTERNAL_ERROR"]);
  });
});
