/**
 * What the environment says about how the server runs, and the refusals that follow from it (feature 12).
 *
 * A pure function of the environment: it connects to nothing, so it can run first, and what it refuses is said before
 * anything else starts. Without any variable the server is the development server that it always was.
 */

import { normalizeOrigin } from "./shared/http";

/** The server must not start with these settings, and the message says why. Safe to show: it holds no secret. */
export class SettingsRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettingsRefused";
  }
}

export interface Settings {
  /** True when the environment says that this is production. */
  readonly production: boolean;
  /** The server declares that its data is simulated and that its passwords and the token of the Provider are public. */
  readonly demo: boolean;
  /** The address at which the server listens. The local machine only, unless it is told another. */
  readonly host: string;
  readonly port: number;
  /** The origin at which the browser reaches the application, in its normal form. */
  readonly origin: string;
  /** The cookie of the Session is `Secure` when, and only when, the origin is an `https` address. */
  readonly secureCookie: boolean;
  /** The address of the database, if there is one. */
  readonly databaseUrl: string | undefined;
}

type Environment = Readonly<Record<string, string | undefined>>;

/** Whether the environment declares the demo mode: only the text `true` does. */
export const declaresDemo = (environment: Environment): boolean => environment["DEMO_MODE"] === "true";

const present = (value: string | undefined): value is string => value !== undefined && value !== "";

export function readSettings(environment: Environment): Settings {
  const production = environment["NODE_ENV"] === "production";
  const demo = declaresDemo(environment);

  if (production && !demo) {
    throw new SettingsRefused(
      "This server starts with demo data whose passwords are public, so it must not run in production " +
        "unless it is declared a demo with DEMO_MODE=true.",
    );
  }
  if (production && !present(environment["DATABASE_URL"])) {
    throw new SettingsRefused(
      "In production the server needs DATABASE_URL: without a database it would lose its Accounts and alerts when it stops.",
    );
  }
  if (production && !present(environment["WEB_ORIGIN"])) {
    throw new SettingsRefused(
      "In production the server needs WEB_ORIGIN, the exact address at which the browser reaches the application: " +
        "without it every change of data is refused as a forbidden origin.",
    );
  }

  const requestedPort = Number(environment["PORT"]);
  const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 3000;
  const host = present(environment["HOST"]) ? environment["HOST"] : "127.0.0.1";

  const requestedOrigin = present(environment["WEB_ORIGIN"]) ? environment["WEB_ORIGIN"] : `http://127.0.0.1:${port}`;
  let origin: string;
  try {
    origin = normalizeOrigin(requestedOrigin);
  } catch (error) {
    throw new SettingsRefused(`WEB_ORIGIN is not valid: ${error instanceof Error ? error.message : String(error)}`);
  }

  const databaseUrl = present(environment["DATABASE_URL"]) ? environment["DATABASE_URL"] : undefined;
  return { production, demo, host, port, origin, secureCookie: origin.startsWith("https:"), databaseUrl };
}
