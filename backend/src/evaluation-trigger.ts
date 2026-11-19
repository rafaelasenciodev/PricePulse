/**
 * When the Price Alerts of a Listing are evaluated, and what becomes of the outcome.
 *
 * Feature 03 evaluates alerts, feature 02 records prices, and neither knows the other (BR-11 of
 * feature 02). This module is the policy that joins them: it wraps the recording of a price so
 * that the Listing is evaluated after it. It is wired by the Composition Root and knows both
 * features only through their applications.
 */

import type { FastifyBaseLogger } from "fastify";
import type { EvaluatePriceAlerts, EvaluatePriceAlertsResult } from "./price-alerts/application";
import type { PriceObservationRecorder } from "./price-observations/application";

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
  recorder: PriceObservationRecorder,
  evaluator: Pick<EvaluatePriceAlerts, "execute">,
  report: (report: EvaluationReport) => void,
): PriceObservationRecorder {
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
export function logEvaluation(log: FastifyBaseLogger): (report: EvaluationReport) => void {
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
