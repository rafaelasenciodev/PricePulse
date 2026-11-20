/** The pool of connections to PostgreSQL. The only place that creates one. */

import pg from "pg";

export type Pool = pg.Pool;

/** A pool for the database at `connectionString`. It connects when it is first used, not here. */
export function createPool(connectionString: string): Pool {
  const pool = new pg.Pool({ connectionString });
  // An idle connection that the server drops emits an error. Without a listener it would end the process.
  pool.on("error", () => {});
  return pool;
}
