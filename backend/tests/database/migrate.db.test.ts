import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATIONS_DIRECTORY, migrate } from "../../src/database/migrate";
import { withScratchDatabase } from "../support/database";

/** A folder with the given steps: file name -> SQL. */
function steps(files: Record<string, string>): string {
  const directory = mkdtempSync(join(tmpdir(), "pricepulse-migrations-"));
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(directory, name), sql);
  return directory;
}

const CREATE_A = "CREATE TABLE a (n integer); INSERT INTO a VALUES (1);";
const CREATE_B = "CREATE TABLE b (n integer);";

describe("the migrations", () => {
  it("SC-34 an empty database gets every step, in order, and each one is recorded", async () => {
    await withScratchDatabase(async (pool) => {
      const applied = await migrate(pool, steps({ "0001-a.sql": CREATE_A, "0002-b.sql": CREATE_B, "0003-c.sql": "CREATE TABLE c (n integer);" }));
      expect(applied).toEqual(["0001-a", "0002-b", "0003-c"]);
      const { rows } = await pool.query("SELECT version, name FROM schema_migrations ORDER BY version");
      expect(rows).toEqual([
        { version: 1, name: "a" },
        { version: 2, name: "b" },
        { version: 3, name: "c" },
      ]);
    });
  });

  it("SC-35 a step that was applied is not applied again, and the data stays", async () => {
    await withScratchDatabase(async (pool) => {
      const directory = steps({ "0001-a.sql": CREATE_A });
      await migrate(pool, directory);
      expect(await migrate(pool, directory)).toEqual([]);
      expect((await pool.query("SELECT n FROM a")).rows).toEqual([{ n: 1 }]);
    });
  });

  it("SC-36 only the steps that are missing are applied", async () => {
    await withScratchDatabase(async (pool) => {
      await migrate(pool, steps({ "0001-a.sql": CREATE_A }));
      const applied = await migrate(pool, steps({ "0001-a.sql": CREATE_A, "0002-b.sql": CREATE_B }));
      expect(applied).toEqual(["0002-b"]);
      expect((await pool.query("SELECT n FROM a")).rows).toEqual([{ n: 1 }]);
    });
  });

  it("SC-37 a step that fails leaves nothing of itself, is not recorded, and says which step failed", async () => {
    await withScratchDatabase(async (pool) => {
      const directory = steps({ "0001-a.sql": CREATE_A, "0002-broken.sql": "CREATE TABLE half (n integer); SELECT * FROM missing_table;" });
      await expect(migrate(pool, directory)).rejects.toThrow("Migration 0002-broken failed");
      expect((await pool.query("SELECT to_regclass('half') AS half")).rows).toEqual([{ half: null }]);
      expect((await pool.query("SELECT version FROM schema_migrations")).rows).toEqual([{ version: 1 }]);
    });
  });

  it("two servers that start together apply each step once", async () => {
    await withScratchDatabase(async (pool) => {
      const directory = steps({ "0001-a.sql": CREATE_A });
      const results = await Promise.all([migrate(pool, directory), migrate(pool, directory)]);
      expect(results.flat()).toEqual(["0001-a"]);
    });
  });

  it("refuses a gap, a repeated number and a file that is not a step", async () => {
    await withScratchDatabase(async (pool) => {
      await expect(migrate(pool, steps({ "0001-a.sql": CREATE_A, "0003-c.sql": CREATE_B }))).rejects.toThrow("expected");
      await expect(migrate(pool, steps({ "0001-a.sql": CREATE_A, "0001-b.sql": CREATE_B }))).rejects.toThrow("expected");
      await expect(migrate(pool, steps({ "notes.txt": "" }))).rejects.toThrow("not a migration");
    });
  });

  it("the migrations of the application build the schema of the design", async () => {
    await withScratchDatabase(async (pool) => {
      await migrate(pool, MIGRATIONS_DIRECTORY);
      const { rows } = await pool.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
      expect(rows.map((r) => r.tablename)).toEqual([
        "accounts", "listings", "login_attempts", "notifications", "price_alerts", "price_observations", "schema_migrations", "sessions",
      ]);
      const foreignKeys = await pool.query("SELECT 1 FROM pg_constraint WHERE contype = 'f'");
      expect(foreignKeys.rowCount).toBe(0);
    });
  });
});
