/**
 * Set-up of the database tests: makes sure `pricepulse_test` exists on the server of `compose.yaml`.
 * If the server cannot be reached it throws, so the run fails with a message: a test that needs the database
 * is never skipped, because a run that skips them would look green without having checked anything.
 */

import pg from "pg";
import { TEST_DATABASE, TEST_DATABASE_URL, TEST_SERVER_URL } from "./database";

export default async function setup(): Promise<void> {
  const admin = new pg.Client({ connectionString: TEST_SERVER_URL });
  try {
    await admin.connect();
  } catch {
    throw new Error(
      "The database tests need PostgreSQL and could not reach it. Start it with `docker compose up -d` " +
        `(or set TEST_DATABASE_SERVER_URL to another server). Looked for: ${TEST_SERVER_URL.replace(/:[^:@/]*@/, ":***@")}`,
    );
  }
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [TEST_DATABASE]);
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE ${TEST_DATABASE}`);
  } finally {
    await admin.end();
  }
  process.env["TEST_DATABASE_URL"] = TEST_DATABASE_URL;
}
