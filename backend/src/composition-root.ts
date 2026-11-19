/**
 * Composition Root: the one place where the parts of the application are chosen and connected.
 *
 * Everything else depends on ports (interfaces) and never creates its own collaborators,
 * so replacing an adapter, for example the in-memory catalogue by a database one, means
 * changing this file and nothing else.
 *
 * It is also the only place that knows both features. Price Alerts read the Current Price of
 * a Listing, and that price is not stored by them: it follows from the Price Observations
 * (BR-07 of feature 02). The two meet here, through two functions handed to the reader.
 */

import type { FastifyInstance } from "fastify";
import { buildApp, type ApiDocsOptions } from "./app";
import {
  ComposedListingReader,
  InMemoryPriceAlertRepository,
} from "./price-alerts/adapters";
import { CreatePriceAlert } from "./price-alerts/application";
import { InMemoryAuthenticator } from "./price-alerts/http";
import {
  InMemoryListingCatalogue,
  InMemoryPriceObservationRepository,
  SystemClock,
} from "./price-observations/adapters";
import { RecordPriceObservation, type Clock } from "./price-observations/application";
import { InMemoryProviderAuthenticator } from "./price-observations/http";

export interface InMemoryApplication {
  readonly app: FastifyInstance;
  /** The adapters, so that the caller can fill them with data (development and tests). */
  readonly catalogue: InMemoryListingCatalogue;
  readonly authenticator: InMemoryAuthenticator;
  readonly providerAuthenticator: InMemoryProviderAuthenticator;
  /**
   * The use case that records prices, so that the caller can give a Listing its first price
   * the way a Provider would, and not by writing into the adapters.
   */
  readonly recordPriceObservation: RecordPriceObservation;
}

/** The application wired with in-memory adapters: no database, no external provider. */
export function composeInMemoryApp(
  options: { logger?: boolean; apiDocs?: ApiDocsOptions; clock?: Clock } = {},
): InMemoryApplication {
  // Price Observations
  const catalogue = new InMemoryListingCatalogue();
  const observations = new InMemoryPriceObservationRepository();
  const providerAuthenticator = new InMemoryProviderAuthenticator();
  const recordPriceObservation = new RecordPriceObservation(
    catalogue,
    observations,
    options.clock ?? new SystemClock(),
  );

  // Price Alerts. The currency of a Listing comes from the catalogue and its Current Price
  // from the latest Price Observation: a Listing with none has no Current Price.
  const listings = new ComposedListingReader(
    async (listingId) => (await catalogue.find(listingId))?.currency ?? null,
    async (listingId) => (await observations.findLatest(listingId))?.price ?? null,
  );
  const alerts = new InMemoryPriceAlertRepository();
  const authenticator = new InMemoryAuthenticator();
  const createPriceAlert = new CreatePriceAlert(listings, alerts);

  const app = buildApp({
    createPriceAlert,
    authenticator,
    priceObservations: { recordPriceObservation, authenticator: providerAuthenticator },
    logger: options.logger,
    apiDocs: options.apiDocs,
  });

  return { app, catalogue, authenticator, providerAuthenticator, recordPriceObservation };
}
