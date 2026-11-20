/** `npm run migrate`: applies the pending migrations to the database in `DATABASE_URL`. */

import { createPool } from "./connect";
import { MIGRATIONS_DIRECTORY, migrate } from "./migrate";

const url = process.env["DATABASE_URL"];
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = createPool(url);
try {
  const applied = await migrate(pool, MIGRATIONS_DIRECTORY);
  console.log(applied.length === 0 ? "The database is up to date." : `Applied: ${applied.join(", ")}`);
} catch (error) {
  // The code says what failed without the text of the error, which may carry the address of the server.
  const cause = error instanceof Error ? error.cause : undefined;
  const code = cause instanceof Error && "code" in cause ? String(cause.code) : "unknown";
  console.error(`${error instanceof Error ? error.message : "The migrations failed"} (${code}).`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
