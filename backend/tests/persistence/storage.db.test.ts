/** The server with a database: how it connects and where it keeps its data (feature 11, SC-30, SC-33 and SC-37). */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "../../src/database/connect";
import { StorageRefused, chooseStorage } from "../../src/storage";
import { TEST_DATABASE_URL, testPool, truncateAll } from "../support/database";
import { register } from "./support";

let pool: Pool;
beforeAll(async () => {
  pool = await testPool();
});
afterAll(async () => {
  await pool.end();
});
beforeEach(async () => {
  await truncateAll(pool);
});

describe("chooseStorage with a database", () => {
  it("SC-30 / BR-10: with an address it keeps its data in that database, and says which, without the password", async () => {
    const lines: string[] = [];
    const storage = await chooseStorage({ DATABASE_URL: TEST_DATABASE_URL }, { info: (m) => lines.push(m), warn: (m) => lines.push(m) });
    try {
      expect(storage.description).toBe("127.0.0.1:5433/pricepulse_test");
      expect(lines.join("\n")).toContain("127.0.0.1:5433/pricepulse_test");
      expect(lines.join("\n")).not.toMatch(/pricepulse:pricepulse/);

      const application = storage.compose({ onEvaluation: () => {} });
      expect((await register(application, "ana@example.com")).statusCode).toBe(201);
      await application.app.close();
      expect((await pool.query("SELECT email FROM accounts")).rows).toEqual([{ email: "ana@example.com" }]);
    } finally {
      await storage.close();
    }
  });

  it("SC-33 / BR-10: a server that answers but has no such database stops, and the password is not shown", async () => {
    const url = new URL(TEST_DATABASE_URL);
    url.pathname = "/no_such_database";
    const error = await chooseStorage({ DATABASE_URL: url.toString() }, { info: () => {}, warn: () => {} }).catch((e) => e);
    expect(error).toBeInstanceOf(StorageRefused);
    expect(error.message).toMatch(/Could not connect/);
    expect(error.message).not.toContain("no_such_database");
    expect(error.message).not.toContain("pricepulse");
  });

  it("applies the migrations when it starts, and leaves the schema as it was when it starts again", async () => {
    const first = await chooseStorage({ DATABASE_URL: TEST_DATABASE_URL }, { info: () => {}, warn: () => {} });
    await first.close();
    const lines: string[] = [];
    const second = await chooseStorage({ DATABASE_URL: TEST_DATABASE_URL }, { info: (m) => lines.push(m), warn: () => {} });
    await second.close();
    expect(lines.join("\n")).not.toMatch(/Applied the migrations/);
  });
});
