/** How the server chooses where to keep its data, without a database to reach (feature 11, SC-31 to SC-33). Whether production is refused is decided by the settings (feature 12).. */

import { describe, expect, it } from "vitest";
import { SettingsRefused, readSettings } from "../../src/settings";
import { StorageRefused, chooseStorage } from "../../src/storage";

const catching = (run: () => unknown): Error => {
  try {
    run();
  } catch (error) {
    return error as Error;
  }
  throw new Error("It did not throw");
};

const recorder = () => {
  const lines: string[] = [];
  return { lines, log: { info: (m: string) => lines.push(m), warn: (m: string) => lines.push(m) } };
};

describe("chooseStorage", () => {
  it("SC-31 / BR-10: without an address it runs in memory and says that what it stores is lost when it stops", async () => {
    const { lines, log } = recorder();
    const storage = await chooseStorage({}, log);
    expect(storage.description).toBe("memory");
    expect(lines.join("\n")).toMatch(/memory/);
    expect(lines.join("\n")).toMatch(/lost when the server stops/);
    const application = storage.compose({ onEvaluation: () => {} });
    await application.app.close();
    await storage.close();
  });

  it("SC-31 / BR-10: an address that is empty is no address", async () => {
    const storage = await chooseStorage({ DATABASE_URL: "" }, recorder().log);
    expect(storage.description).toBe("memory");
  });

  it("SC-32 / BR-10: production does not start without a database, and the message says why", () => {
    const error = catching(() => readSettings({ NODE_ENV: "production", DEMO_MODE: "true", WEB_ORIGIN: "https://demo.example" }));
    expect(error).toBeInstanceOf(SettingsRefused);
    expect(error.message).toMatch(/production/);
    expect(error.message).toMatch(/DATABASE_URL/);
  });

  describe("SC-33 / BR-10: a database that cannot be reached stops the server, and its password is not shown", () => {
    const url = "postgres://someone:s3cr3t-pass@127.0.0.1:1/private_db";

    it("says that it could not connect and gives the code of the failure", async () => {
      const { log } = recorder();
      const error = await chooseStorage({ DATABASE_URL: url }, log).catch((e) => e);
      expect(error).toBeInstanceOf(StorageRefused);
      expect(error.message).toMatch(/^Could not connect to the database \(\w+\)\.$/);
    });

    it("shows the password, the user and the address in no message and in no log", async () => {
      const { lines, log } = recorder();
      const error = await chooseStorage({ DATABASE_URL: url }, log).catch((e) => e);
      const everything = [error.message, error.stack ?? "", String(error.cause ?? ""), ...lines].join("\n");
      for (const secret of ["s3cr3t-pass", "someone", "127.0.0.1", "private_db"]) expect(everything).not.toContain(secret);
    });
  });

  it("refuses an address that is not that of a PostgreSQL database, without repeating it", async () => {
    const error = await chooseStorage({ DATABASE_URL: "mysql://u:hidden-secret@host/db" }, recorder().log).catch((e) => e);
    expect(error).toBeInstanceOf(StorageRefused);
    expect(error.message).not.toContain("hidden-secret");
    const garbage = await chooseStorage({ DATABASE_URL: "not a url hidden-secret" }, recorder().log).catch((e) => e);
    expect(garbage).toBeInstanceOf(StorageRefused);
    expect(garbage.message).not.toContain("hidden-secret");
  });
});
