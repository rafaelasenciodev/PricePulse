/**
 * The two hooks of the Session cookie (feature 08), with a request of plain objects: every combination of
 * method, header, cookie and origin. Each test names the scenario (SC-nn) or the rule (BR-nn) of feature 08.
 */

import { describe, expect, it } from "vitest";
import {
  ForbiddenOrigin,
  publicOriginHook,
  sessionCookieHook,
  sharedHttpError,
  type CookieHookRequest,
} from "../../src/shared/http";

const SETTINGS = { origin: "http://app.example", secure: false };
const TOKEN = "tokenOfTheSession";
const COOKIE = `pricepulse_session=${TOKEN}`;

interface Headers {
  authorization?: string;
  cookie?: string;
  origin?: string;
}
const request = (method: string, headers: Headers): CookieHookRequest & { headers: Headers } => ({ method, headers: { ...headers } });
const run = async (method: string, headers: Headers) => {
  const req = request(method, headers);
  await sessionCookieHook(SETTINGS)(req);
  return req.headers;
};

describe("sessionCookieHook: a cookie and no header", () => {
  it.each(["GET", "HEAD"])("SC-05 / BR-04: a %s is given the header, with any origin or none", async (method) => {
    for (const origin of [undefined, "http://app.example", "http://evil.example", "null"]) {
      expect((await run(method, { cookie: COOKIE, ...(origin ? { origin } : {}) })).authorization).toBe(`Bearer ${TOKEN}`);
    }
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("SC-12 / BR-07: a %s from the application is given the header", async (method) => {
    expect((await run(method, { cookie: COOKIE, origin: "http://app.example" })).authorization).toBe(`Bearer ${TOKEN}`);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("SC-13 / BR-07: a %s that does not come from the application is refused", async (method) => {
    for (const origin of ["http://evil.example", "http://app.example:3001", "https://app.example", "null", ""]) {
      const req = request(method, { cookie: COOKIE, origin });
      await expect(sessionCookieHook(SETTINGS)(req)).rejects.toThrow(ForbiddenOrigin);
      expect(req.headers.authorization).toBeUndefined();
    }
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("SC-13 / BR-07: a %s with no origin is refused", async (method) => {
    const req = request(method, { cookie: COOKIE });
    await expect(sessionCookieHook(SETTINGS)(req)).rejects.toThrow(ForbiddenOrigin);
    expect(req.headers.authorization).toBeUndefined();
  });

  it("finds the cookie among others", async () => {
    expect((await run("GET", { cookie: `theme=dark; ${COOKIE}; lang=en` })).authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("BR-04: changes nothing else of the request", async () => {
    const headers = await run("GET", { cookie: COOKIE, origin: "http://app.example" });
    expect(headers).toEqual({ cookie: COOKIE, origin: "http://app.example", authorization: `Bearer ${TOKEN}` });
  });
});

describe("sessionCookieHook: a header", () => {
  it.each([
    ["a bearer token", `Bearer someOtherToken`],
    ["a token that nobody has", "Bearer nobody"],
    ["another scheme", "Basic YW5hOnBhc3M="],
    ["a bearer with no token", "Bearer"],
    ["an empty header", ""],
  ])("SC-08 / SC-09 / BR-05: with %s the cookie is not read and the header is not changed", async (_what, authorization) => {
    expect((await run("GET", { authorization, cookie: COOKIE })).authorization).toBe(authorization);
  });

  it("SC-16 / BR-07: a change that the header authenticates is not subject to the origin, and the cookie is not looked at", async () => {
    for (const origin of [undefined, "http://evil.example", "null"]) {
      const req = request("POST", { authorization: "Bearer someToken", cookie: COOKIE, ...(origin ? { origin } : {}) });
      await expect(sessionCookieHook(SETTINGS)(req)).resolves.toBeUndefined();
      expect(req.headers.authorization).toBe("Bearer someToken");
    }
  });
});

describe("sessionCookieHook: no cookie that can be a token", () => {
  it.each([
    ["no cookie header", undefined],
    ["other cookies only", "theme=dark"],
    ["an empty value", "pricepulse_session="],
    ["another name", `other_session=${TOKEN}`],
    ["a name that only starts the same", `pricepulse_session_old=${TOKEN}`],
    ["a value that cannot be a token", "pricepulse_session=a b"],
  ])("SC-06 / BR-04: with %s the request is left as it is, and it is not refused for its origin", async (_what, cookie) => {
    for (const method of ["GET", "POST", "DELETE"]) {
      const req = request(method, { ...(cookie === undefined ? {} : { cookie }), origin: "http://evil.example" });
      await expect(sessionCookieHook(SETTINGS)(req)).resolves.toBeUndefined();
      expect(req.headers.authorization).toBeUndefined();
    }
  });
});

describe("sessionCookieHook: the setting", () => {
  it("compares with the origin that it is given", async () => {
    const req = request("POST", { cookie: COOKIE, origin: "http://127.0.0.1:3000" });
    await expect(sessionCookieHook({ origin: "http://127.0.0.1:3000", secure: false })(req)).resolves.toBeUndefined();
    expect(req.headers.authorization).toBe(`Bearer ${TOKEN}`);
    await expect(sessionCookieHook(SETTINGS)(request("POST", { cookie: COOKIE, origin: "http://127.0.0.1:3000" }))).rejects.toThrow(ForbiddenOrigin);
  });
});

describe("publicOriginHook", () => {
  const check = (origin?: string) => publicOriginHook(SETTINGS)(request("POST", origin === undefined ? {} : { origin }));

  it.each([undefined, "http://app.example"])("SC-18 / BR-08: goes on with %j", async (origin) => {
    await expect(check(origin)).resolves.toBeUndefined();
  });

  it.each(["http://evil.example", "http://app.example:3001", "https://app.example", "null", ""])(
    "SC-17 / BR-08: refuses the origin %j",
    async (origin) => {
      await expect(check(origin)).rejects.toThrow(ForbiddenOrigin);
    },
  );

  it("does not look at the method, nor at a cookie or a header", async () => {
    const req = request("POST", { authorization: "Bearer x", cookie: COOKIE });
    await expect(publicOriginHook(SETTINGS)(req)).resolves.toBeUndefined();
    expect(req.headers.authorization).toBe("Bearer x");
  });
});

describe("the answer to a refused origin", () => {
  it("SC-13 / SC-17: is 403 FORBIDDEN_ORIGIN, and says nothing of the request", () => {
    expect(sharedHttpError(new ForbiddenOrigin())).toEqual({
      status: 403,
      code: "FORBIDDEN_ORIGIN",
      message: "The request does not come from the application",
    });
  });

  it.each([new Error("x"), new TypeError("y"), "a text", null, undefined])("is no answer for another error: %j", (error) => {
    expect(sharedHttpError(error)).toBeNull();
  });
});
