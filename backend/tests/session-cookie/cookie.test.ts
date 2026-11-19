/**
 * The pure functions of the Session cookie (feature 08): reading it from a `Cookie` header, writing it for a
 * `Set-Cookie` header, the normal form of an origin and the comparison of one. Each test names the scenario
 * (SC-nn) or the rule (BR-nn) of feature 08.
 */

import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE_NAME,
  isRead,
  normalizeOrigin,
  originMatches,
  readSessionCookie,
  serializeClearedSessionCookie,
  serializeSessionCookie,
} from "../../src/shared/http";

const TOKEN = "abcDEF123_-xyz";

describe("readSessionCookie", () => {
  it("the name of the cookie is pricepulse_session", () => {
    expect(SESSION_COOKIE_NAME).toBe("pricepulse_session");
  });

  it.each([
    [`pricepulse_session=${TOKEN}`, TOKEN],
    [`theme=dark; pricepulse_session=${TOKEN}; lang=en`, TOKEN],
    [`pricepulse_session=${TOKEN}; theme=dark`, TOKEN],
    [`  pricepulse_session = ${TOKEN}  `, TOKEN],
    [`a=b;pricepulse_session=${TOKEN}`, TOKEN],
    ["pricepulse_session=abc.def~ghi+jkl/mno==", "abc.def~ghi+jkl/mno=="],
  ])("SC-06 / BR-04: reads the token from %j", (header, token) => {
    expect(readSessionCookie(header)).toBe(token);
  });

  it.each([
    [undefined, "no header"],
    ["", "an empty header"],
    ["pricepulse_session=", "an empty value"],
    ["pricepulse_session", "a name with no value"],
    [`other_session=${TOKEN}`, "another name"],
    [`pricepulse_session_old=${TOKEN}`, "a longer name that starts the same"],
    [`xpricepulse_session=${TOKEN}`, "a longer name that ends the same"],
    [`Pricepulse_Session=${TOKEN}`, "the name in other capitals"],
    ["theme=dark; lang=en", "other cookies only"],
  ])("SC-06 / BR-04: reads no token from %j (%s)", (header, _what) => {
    expect(readSessionCookie(header)).toBeNull();
  });

  it.each([
    ['pricepulse_session="abc"', "a value in quotes"],
    ["pricepulse_session=ab cd", "a value with a space"],
    ["pricepulse_session=ab,cd", "a value with a comma"],
    ["pricepulse_session=ab=cd", "an equals sign in the middle"],
    ["pricepulse_session==abc", "an equals sign at the start"],
    ["pricepulse_session=abc\u0000def", "a control character"],
    ["pricepulse_session=ünï", "characters that are not ASCII"],
    [`pricepulse_session=${"a".repeat(513)}`, "a value of more than 512 characters"],
  ])("BR-04: a value that cannot be a token is no token: %j (%s)", (header, _what) => {
    expect(readSessionCookie(header)).toBeNull();
  });

  it("BR-04: a value of 512 characters is read", () => {
    expect(readSessionCookie(`pricepulse_session=${"a".repeat(512)}`)).toBe("a".repeat(512));
  });

  it("when the name is there twice the first is read, and it is not replaced by the second if it is not valid", () => {
    expect(readSessionCookie(`pricepulse_session=first; pricepulse_session=second`)).toBe("first");
    expect(readSessionCookie(`pricepulse_session=not valid; pricepulse_session=second`)).toBeNull();
  });

  it("a pair with no equals sign is skipped, and the cookie that comes after it is found", () => {
    expect(readSessionCookie(`garbage; pricepulse_session=${TOKEN}`)).toBe(TOKEN);
  });
});

describe("serializeSessionCookie", () => {
  it("SC-01 / BR-01 / BR-02: sets the token for every path, out of reach of scripts and of other sites, for the seconds that are given", () => {
    expect(serializeSessionCookie(TOKEN, { maxAgeSeconds: 604800, secure: false })).toBe(
      `pricepulse_session=${TOKEN}; Max-Age=604800; Path=/; HttpOnly; SameSite=Strict`,
    );
  });

  it("SC-03 / BR-02: is marked as secure only when it is told to", () => {
    expect(serializeSessionCookie(TOKEN, { maxAgeSeconds: 10, secure: true })).toMatch(/; Secure$/);
    expect(serializeSessionCookie(TOKEN, { maxAgeSeconds: 10, secure: false })).not.toMatch(/Secure/);
  });

  it("SC-02 / BR-02: a life of zero is allowed", () => {
    expect(serializeSessionCookie(TOKEN, { maxAgeSeconds: 0, secure: false })).toContain("Max-Age=0;");
  });

  it.each([
    ["a token with a space", "ab cd"],
    ["a token with a semicolon, which would add an attribute", "abc; Domain=evil.example"],
    ["a token with a line break, which would add a header", "abc\r\nSet-Cookie: other=1"],
    ["an empty token", ""],
    ["a token that is too long", "a".repeat(513)],
  ])("refuses %s", (_what, token) => {
    expect(() => serializeSessionCookie(token, { maxAgeSeconds: 10, secure: false })).toThrow(RangeError);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("refuses a life of %s seconds", (maxAgeSeconds) => {
    expect(() => serializeSessionCookie(TOKEN, { maxAgeSeconds, secure: false })).toThrow(RangeError);
  });
});

describe("serializeClearedSessionCookie", () => {
  it("SC-19 / BR-09: removes the cookie: the same name, path and attributes, an empty value and a life of zero", () => {
    expect(serializeClearedSessionCookie({ secure: false })).toBe("pricepulse_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict");
    expect(serializeClearedSessionCookie({ secure: true })).toBe("pricepulse_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict; Secure");
  });

  it.each([true, false])("SC-19 / BR-09: has the attributes of the cookie that it removes (secure: %s)", (secure) => {
    const attributesOf = (cookie: string) => cookie.split("; ").slice(2).join("; ");
    expect(attributesOf(serializeClearedSessionCookie({ secure }))).toBe(attributesOf(serializeSessionCookie(TOKEN, { maxAgeSeconds: 10, secure })));
  });
});

describe("normalizeOrigin", () => {
  it.each([
    ["http://127.0.0.1:3000", "http://127.0.0.1:3000"],
    ["http://localhost:5173", "http://localhost:5173"],
    ["https://App.Example", "https://app.example"],
    ["https://app.example/", "https://app.example"],
    ["http://app.example:80", "http://app.example"],
    ["https://app.example:443", "https://app.example"],
  ])("writes %j as %j", (text, normal) => {
    expect(normalizeOrigin(text)).toBe(normal);
  });

  it.each([
    "",
    "app.example",
    "//app.example",
    "ftp://app.example",
    "javascript:alert(1)",
    "http://",
    "http://app.example/path",
    "http://app.example/?q=1",
    "http://app.example/#fragment",
    "http://user:secret@app.example",
  ])("refuses %j, so a wrong setting is found when the application starts", (text) => {
    expect(() => normalizeOrigin(text)).toThrow(RangeError);
  });
});

describe("originMatches", () => {
  const expected = "http://app.example";

  it("SC-12 / BR-07: matches the origin of the application", () => {
    expect(originMatches("http://app.example", expected)).toBe(true);
    expect(originMatches("http://APP.example", expected)).toBe(true);
  });

  it.each([
    ["no origin", undefined],
    ["another host", "http://evil.example"],
    ["another port of the same host", "http://app.example:3001"],
    ["another scheme of the same host", "https://app.example"],
    ["null, which a browser sends in some cases", "null"],
    ["the origin with a path", "http://app.example/"],
    ["a host that only starts the same", "http://app.example.evil.example"],
    ["a host that ends the same", "http://evilapp.example"],
    ["an empty origin", ""],
  ])("SC-13 / BR-07: does not match %s", (_what, header) => {
    expect(originMatches(header, expected)).toBe(false);
  });
});

describe("isRead", () => {
  it.each(["GET", "HEAD", "get", "head"])("BR-07: %s is a read", (method) => {
    expect(isRead(method)).toBe(true);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "post"])("BR-07: %s is a change", (method) => {
    expect(isRead(method)).toBe(false);
  });
});
