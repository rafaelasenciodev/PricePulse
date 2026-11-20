/** What the database tests share: where the database is, a pool to it, and how to empty it. */

import { createPool, type Pool } from "../../src/database/connect";
import { MIGRATIONS_DIRECTORY, migrate } from "../../src/database/migrate";

export const TEST_DATABASE = "pricepulse_test";

// The server of `compose.yaml`, on the host port 5433. Another one can be given for a run elsewhere.
export const TEST_SERVER_URL =
  process.env["TEST_DATABASE_SERVER_URL"] ?? "postgres://pricepulse:pricepulse@127.0.0.1:5433/postgres";

/** The same server, on the test database. */
export const TEST_DATABASE_URL = (() => {
  const url = new URL(TEST_SERVER_URL);
  url.pathname = `/${TEST_DATABASE}`;
  return url.toString();
})();

/** A pool to the test database, with the schema applied. The caller closes it with `end()`. */
export async function testPool(): Promise<Pool> {
  const pool = createPool(TEST_DATABASE_URL);
  await migrate(pool, MIGRATIONS_DIRECTORY);
  return pool;
}

/** Empties every table of the application, so that a test starts from nothing. The record of the migrations stays. */
export async function truncateAll(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'",
  );
  if (rows.length === 0) return;
  await pool.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")}`);
}

/**
 * Runs `body` with a pool to a new, empty database, and drops the database afterwards. For the tests of the migrations,
 * which need a database with no schema.
 */
export async function withScratchDatabase(body: (pool: Pool) => Promise<void>): Promise<void> {
  const name = `pricepulse_scratch_${process.pid}_${Date.now()}`;
  const admin = createPool(TEST_SERVER_URL);
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(TEST_SERVER_URL);
  url.pathname = `/${name}`;
  const pool = createPool(url.toString());
  try {
    await body(pool);
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
}
