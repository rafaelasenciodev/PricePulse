import { Link } from "react-router-dom";
import type { Listing } from "../api";
import { screens } from "../texts";
import { Card } from "./Card";
import { formatInstant, formatPrice } from "./format";

/**
 * A Listing of the Catalogue as a card (BR-01): its title, its Retailer and its Current Price, or a note that it has none.
 * The title is the one link, and it covers the whole card, so the card leads to the Listing wherever it is pressed.
 */
export function ListingCard({ listing }: { readonly listing: Listing }) {
  const { id, title, retailer, currentPrice } = listing;
  return (
    <Card as="li" className="relative flex flex-col gap-1 transition-shadow focus-within:ring-2 focus-within:ring-accent hover:shadow-md">
      <h2 className="m-0 text-base font-semibold">
        <Link to={`/listings/${encodeURIComponent(id)}`} className="text-ink no-underline after:absolute after:inset-0">
          {title}
        </Link>
      </h2>
      <p className="m-0 text-sm text-muted">{screens.listing.retailer(retailer)}</p>
      {currentPrice === null ? (
        <p className="m-0 mt-2 text-sm text-muted">{screens.listing.noPrice}</p>
      ) : (
        <p className="m-0 mt-2">
          <strong className="text-2xl font-semibold">{formatPrice(currentPrice)}</strong>
          <span className="block text-xs text-muted">{screens.listing.observedAt(formatInstant(currentPrice.observedAt))}</span>
        </p>
      )}
    </Card>
  );
}
