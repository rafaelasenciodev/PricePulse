/**
 * The application serving the web interface (feature 09, group `webInterface`): the redirect from `/`, the page for the
 * addresses of the interface, the files with their type, the folder that nothing leaves, and the headers of `/app/`.
 * The folder of the build is imitated with a temporary one. Each test names the scenario (SC-nn) of the feature.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { composeInMemoryApp } from "../../src/composition-root";
import { FAST_HASHER } from "../support/accounts";

const PAGE = "<!doctype html><title>PricePulse page</title>";
const SECRET = "SECRET-OUTSIDE-THE-FOLDER";

let workDir: string;
let root: string;
let application: ReturnType<typeof composeInMemoryApp>;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "pricepulse-web-"));
  root = join(workDir, "dist");
  mkdirSync(join(root, "assets"), { recursive: true });
  writeFileSync(join(root, "index.html"), PAGE);
  writeFileSync(join(root, "assets", "index-abc123.js"), "console.log('hello');");
  writeFileSync(join(root, "assets", "index-abc123.css"), "body { margin: 0; }");
  // A file next to the folder of the interface, which no address may reach.
  writeFileSync(join(workDir, "secret.txt"), SECRET);
});

afterAll(() => rmSync(workDir, { recursive: true, force: true }));

afterEach(async () => {
  await application.app.close();
});

function compose(options: { withInterface?: boolean } = {}) {
  application = composeInMemoryApp({
    passwordHasher: FAST_HASHER,
    apiDocs: {},
    ...(options.withInterface === false ? {} : { webInterface: { root } }),
  });
  return application.app;
}

const get = (url: string, method: "GET" | "HEAD" | "POST" = "GET") => compose().inject({ method, url });
const isPage = (body: string) => body === PAGE;

describe("SC-31: the root leads to the interface", () => {
  it("SC-31: redirects / to /app/ with a temporary redirect", async () => {
    const response = await get("/");
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("/app/");
  });
});

describe("/app without the slash", () => {
  it("leads to /app/, as / does, and not to an unknown route", async () => {
    const response = await get("/app");
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("/app/");
  });
});

describe("SC-32: the page of the interface and the addresses of the API", () => {
  it.each(["/app/", "/app/listings/headphones-shop-a", "/app/an/address/that/is/not/one", "/app/catalogue?page=2"])(
    "SC-32: %s is answered with the page of the interface",
    async (url) => {
      const response = await get(url);
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toMatch(/text\/html/);
      expect(isPage(response.body)).toBe(true);
    },
  );

  it("SC-32: a HEAD under /app/ is answered too", async () => {
    expect((await get("/app/catalogue", "HEAD")).statusCode).toBe(200);
  });

  it.each([
    ["/listings", 401],
    ["/accounts/me", 401],
    ["/address-that-is-not-a-route", 404],
  ])("SC-32: %s is the answer of the API, never the page", async (url, status) => {
    const response = await get(url);
    expect(response.statusCode).toBe(status);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(isPage(response.body)).toBe(false);
  });

  it("SC-32: only a GET or a HEAD gets the page: another method under /app/ is a 404", async () => {
    const response = await get("/app/catalogue", "POST");
    expect(response.statusCode).toBe(404);
    expect(isPage(response.body)).toBe(false);
  });
});

describe("SC-33: the files of the interface", () => {
  it("SC-33: serves a script as JavaScript and a style sheet as CSS", async () => {
    const script = await get("/app/assets/index-abc123.js");
    expect(script.statusCode).toBe(200);
    expect(script.headers["content-type"]).toMatch(/javascript/);
    const style = await get("/app/assets/index-abc123.css");
    expect(style.statusCode).toBe(200);
    expect(style.headers["content-type"]).toMatch(/text\/css/);
  });

  it.each(["/app/assets/missing.js", "/app/missing.css"])("SC-33: %s does not exist, and is not the page", async (url) => {
    const response = await get(url);
    expect(response.statusCode).toBe(404);
    expect(isPage(response.body)).toBe(false);
  });
});

describe("SC-34: nothing outside the folder is served", () => {
  it.each([
    "/app/../secret.txt",
    "/app/%2e%2e/secret.txt",
    "/app/..%2fsecret.txt",
    "/app/assets/../../secret.txt",
    "/app/%00",
    "/app/assets/%2e%2e/%2e%2e/secret.txt",
  ])("SC-34: %s serves no file of outside, and is a refusal or the page", async (url) => {
    const response = await get(url);
    expect(response.body).not.toContain(SECRET);
    expect(response.statusCode === 200 ? isPage(response.body) : [400, 403, 404].includes(response.statusCode)).toBe(true);
  });
});

describe("SC-35: without the interface", () => {
  it("SC-35: /app/ and / are unknown routes, as before the feature", async () => {
    const app = compose({ withInterface: false });
    for (const url of ["/app", "/app/", "/app/catalogue", "/"]) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({ code: "NOT_FOUND", message: "Route not found" });
    }
  });

  it("has none of the headers of the interface", async () => {
    const response = await compose({ withInterface: false }).inject({ method: "GET", url: "/listings" });
    expect(response.headers["content-security-policy"]).toBeUndefined();
  });
});

describe("headers of /app/ (decisions 9 and 11 of the design)", () => {
  it.each(["/app/", "/app/assets/index-abc123.js", "/app/missing.js"])("%s carries nosniff, the referrer policy and the content security policy", async (url) => {
    const { headers } = await get(url);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("same-origin");
    expect(headers["content-security-policy"]).toBe("default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  });

  it("the API and the documentation page do not get them", async () => {
    const app = compose();
    for (const url of ["/listings", "/docs/"]) {
      const { headers } = await app.inject({ method: "GET", url });
      expect(headers["content-security-policy"]).toBeUndefined();
      expect(headers["x-content-type-options"]).toBeUndefined();
    }
  });

  it("the page is asked for again each time, and the files with a hash in their name live for a year", async () => {
    const app = compose();
    expect((await app.inject({ method: "GET", url: "/app/" })).headers["cache-control"]).toBe("no-cache");
    expect((await app.inject({ method: "GET", url: "/app/catalogue" })).headers["cache-control"]).toBe("no-cache");
    expect((await app.inject({ method: "GET", url: "/app/assets/index-abc123.js" })).headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
  });
});
