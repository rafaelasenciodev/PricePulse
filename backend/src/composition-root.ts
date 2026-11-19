/**
 * Composition Root: the one place where the parts of the application are chosen and connected.
 *
 * Everything else depends on ports (interfaces) and never creates its own collaborators,
 * so replacing an adapter, for example the in-memory catalogue by a database one, means
 * changing this file and nothing else.
 */

import type { FastifyInstance } from "fastify";
import { buildApp } from "./app";
import {
  InMemoryAuthenticator,
  InMemoryListingReader,
  InMemoryPriceAlertRepository,
} from "./price-alerts/adapters";
import { CreatePriceAlert } from "./price-alerts/application";

export interface InMemoryApplication {
  readonly app: FastifyInstance;
  /** The adapters, so that the caller can fill them with data (development and tests). */
  readonly listings: InMemoryListingReader;
  readonly authenticator: InMemoryAuthenticator;
}

/** The application wired with in-memory adapters: no database, no external provider. */
export function composeInMemoryApp(options: { logger?: boolean } = {}): InMemoryApplication {
  const listings = new InMemoryListingReader();
  const alerts = new InMemoryPriceAlertRepository();
  const authenticator = new InMemoryAuthenticator();

  const createPriceAlert = new CreatePriceAlert(listings, alerts);
  const app = buildApp({ createPriceAlert, authenticator, logger: options.logger });

  return { app, listings, authenticator };
}
