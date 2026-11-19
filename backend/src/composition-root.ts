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

import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { buildApp, type ApiDocsOptions } from "./app";
import {
  ComposedListingReader,
  InMemoryNotificationRepository,
  InMemoryPriceAlertRepository,
} from "./price-alerts/adapters";
import {
  CreatePriceAlert,
  EvaluatePriceAlerts,
  type CurrentPriceSource,
  type EvaluatePriceAlertsResult,
} from "./price-alerts/application";
import { InMemoryAuthenticator } from "./price-alerts/http";
import {
  InMemoryListingCatalogue,
  InMemoryPriceObservationRepository,
  SystemClock,
} from "./price-observations/adapters";
import { RecordPriceObservation, type Clock } from "./price-observations/application";
import { InMemoryProviderAuthenticator } from "./price-observations/http";

/** What an Evaluation started by a recording came to: its result, or the error that stopped it. */
export type EvaluationReport =
  | { readonly listingId: string; readonly result: EvaluatePriceAlertsResult }
  | { readonly listingId: string; readonly error: unknown };

/**
 * Wraps the recording of a Price Observation so that the Price Alerts of its Listing are
 * evaluated after every recording that succeeds, a new one or a repeated one.
 *
 * The Evaluation is idempotent, so a repeat by the Provider also finishes what an earlier
 * failed Evaluation left half done. Whatever happens to the Evaluation, the response of the
 * recording is the one of the recording: the observation is stored, and the Evaluation is
 * another matter. Its outcome, or its failure, goes to `report`.
 */
export function withEvaluation(
  recorder: Pick<RecordPriceObservation, "execute">,
  evaluator: Pick<EvaluatePriceAlerts, "execute">,
  report: (report: EvaluationReport) => void,
): Pick<RecordPriceObservation, "execute"> {
  return {
    async execute(command) {
      const outcome = await recorder.execute(command);

      const { listingId } = command;
      let evaluation: EvaluationReport;
      try {
        evaluation = { listingId, result: await evaluator.execute({ listingId }) };
      } catch (error) {
        evaluation = { listingId, error };
      }
      try {
        report(evaluation);
      } catch {
        // A failure of the report must not change the response of a recording that succeeded.
      }
      return outcome;
    },
  };
}

/** The default report: a line in the log for each Notification produced, and a warning for each failure. */
function logEvaluation(log: FastifyBaseLogger): (report: EvaluationReport) => void {
  return (report) => {
    if ("error" in report) {
      log.error({ err: report.error, listingId: report.listingId }, "The Evaluation of the Price Alerts failed");
      return;
    }
    for (const { notification, produced } of report.result.triggered) {
      log.info(
        { ...notification, produced },
        produced
          ? "Price Alert triggered: a Notification was produced"
          : "Price Alert triggered: completed from the Notification that already existed",
      );
    }
    for (const failure of report.result.failed) {
      log.warn({ err: failure.error, alertId: failure.alertId, listingId: report.listingId }, "A Price Alert could not be evaluated");
    }
  };
}

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

  // The evaluation of the Price Alerts reads the Current Price with the moment at which it was
  // observed, from the latest Price Observation. A Listing whose latest one has no Price has none.
  const notifications = new InMemoryNotificationRepository();
  const prices: CurrentPriceSource = {
    async currentPriceOf(listingId) {
      const latest = await observations.findLatest(listingId);
      return latest === null || latest.price === null ? null : { price: latest.price, observedAt: latest.observedAt };
    },
  };
  const evaluatePriceAlerts = new EvaluatePriceAlerts(alerts, notifications, prices);

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
