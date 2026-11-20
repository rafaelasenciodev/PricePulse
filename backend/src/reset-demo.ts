/**
 * Returns the data of the public demo to its first state (feature 12, BR-08): empties the database and creates the demo
 * data again. It destroys data, so it runs only for a demo, and what it says never carries the address, the user or the
 * password of the database, only the code of a failure.
 */

import { composePostgresApp } from "./composition-root";
import { createPool } from "./database/connect";
import { MIGRATIONS_DIRECTORY, MigrationFailed, migrate } from "./database/migrate";
import { truncateData } from "./database/truncate";
import { seedDemoData } from "./demo-data";
import { declaresDemo } from "./settings";
import { codeOf } from "./storage";

/** The reset does not run, and the message says why. Safe to show: it holds no secret. */
export class ResetRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResetRefused";
  }
}

export async function resetDemo(environment: Readonly<Record<string, string | undefined>>, log: { info(message: string): void }): Promise<void> {
  if (!declaresDemo(environment)) {
    throw new ResetRefused("The reset empties the database, so it runs only for a demo: declare it with DEMO_MODE=true.");
  }
  const url = environment["DATABASE_URL"];
  if (url === undefined || url === "") {
    throw new ResetRefused("The reset needs DATABASE_URL, the address of the database of the demo.");
  }

  const pool = createPool(url);
  try {
    try {
      await pool.query("SELECT 1");
    } catch (error) {
      throw new ResetRefused(`Could not connect to the database (${codeOf(error)}).`);
    }
    try {
      await migrate(pool, MIGRATIONS_DIRECTORY);
    } catch (error) {
      const cause = error instanceof MigrationFailed ? ` (${codeOf(error.cause)})` : "";
      throw new ResetRefused(`${error instanceof Error ? error.message : "The migrations failed"}${cause}.`);
    }

    await truncateData(pool);
    const application = composePostgresApp(pool, { onEvaluation: () => {} });
    try {
      await seedDemoData(application);
    } finally {
      await application.app.close();
    }
    log.info("The data was emptied and the demo data was created again.");
  } finally {
    await pool.end();
  }
}
