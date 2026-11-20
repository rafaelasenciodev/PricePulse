/** The reset of the demo, in what needs no database (feature 12, SC-17 and the guard of BR-08). */

import { describe, expect, it } from "vitest";
import { ResetRefused, resetDemo } from "../../src/reset-demo";

const quiet = { info: () => {} };

describe("the reset of the demo refuses", () => {
  it("BR-08: without the demo mode, and the message says how to declare it", async () => {
    const error = await resetDemo({ DATABASE_URL: "postgres://u:p@127.0.0.1:1/db" }, quiet).catch((e) => e);
    expect(error).toBeInstanceOf(ResetRefused);
    expect(error.message).toMatch(/DEMO_MODE=true/);
  });

  it("BR-08: only the text `true` declares the demo mode", async () => {
    for (const value of ["false", "1", "TRUE", ""]) {
      const error = await resetDemo({ DEMO_MODE: value, DATABASE_URL: "postgres://u:p@127.0.0.1:1/db" }, quiet).catch((e) => e);
      expect(error).toBeInstanceOf(ResetRefused);
    }
  });

  it("BR-08: without a database address, and an empty one is none", async () => {
    for (const url of [undefined, ""]) {
      const error = await resetDemo({ DEMO_MODE: "true", DATABASE_URL: url }, quiet).catch((e) => e);
      expect(error).toBeInstanceOf(ResetRefused);
      expect(error.message).toMatch(/DATABASE_URL/);
    }
  });
});

describe("SC-17 / BR-08: the reset that cannot reach the database", () => {
  const environment = { DEMO_MODE: "true", DATABASE_URL: "postgres://someone:s3cr3t-pass@127.0.0.1:1/private_db" };

  it("ends with an error that says only the code of the failure", async () => {
    const error = await resetDemo(environment, quiet).catch((e) => e);
    expect(error).toBeInstanceOf(ResetRefused);
    expect(error.message).toMatch(/^Could not connect to the database \(\w+\)\.$/);
  });

  it("shows the password, the user and the address nowhere", async () => {
    const lines: string[] = [];
    const error = await resetDemo(environment, { info: (m) => lines.push(m) }).catch((e) => e);
    const everything = [error.message, error.stack ?? "", String(error.cause ?? ""), ...lines].join("\n");
    for (const secret of ["s3cr3t-pass", "someone", "127.0.0.1", "private_db"]) expect(everything).not.toContain(secret);
  });
});
