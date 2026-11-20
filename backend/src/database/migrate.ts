/**
 * Applies the numbered SQL files of a folder, once each, in the order of their number.
 *
 * A step runs and is recorded in one transaction, so a step that fails leaves nothing of itself. An advisory lock
 * is taken first, so two servers that start together do not both apply a step. A step that was applied and then
 * edited is not detected: that would need a checksum, which is not built.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "./connect";

/** The folder of the migrations of the application. */
export const MIGRATIONS_DIRECTORY = fileURLToPath(new URL("./migrations/", import.meta.url));

const FILE = /^(\d{4})-([a-z0-9-]+)\.sql$/;

/** Any number that identifies this lock among the others of the server. */
const LOCK_KEY = 5_160_011;

interface Step {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

const label = (step: Step) => `${String(step.version).padStart(4, "0")}-${step.name}`;

/** The steps in `directory`, in order. A gap or a repeated number is an error, and so is a file that is not a step. */
function readSteps(directory: string): Step[] {
  const steps: Step[] = [];
  for (const file of readdirSync(directory).sort()) {
    const match = FILE.exec(file);
    if (!match) throw new Error(`"${file}" is not a migration: the name must be NNNN-name.sql`);
    steps.push({ version: Number(match[1]), name: match[2] as string, sql: readFileSync(join(directory, file), "utf8") });
  }
  steps.forEach((step, index) => {
    if (step.version !== index + 1) {
      throw new Error(`Migration numbers must run 1, 2, 3...: found ${step.version} where ${index + 1} was expected`);
    }
  });
  return steps;
}

/** Applies the steps of `directory` that are not recorded yet. Gives the names of those it applied. */
export async function migrate(pool: Pool, directory: string): Promise<string[]> {
  const steps = readSteps(directory);
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           version    integer PRIMARY KEY,
           name       text NOT NULL,
           applied_at bigint NOT NULL
         )`,
      );
      const done = new Set<number>(
        (await client.query<{ version: number }>("SELECT version FROM schema_migrations")).rows.map((r) => r.version),
      );
      for (const step of steps) {
        if (done.has(step.version)) continue;
        try {
          await client.query("BEGIN");
          await client.query(step.sql);
          await client.query("INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)", [
            step.version,
            step.name,
            Date.now(),
          ]);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw new Error(`Migration ${label(step)} failed`, { cause: error });
        }
        applied.push(label(step));
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    }
  } finally {
    client.release();
  }
  return applied;
}
