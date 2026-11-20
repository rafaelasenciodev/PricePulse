import { Link } from "react-router-dom";
import type { Listing, PriceAlert } from "../api";
import { screens } from "../texts";
import { formatInstant, formatPrice } from "./format";

interface Props {
  readonly alert: PriceAlert;
  /** The Listing of the alert, when it was found: without it the entry shows the identifier (BR-03). */
  readonly listing: Listing | undefined;
}

/** One Price Alert of the person: what it watches, its Target Price, its state and when it was created (BR-03). */
export function AlertEntry({ alert, listing }: Props) {
  return (
    <li>
      <h2>
        <Link to={`/listings/${encodeURIComponent(alert.listingId)}`}>{listing?.title ?? alert.listingId}</Link>
      </h2>
      {listing !== undefined && <p className="retailer">{screens.listing.retailer(listing.retailer)}</p>}
      <p>
        <strong>{screens.alerts.targetPrice(formatPrice({ amount: alert.targetAmount, currency: alert.currency }))}</strong>
      </p>
      <p>{screens.alerts.state(screens.alerts.status[alert.status])}</p>
      <p className="muted">{screens.alerts.createdAt(formatInstant(alert.createdAt))}</p>
    </li>
  );
}
