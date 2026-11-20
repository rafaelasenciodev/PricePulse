import { useState } from "react";
import { Link } from "react-router-dom";
import type { Failure, Listing, PriceAlert } from "../api";
import { useSession } from "../session";
import { messageFor, screens } from "../texts";
import { AmountForm } from "./AmountForm";
import { formatInstant, formatPrice } from "./format";
import { useSubmit } from "./useSubmit";

/** What the screen is told when an alert was changed or could not be: the text, and whether it went well. */
export interface Outcome {
  readonly text: string;
  readonly done: boolean;
}

interface Props {
  readonly alert: PriceAlert;
  /** The Listing of the alert, when it was found: without it the entry shows the identifier (BR-03). */
  readonly listing: Listing | undefined;
  /** The screen shows what happened and reads the list again (BR-08). */
  readonly onOutcome: (outcome: Outcome) => void;
}

/** The answers that say that the alert is not what the person saw: the list is read again to show what it is now. */
const NOT_WHAT_WAS_SEEN = ["ALERT_NOT_ACTIVE", "ALERT_CONFLICT", "ALERT_NOT_FOUND"];
const isNotWhatWasSeen = (failure: Failure) => failure.kind === "answer" && NOT_WHAT_WAS_SEEN.includes(failure.code);

type Mode = "seen" | "changing" | "confirming";

/**
 * One Price Alert of the person: what it watches, its Target Price, its state and when it was created (BR-03). An
 * Active one can have its Target Price changed and can be cancelled (BR-04), and cancelling asks first (BR-06).
 * The mode is the entry's own: it is lost when the list is read again, which is after every change.
 */
export function AlertEntry({ alert, listing, onOutcome }: Props) {
  const { api } = useSession();
  const [mode, setMode] = useState<Mode>("seen");
  const [error, setError] = useState<string | null>(null);
  const { submit, pending } = useSubmit(() => api.cancelAlert(alert.id));

  const targetPrice = formatPrice({ amount: alert.targetAmount, currency: alert.currency });

  async function confirmCancel() {
    setError(null);
    const result = await submit();
    if (result === undefined) return;
    if (result.ok) onOutcome({ text: screens.alerts.cancelled, done: true });
    else if (isNotWhatWasSeen(result.failure)) onOutcome({ text: messageFor("cancelAlert", result.failure), done: false });
    else setError(messageFor("cancelAlert", result.failure));
  }

  return (
    <li>
      <h2>
        <Link to={`/listings/${encodeURIComponent(alert.listingId)}`}>{listing?.title ?? alert.listingId}</Link>
      </h2>
      {listing !== undefined && <p className="retailer">{screens.listing.retailer(listing.retailer)}</p>}
      <p>
        <strong>{screens.alerts.targetPrice(targetPrice)}</strong>
      </p>
      <p>{screens.alerts.state(screens.alerts.status[alert.status])}</p>
      <p className="muted">{screens.alerts.createdAt(formatInstant(alert.createdAt))}</p>

      {alert.status === "active" && mode === "seen" && (
        <div className="actions">
          <button type="button" onClick={() => setMode("changing")}>
            {screens.alerts.change}
          </button>
          <button type="button" onClick={() => setMode("confirming")}>
            {screens.alerts.cancel}
          </button>
        </div>
      )}

      {alert.status === "active" && mode === "changing" && (
        <AmountForm
          id={`target-amount-${alert.id}`}
          label={screens.alerts.changeForm.label(alert.currency)}
          texts={screens.alerts.changeForm}
          send={(amount) => api.changeTarget(alert.id, amount)}
          failureAction="changeTarget"
          onDone={(changed) => onOutcome({ text: screens.alerts.changed(formatPrice({ amount: changed.targetAmount, currency: changed.currency })), done: true })}
          onFailure={(failure) => {
            if (!isNotWhatWasSeen(failure)) return false;
            onOutcome({ text: messageFor("changeTarget", failure), done: false });
            return true;
          }}
          secondary={{ label: screens.alerts.changeForm.giveUp, onClick: () => setMode("seen") }}
        />
      )}

      {alert.status === "active" && mode === "confirming" && (
        <div className="actions">
          <p>{screens.alerts.confirmCancel.question}</p>
          <button type="button" onClick={() => void confirmCancel()} disabled={pending}>
            {pending ? screens.alerts.confirmCancel.submitting : screens.alerts.confirmCancel.yes}
          </button>
          <button type="button" onClick={() => setMode("seen")} disabled={pending}>
            {screens.alerts.confirmCancel.no}
          </button>
          {error !== null && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
