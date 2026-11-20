/**
 * Chooses where the server keeps its data, from the environment (feature 11, decision 12 of its design).
 *
 * With `DATABASE_URL` it uses PostgreSQL: it connects, applies the migrations and says at which database, without the
 * user and the password. Without it, it keeps the data in memory and says that it is lost when the server stops.
 * Production is refused, as the server always did: the demo Accounts have public passwords, and that stays until the
 * deployment decides otherwise. A database that cannot be reached stops the server, and what it says never carries the
 * address, the user or the password, only the code of the failure.
 */

import { composeInMemoryApp, composePostgresApp, type Application, type ComposeOptions } from "./composition-root";
import { createPool, type Pool } from "./database/connect";
import { MIGRATIONS_DIRECTORY, MigrationFailed, migrate } from "./database/migrate";

/** The server must not start with this storage, and the message says why. Safe to show: it holds no secret. */
export class StorageRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageRefused";
  }
}

export interface Storage {
  /** Where the data is, for a person to read. It never holds a user or a password. */
  readonly description: string;
  /** The application over this storage. */
  compose(options: ComposeOptions): Application;
  /** Closes what the storage holds open. */
  close(): Promise<void>;
}

/** What the storage tells the person who starts the server. */
export interface StorageLog {
  info(message: string): void;
  warn(message: string): void;
}

/** The code of a failure, such as ECONNREFUSED, and not its text, which may name the address. */
function codeOf(error: unknown): string {
  const read = (value: unknown): string | null =>
    typeof value === "object" && value !== null && typeof (value as { code?: unknown }).code === "string" ? (value as { code: string }).code : null;
  const aggregate = (error as { errors?: unknown } | null)?.errors;
  return read(error) ?? (Array.isArray(aggregate) ? read(aggregate[0]) : null) ?? "unknown";
}

/** `host:port/name` of the database, without the user and the password. Null if the text is not an address. */
function describeDatabase(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") return null;
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return null;
  }
}

export async function chooseStorage(environment: Readonly<Record<string, string | undefined>>, log: StorageLog): Promise<Storage> {
  if (environment["NODE_ENV"] === "production") {
    throw new StorageRefused(
      "This server starts with demo data whose passwords are public, so it must not run in production. " +
        "It is not offered as a production server yet.",
    );
  }

  const url = environment["DATABASE_URL"];
  if (url === undefined || url === "") {
    log.warn("DATABASE_URL is not set: the data is kept in memory, and what is stored is lost when the server stops.");
    return { description: "memory", compose: (options) => composeInMemoryApp(options), close: async () => {} };
  }

  const description = describeDatabase(url);
  if (description === null) throw new StorageRefused("DATABASE_URL is not the address of a PostgreSQL database.");

  const pool: Pool = createPool(url);
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    await pool.end().catch(() => undefined);
    throw new StorageRefused(`Could not connect to the database (${codeOf(error)}).`);
  }
  try {
    const applied = await migrate(pool, MIGRATIONS_DIRECTORY);
    if (applied.length > 0) log.info(`Applied the migrations: ${applied.join(", ")}.`);
  } catch (error) {
    await pool.end().catch(() => undefined);
    const cause = error instanceof MigrationFailed ? ` (${codeOf(error.cause)})` : "";
    throw new StorageRefused(`${error instanceof Error ? error.message : "The migrations failed"}${cause}.`);
  }
  log.info(`The data is kept in the PostgreSQL database ${description}.`);
  return { description, compose: (options) => composePostgresApp(pool, options), close: () => pool.end() };
}
