import type { CreatedAlert, Listing } from "../api";
import { useSession } from "../session";
import { screens } from "../texts";
import { AmountForm } from "./AmountForm";
import { formatPrice } from "./format";

interface Props {
  readonly listing: Listing;
  /** Called when the Price Alert exists, whether it was created now or already was. */
  readonly onDone: (message: string) => void;
}

/** The form to ask for a Price Alert on a Listing: the form of an amount, with the words and the request of this one. */
export function PriceAlertForm({ listing, onDone }: Props) {
  const { api } = useSession();
  return (
    <section>
      <h2>{screens.alertForm.title}</h2>
      <AmountForm
        id="target-amount"
        label={screens.alertForm.amount(listing.currency)}
        texts={{ submit: screens.alertForm.submit, submitting: screens.alertForm.submitting, missing: screens.alertForm.amountMissing }}
        send={(target) => api.createAlert(listing.id, target)}
        failureAction="createAlert"
        onDone={(created) => onDone(describe(created))}
      />
    </section>
  );
}

/** What is said of a Price Alert that exists: that it was created now, or that the person already had it (BR-10). */
function describe({ alert, created }: CreatedAlert): string {
  const target = formatPrice({ amount: alert.targetAmount, currency: alert.currency });
  return created ? screens.alertForm.created(target) : screens.alertForm.existed(target);
}
