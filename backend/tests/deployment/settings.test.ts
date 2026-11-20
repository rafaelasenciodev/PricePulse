/** What the environment says about how the server runs (feature 12, SC-01 to SC-03, SC-07 to SC-09, SC-19 and SC-20). */

import { describe, expect, it } from "vitest";
import { SettingsRefused, readSettings } from "../../src/settings";

const catching = (run: () => unknown): Error => {
  try {
    run();
  } catch (error) {
    return error as Error;
  }
  throw new Error("It did not throw");
};

const production = {
  NODE_ENV: "production",
  DEMO_MODE: "true",
  DATABASE_URL: "postgres://u:p@db.example:5432/pricepulse",
  WEB_ORIGIN: "https://demo.example",
} as const;

describe("readSettings: production", () => {
  it("SC-01 / BR-01: production without the demo mode is refused, and the message says why", () => {
    const { DEMO_MODE: _demo, ...withoutDemo } = production;
    const error = catching(() => readSettings(withoutDemo));
    expect(error).toBeInstanceOf(SettingsRefused);
    expect(error.message).toMatch(/production/);
    expect(error.message).toMatch(/passwords are public/);
  });

  it("SC-01 / BR-01: only the text `true` declares the demo mode", () => {
    for (const value of ["false", "1", "TRUE", "yes", ""]) {
      expect(catching(() => readSettings({ ...production, DEMO_MODE: value }))).toBeInstanceOf(SettingsRefused);
    }
  });

  it("SC-02 / BR-01: production declared a demo is accepted", () => {
    const settings = readSettings(production);
    expect(settings).toMatchObject({ production: true, demo: true, origin: "https://demo.example" });
  });

  it("SC-19 / BR-10: in production a database address is needed, and an empty one is none", () => {
    for (const databaseUrl of [undefined, ""]) {
      const error = catching(() => readSettings({ ...production, DATABASE_URL: databaseUrl }));
      expect(error).toBeInstanceOf(SettingsRefused);
      expect(error.message).toMatch(/DATABASE_URL/);
    }
  });

  it("SC-20 / BR-11: in production the origin of the application is needed, and an empty one is none", () => {
    for (const origin of [undefined, ""]) {
      const error = catching(() => readSettings({ ...production, WEB_ORIGIN: origin }));
      expect(error).toBeInstanceOf(SettingsRefused);
      expect(error.message).toMatch(/WEB_ORIGIN/);
    }
  });

  it("SC-01 / BR-01: the refusal for the demo mode comes first", () => {
    const error = catching(() => readSettings({ NODE_ENV: "production" }));
    expect(error.message).toMatch(/DEMO_MODE/);
  });
});

describe("readSettings: outside production", () => {
  it("SC-03 / BR-01: nothing needs to be declared, and the server is the development server", () => {
    expect(readSettings({})).toEqual({
      production: false,
      demo: false,
      host: "127.0.0.1",
      port: 3000,
      origin: "http://127.0.0.1:3000",
      secureCookie: false,
      databaseUrl: undefined,
    });
  });

  it("SC-03 / BR-01: a database address is not needed, and neither is the origin", () => {
    expect(() => readSettings({ NODE_ENV: "development" })).not.toThrow();
  });
});

describe("readSettings: address", () => {
  it("SC-07 / BR-04: without an address the server listens on the local machine only", () => {
    expect(readSettings({}).host).toBe("127.0.0.1");
    expect(readSettings({ HOST: "" }).host).toBe("127.0.0.1");
  });

  it("SC-08 / BR-04: it listens on the address that it is told", () => {
    expect(readSettings({ HOST: "0.0.0.0" }).host).toBe("0.0.0.0");
  });

  it("the port is the one given, and 3000 when it is not a port", () => {
    expect(readSettings({ PORT: "10000" }).port).toBe(10000);
    for (const port of ["", "abc", "0", "-5", "3.5"]) expect(readSettings({ PORT: port }).port).toBe(3000);
  });
});

describe("readSettings: origin and cookie", () => {
  it.each([
    ["https://demo.example", true],
    ["HTTPS://Demo.Example", true],
    ["http://127.0.0.1:3000", false],
    ["http://localhost:5173", false],
  ])("SC-09 / BR-05: the origin %s makes the cookie Secure: %s", (origin, secure) => {
    expect(readSettings({ WEB_ORIGIN: origin }).secureCookie).toBe(secure);
  });

  it("without an origin it is where the server listens, with its port", () => {
    expect(readSettings({ PORT: "4000" }).origin).toBe("http://127.0.0.1:4000");
  });

  it("an origin that is not an address is refused, without a path", () => {
    for (const origin of ["not a url", "ftp://demo.example", "https://demo.example/app"]) {
      const error = catching(() => readSettings({ WEB_ORIGIN: origin }));
      expect(error).toBeInstanceOf(SettingsRefused);
      expect(error.message).toMatch(/^WEB_ORIGIN is not valid/);
    }
  });
});
