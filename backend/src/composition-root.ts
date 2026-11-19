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
 * They meet a second time when a price is recorded: the Price Alerts of that Listing are
 * evaluated (feature 03). Recording itself knows nothing of it (BR-11 of feature 02).
 */

import type { FastifyInstance } from "fastify";
import { buildApp, type ApiDocsOptions } from "./app";
import {
  ComposedListingReader,
  InMemoryNotificationRepository,
  InMemoryPriceAlertRepository,
} from "./price-alerts/adapters";
import {
  CreatePriceAlert,
  EvaluatePriceAlerts,
  type CurrentPrice,
  type CurrentPriceSource,
} from "./price-alerts/application";
import { logEvaluation, withEvaluation, type EvaluationReport } from "./evaluation-trigger";
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
  /** The use case that creates alerts and the stores of alerts and Notifications, for the demo and the tests. */
  readonly createPriceAlert: CreatePriceAlert;
  readonly alerts: InMemoryPriceAlertRepository;
  readonly notifications: InMemoryNotificationRepository;
}

/** The application wired with in-memory adapters: no database, no external provider. */
export function composeInMemoryApp(
  options: {
    logger?: boolean;
    apiDocs?: ApiDocsOptions;
    clock?: Clock;
    /** Receives what each Evaluation came to. By default it writes to the log of the application. */
    onEvaluation?: (report: EvaluationReport) => void;
  } = {},
): InMemoryApplication {
  // Price Observations
  const catalogue = new InMemoryListingCatalogue();
  const observations = new InMemoryPriceObservationRepository();
  const providerAuthenticator = new InMemoryProviderAuthenticator();
  const clock = options.clock ?? new SystemClock();
  const recordPriceObservation = new RecordPriceObservation(catalogue, observations, clock);

  // The Current Price of a Listing, with the moment at which it was observed, comes from its latest
  // Price Observation (BR-07 of feature 02). One whose latest observation has no Price has none.
  // It is written once and every reader of the Current Price uses it.
  const currentPriceOf = async (listingId: Parameters<CurrentPriceSource["currentPriceOf"]>[0]): Promise<CurrentPrice | null> => {
    const latest = await observations.findLatest(listingId);
    return latest === null || latest.price === null ? null : { price: latest.price, observedAt: latest.observedAt };
  };

  // Price Alerts. The currency of a Listing comes from the catalogue and its Current Price from
  // the function above: a Listing with none has no Current Price.
  const listings = new ComposedListingReader(
    async (listingId) => (await catalogue.find(listingId))?.currency ?? null,
    async (listingId) => (await currentPriceOf(listingId))?.price ?? null,
  );
  const alerts = new InMemoryPriceAlertRepository();
  const authenticator = new InMemoryAuthenticator();
  const createPriceAlert = new CreatePriceAlert(listings, alerts, clock);

  const notifications = new InMemoryNotificationRepository();
  const evaluatePriceAlerts = new EvaluatePriceAlerts(alerts, notifications, { currentPriceOf });

  const app: FastifyInstance = buildApp({
    createPriceAlert,
    authenticator,
    priceObservations: {
      recordPriceObservation: withEvaluation(
        recordPriceObservation,
        evaluatePriceAlerts,
        options.onEvaluation ?? ((report) => logEvaluation(app.log)(report)),
      ),
      authenticator: providerAuthenticator,
    },
    logger: options.logger,
    apiDocs: options.apiDocs,
  });

  return {
    app,
    catalogue,
    authenticator,
    providerAuthenticator,
    recordPriceObservation,
    createPriceAlert,
    alerts,
    notifications,
  };
}
