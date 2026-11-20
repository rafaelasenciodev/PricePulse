// @vitest-environment node
/**
 * What no source file of the interface may mention (BR-01 of feature 09): the storage of the browser, its cookies
 * from a script, and a header that names a credential. And where a request may be made: only `src/api`.
 * Comments are read too, so a comment cannot hide what the code does.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = new URL("../src/", import.meta.url);

function walk(dir: URL, prefix = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const child = new URL(statSync(new URL(name, dir)).isDirectory() ? `${name}/` : name, dir);
    return statSync(child).isDirectory() ? walk(child, `${prefix}${name}/`) : /\.(ts|tsx|css|html)$/.test(name) ? [`${prefix}${name}`] : [];
  });
}

const files = walk(SRC).map((path) => ({ path, code: readFileSync(new URL(path, SRC), "utf8") }));

/** Whatever could hold or send the token of a Session, or a credential of any kind, outside the cookie that the browser manages. */
const FORBIDDEN: readonly [string, RegExp][] = [
  ["localStorage", /localStorage/],
  ["sessionStorage", /sessionStorage/],
  ["indexedDB", /indexedDB/i],
  ["document.cookie", /document\s*\.\s*cookie/],
  ["the Authorization header", /authorization/i],
  ["a bearer token", /\bbearer\b/i],
  ["the Cache API", /\bcaches\s*\./],
];

/** What can make a request. Only the client of the API may. */
const REQUESTS: readonly [string, RegExp][] = [
  ["fetch", /\bfetch\s*\(/],
  ["XMLHttpRequest", /XMLHttpRequest/],
  ["sendBeacon", /sendBeacon/],
  ["WebSocket", /\bWebSocket\b/],
  ["EventSource", /\bEventSource\b/],
];

describe("sources of the frontend", () => {
  it("there are source files to look at", () => {
    expect(files.length).toBeGreaterThan(3);
  });

  it.each(FORBIDDEN)("SC-07 / BR-01: no file mentions %s", (_name, pattern) => {
    expect(files.filter((f) => pattern.test(f.code)).map((f) => f.path)).toEqual([]);
  });

  it.each(REQUESTS)("SC-07 / BR-01: %s is used only in the client of the API", (_name, pattern) => {
    expect(files.filter((f) => !f.path.startsWith("api/") && pattern.test(f.code)).map((f) => f.path)).toEqual([]);
  });

  it("the client of the API does make its requests with the `fetch` that it is given", () => {
    const client = files.find((f) => f.path === "api/client.ts")?.code ?? "";
    expect(client).toMatch(/fetch:\s*send/);
    expect(client).toMatch(/await send\(/);
  });

  it("no page address carries a secret: no source builds an address from a token, a password or an email", () => {
    const risky = /(?:`|")\/[^`"]*\$\{[^}]*(?:token|password|email)[^}]*\}/i;
    expect(files.filter((f) => risky.test(f.code)).map((f) => f.path)).toEqual([]);
  });

  it.each([
    ["localStorage", "window.localStorage.setItem('a', 'b')"],
    ["sessionStorage", "sessionStorage.getItem('a')"],
    ["indexedDB", "indexedDB.open('x')"],
    ["document.cookie", "document . cookie = 'a=b'"],
    ["the Authorization header", "headers: { Authorization: token }"],
    ["a bearer token", "`Bearer ${token}`"],
    ["the Cache API", "await caches.open('x')"],
  ])("is able to see a violation: the pattern for %s matches what it is for, and only its own", (name, sample) => {
    const matching = FORBIDDEN.filter(([, pattern]) => pattern.test(sample)).map(([n]) => n);
    expect(matching).toContain(name);
  });

  it.each([
    ["fetch", "await fetch('/x')"],
    ["XMLHttpRequest", "new XMLHttpRequest()"],
    ["sendBeacon", "navigator.sendBeacon('/x')"],
    ["WebSocket", "new WebSocket('ws://x')"],
    ["EventSource", "new EventSource('/x')"],
  ])("is able to see a violation: the pattern for %s matches what it is for", (name, sample) => {
    expect(REQUESTS.filter(([, pattern]) => pattern.test(sample)).map(([n]) => n)).toContain(name);
  });

  it("the patterns do not match the ordinary words that the sources use", () => {
    const sample = "const token = 'x'; // the session cookie of the browser is managed by the browser; fetch is given";
    expect(FORBIDDEN.filter(([, pattern]) => pattern.test(sample)).map(([n]) => n)).toEqual([]);
    expect(REQUESTS.filter(([, pattern]) => pattern.test(sample)).map(([n]) => n)).toEqual([]);
  });
});
