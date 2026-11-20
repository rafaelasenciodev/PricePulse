/** The pool of connections to PostgreSQL. The only place that creates one. */

import pg from "pg";

export type Pool = pg.Pool;

/** The type of `bigint` in PostgreSQL (`int8`), which the driver gives as text. */
const BIGINT_OID = 20;

/**
 * Money in minor units and instants in milliseconds are stored as `bigint` and live in the domain as numbers.
 * A value that is not a safe integer would come back changed in silence, so it is refused: the one place that converts.
 */
function bigintAsNumber(text: string): number {
  const value = Number(text);
  if (!Number.isSafeInteger(value)) throw new RangeError(`The stored integer ${text} is not a safe integer`);
  return value;
}

/** A pool for the database at `connectionString`. It connects when it is first used, not here. */
export function createPool(connectionString: string): Pool {
  const pool = new pg.Pool({
    connectionString,
    types: {
      getTypeParser: ((oid: number, format?: "text" | "binary") =>
        oid === BIGINT_OID ? bigintAsNumber : pg.types.getTypeParser(oid, format as "text")) as typeof pg.types.getTypeParser,
    },
  });
  // An idle connection that the server drops emits an error. Without a listener it would end the process.
  pool.on("error", () => {});
  return pool;
}
