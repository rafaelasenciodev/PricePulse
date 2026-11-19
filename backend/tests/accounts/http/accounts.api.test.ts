/**
 * Accounts over HTTP: the four routes, their answers and their validation. The rules are tested in
 * the use cases and the stores. Here: that the answer is the one it should be, that what is not valid
 * is rejected, that a secret is never repeated, and that a request that is not authenticated is refused.
 */

import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildAccountsApp } from "../support/api";
import type { MutableClock } from "../support/fakes";
import { DAY, MINUTE } from "../support/world";

const ANA = { email: "ana@example.com", password: "first-password-1" };

let app: FastifyInstance;
let clock: MutableClock;
beforeEach(() => {
  ({ app, clock } = buildAccountsApp());
});
afterEach(async () => {
  await app.close();
});

const post = (url: string, payload: unknown, headers: Record<string, string> = {}) =>
  app.inject({ method: "POST", url, payload: payload as object, headers });
const register = (body: unknown = ANA) => post("/accounts", body);
const signIn = (body: unknown = ANA) => post("/sessions", body);
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
const me = (headers: Record<string, string> = {}) => app.inject({ method: "GET", url: "/accounts/me", headers });
const signOut = (headers: Record<string, string> = {}) => app.inject({ method: "DELETE", url: "/sessions/current", headers });

async function tokenOfNewSession(): Promise<string> {
  await register();
  return (await signIn()).json().token;
}

describe("POST /accounts", () => {
  it("SC-01: answers 201 with the identifier and the email, and nothing else", async () => {
    const response = await register();
    expect(response.statusCode).toBe(201);
    expect(Object.keys(response.json()).sort()).toEqual(["email", "id"]);
    expect(response.json().email).toBe("ana@example.com");
  });

  it("SC-01 / BR-04: the answer does not contain the password or anything made from it", async () => {
    const body = (await register()).body;
    expect(body).not.toContain("first-password-1");
    expect(body).not.toMatch(/scrypt|hash/i);
  });

  it("SC-01: needs no token, and does not sign the person in", async () => {
    await register();
    expect((await me()).statusCode).toBe(401);
  });

  it("SC-02: an email that differs only in case or spaces is answered 409 EMAIL_ALREADY_REGISTERED", async () => {
    await register();
    const response = await register({ email: "  ANA@Example.com ", password: "another-password-2" });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it.each([
    ["SC-04", { email: "ana@example.com", password: "x".repeat(9) }],
    ["SC-04", { email: "ana@example.com", password: "x".repeat(129) }],
    ["SC-05", { email: "ana@example.com", password: "ana@example.com" }],
    ["SC-06", { email: "", password: "first-password-1" }],
    ["SC-06", { email: "ana", password: "first-password-1" }],
    ["SC-06", { email: "ana@@example.com", password: "first-password-1" }],
  ])("%s: %j is answered 422 INVALID_REGISTRATION", async (_sc, body) => {
    const response = await register(body);
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe("INVALID_REGISTRATION");
  });

  it.each([
    ["no body", undefined],
    ["a missing password", { email: "ana@example.com" }],
    ["a missing email", { password: "first-password-1" }],
    ["a number as the password", { email: "ana@example.com", password: 1234567890 }],
    ["a field that is not in the schema", { ...ANA, role: "admin" }],
    ["an email of more than 1024 characters", { email: `${"a".repeat(1025)}@example.com`, password: "first-password-1" }],
  ])("is answered 400 BAD_REQUEST with %s", async (_what, body) => {
    const response = await post("/accounts", body);
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("BAD_REQUEST");
  });

  it("a body that is not JSON is answered 400", async () => {
    const response = await app.inject({ method: "POST", url: "/accounts", payload: "{nope", headers: { "content-type": "application/json" } });
    expect(response.statusCode).toBe(400);
  });
});

describe("POST /sessions", () => {
  beforeEach(async () => {
    await register();
  });

  it("SC-07: answers 201 with the token, when it ends and the Account", async () => {
    const response = await signIn();
    expect(response.statusCode).toBe(201);
    const { token, expiresAt, account } = response.json();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(expiresAt).toBe(new Date(Date.parse("2026-11-19T10:00:00Z") + 7 * DAY).toISOString());
    expect(account.email).toBe("ana@example.com");
    expect(Object.keys(response.json()).sort()).toEqual(["account", "expiresAt", "token"]);
  });

  it("SC-07: the answer is not kept by caches, because it carries a secret", async () => {
    expect((await signIn()).headers["cache-control"]).toBe("no-store");
  });

  it("SC-07: the token is not shown again by anything the system answers afterwards", async () => {
    const token = (await signIn()).json().token;
    expect((await me(bearer(token))).body).not.toContain(token);
  });

  it("SC-08: reads the email the same way as registering", async () => {
    expect((await signIn({ email: "  ANA@Example.com ", password: ANA.password })).statusCode).toBe(201);
  });

  it("SC-10: each sign-in gives a different token, and both identify the Account", async () => {
    const [a, b] = [(await signIn()).json().token, (await signIn()).json().token];
    expect(a).not.toBe(b);
    expect((await me(bearer(a))).statusCode).toBe(200);
    expect((await me(bearer(b))).statusCode).toBe(200);
  });

  it("SC-09: a wrong password and an email that nobody registered get the same answer", async () => {
    const wrong = await signIn({ email: "ana@example.com", password: "wrong-password-0" });
    const unknown = await signIn({ email: "ghost@example.com", password: "first-password-1" });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
    expect(wrong.json().code).toBe("INVALID_CREDENTIALS");
  });

  it("SC-11: after 5 failures it answers 429 with the seconds to wait, also with the right password", async () => {
    for (let i = 0; i < 5; i++) await signIn({ email: "ana@example.com", password: "wrong-password-0" });
    const response = await signIn();
    expect(response.statusCode).toBe(429);
    expect(response.json().code).toBe("TOO_MANY_ATTEMPTS");
    expect(response.headers["retry-after"]).toBe("900");
  });

  it("SC-25: of 30 wrong sign-ins at the same time, 5 are answered 401 and 25 are answered 429", async () => {
    const responses = await Promise.all(
      Array.from({ length: 30 }, () => signIn({ email: "ana@example.com", password: "wrong-password-0" })),
    );
    expect(responses.filter((r) => r.statusCode === 401)).toHaveLength(5);
    expect(responses.filter((r) => r.statusCode === 429)).toHaveLength(25);
    expect((await signIn()).statusCode).toBe(429);
  });

  it("SC-13: 15 minutes after the fifth failure it signs in again", async () => {
    for (let i = 0; i < 5; i++) await signIn({ email: "ana@example.com", password: "wrong-password-0" });
    clock.advance(15 * MINUTE);
    expect((await signIn()).statusCode).toBe(201);
  });

  it.each([
    ["a missing password", { email: "ana@example.com" }],
    ["a missing email", { password: "first-password-1" }],
    ["a password that is not text", { email: "ana@example.com", password: ["x"] }],
    ["an unknown field", { ...ANA, remember: true }],
    ["a password of more than 1024 characters", { email: "ana@example.com", password: "x".repeat(1025) }],
  ])("is answered 400 BAD_REQUEST with %s, which counts as no attempt", async (_what, body) => {
    expect((await signIn(body)).statusCode).toBe(400);
    for (let i = 0; i < 4; i++) await signIn({ email: "ana@example.com", password: "wrong-password-0" });
    expect((await signIn()).statusCode).toBe(201);
  });

  it("a password longer than the maximum of registering is not a bad request but a wrong password", async () => {
    expect((await signIn({ email: "ana@example.com", password: "x".repeat(500) })).statusCode).toBe(401);
  });
});

describe("GET /accounts/me", () => {
  it("SC-21: answers 200 with the identifier and the email, and nothing of the password", async () => {
    const token = await tokenOfNewSession();
    const response = await me(bearer(token));
    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.json()).sort()).toEqual(["email", "id"]);
    expect(response.body).not.toContain("first-password-1");
    expect(response.body).not.toMatch(/scrypt|hash/i);
  });

  it("SC-16: is the Account of the Session of the token", async () => {
    const id = (await register()).json().id;
    const token = (await signIn()).json().token;
    expect((await me(bearer(token))).json().id).toBe(id);
  });

  it("SC-17: answers 401 UNAUTHENTICATED without a token, with one that nobody has, or in another scheme", async () => {
    await tokenOfNewSession();
    for (const headers of [{}, bearer("no-such-token"), { authorization: "Basic YW5hOnBhc3M=" }, { authorization: "Bearer" }]) {
      const response = await me(headers);
      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe("UNAUTHENTICATED");
    }
  });

  it("reads the word Bearer in any case", async () => {
    const token = await tokenOfNewSession();
    expect((await me({ authorization: `bearer ${token}` })).statusCode).toBe(200);
  });

  it.each([
    [7 * DAY - MINUTE, 200],
    [7 * DAY, 401],
  ])("SC-18: %i ms after the sign-in the token answers %i", async (elapsed, status) => {
    const token = await tokenOfNewSession();
    clock.advance(elapsed);
    expect((await me(bearer(token))).statusCode).toBe(status);
  });
});

describe("DELETE /sessions/current", () => {
  it("SC-19: answers 204, and that token stops working while the other still does", async () => {
    await register();
    const [first, second] = [(await signIn()).json().token, (await signIn()).json().token];
    const response = await signOut(bearer(first));
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect((await me(bearer(first))).statusCode).toBe(401);
    expect((await me(bearer(second))).statusCode).toBe(200);
  });

  it("SC-20: signing out again with the same token answers 401", async () => {
    const token = await tokenOfNewSession();
    await signOut(bearer(token));
    const response = await signOut(bearer(token));
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHENTICATED");
  });

  it("SC-17: without a token, or with one that nobody has, answers 401 and ends nothing", async () => {
    const token = await tokenOfNewSession();
    expect((await signOut()).statusCode).toBe(401);
    expect((await signOut(bearer("no-such-token"))).statusCode).toBe(401);
    expect((await me(bearer(token))).statusCode).toBe(200);
  });

  it("SC-18: an expired Session cannot sign out", async () => {
    const token = await tokenOfNewSession();
    clock.advance(7 * DAY);
    expect((await signOut(bearer(token))).statusCode).toBe(401);
  });
});

describe("the documentation of the routes", () => {
  it("lists the four routes, tagged, and only the ones that need a token ask for it", async () => {
    const { app: documented } = buildAccountsApp({ apiDocs: true });
    try {
      const spec = (await documented.inject({ method: "GET", url: "/docs/json" })).json();
      const op = (path: string, method: string) => spec.paths[path][method];
      expect(op("/accounts", "post").tags).toEqual(["Accounts"]);
      expect(op("/sessions", "post").tags).toEqual(["Sessions"]);
      expect(op("/sessions/current", "delete").tags).toEqual(["Sessions"]);
      expect(op("/accounts/me", "get").tags).toEqual(["Accounts"]);
      expect(op("/accounts", "post").security).toBeUndefined();
      expect(op("/sessions", "post").security).toBeUndefined();
      expect(op("/sessions/current", "delete").security).toEqual([{ bearerAuth: [] }]);
      expect(op("/accounts/me", "get").security).toEqual([{ bearerAuth: [] }]);
      expect(spec.tags.map((t: { name: string }) => t.name)).toEqual(expect.arrayContaining(["Accounts", "Sessions"]));
      expect(Object.keys(op("/sessions", "post").responses).sort()).toEqual(["201", "400", "401", "429", "500"]);
    } finally {
      await documented.close();
    }
  });
});
