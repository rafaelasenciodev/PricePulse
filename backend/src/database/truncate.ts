/** Empties the data of the database, and leaves its schema and the record of its migrations (feature 12). */

import type { Pool } from "./connect";

/**
 * Empties every table of the `public` schema except `schema_migrations`, restarting the sequences, in one transaction.
 * The tables are read from the catalogue of the database, so a table that a later migration adds is emptied too.
 */
export async function truncateData(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'",
    );
    if (rows.length > 0) {
      const names = rows.map((row) => `"${row.tablename.replaceAll('"', '""')}"`).join(", ");
      await client.query(`TRUNCATE ${names} RESTART IDENTITY`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
