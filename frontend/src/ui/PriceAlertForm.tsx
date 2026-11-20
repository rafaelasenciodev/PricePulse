import { useState, type FormEvent } from "react";
import type { CreatedAlert, Listing } from "../api";
import { useSession } from "../session";
import { messageFor, screens } from "../texts";
import { formatPrice } from "./format";
import { useSubmit } from "./useSubmit";

interface Props {
  readonly listing: Listing;
  /** Called when the Price Alert exists, whether it was created now or already was. */
  readonly onDone: (message: string) => void;
}

/**
 * The form to ask for a Price Alert on a Listing. The amount goes to the API as the text that the person wrote,
 * trimmed, and the API decides whether it is valid (BR-09). What was written stays in the form when the request
 * fails, and the button cannot be used while one is in progress (BR-11).
 */
export function PriceAlertForm({ listing, onDone }: Props) {
  const { api } = useSession();
  const [amount, setAmount] = useState("");
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { submit, pending } = useSubmit((target: string) => api.createAlert(listing.id, target));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const target = amount.trim();
    setMissing(target === "");
    if (target === "") return;
    const result = await submit(target);
    if (result === undefined) return;
    if (result.ok) onDone(describe(result.data));
    else setError(messageFor("createAlert", result.failure));
  }

  return (
    <section>
      <h2>{screens.alertForm.title}</h2>
      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <label htmlFor="target-amount">{screens.alertForm.amount(listing.currency)}</label>
        <input
          id="target-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          aria-invalid={missing}
          aria-describedby={missing ? "target-amount-missing" : undefined}
        />
        {missing && (
          <p id="target-amount-missing" role="alert" className="error">
            {screens.alertForm.amountMissing}
          </p>
        )}
        {error !== null && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending}>
          {pending ? screens.alertForm.submitting : screens.alertForm.submit}
        </button>
      </form>
    </section>
  );
}

/** What is said of a Price Alert that exists: that it was created now, or that the person already had it (BR-10). */
function describe({ alert, created }: CreatedAlert): string {
  const target = formatPrice({ amount: alert.targetAmount, currency: alert.currency });
  return created ? screens.alertForm.created(target) : screens.alertForm.existed(target);
}
