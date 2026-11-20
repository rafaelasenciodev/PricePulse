import type { Listing } from "../api";
import { screens } from "../texts";
import { formatInstant, formatPrice } from "./format";

/** What a Listing says of itself, apart from its title: its Retailer and its Current Price, made prominent, with the moment it was observed (BR-02, BR-05). */
export function ListingFacts({ listing }: { readonly listing: Listing }) {
  const { retailer, currentPrice } = listing;
  return (
    <>
      <p className="m-0 mt-1 text-sm text-muted">{screens.listing.retailer(retailer)}</p>
      {currentPrice === null ? (
        <p className="m-0 mt-4 text-lg text-muted">{screens.listing.noPrice}</p>
      ) : (
        <p className="m-0 mt-4">
          <strong className="text-4xl font-semibold">{formatPrice(currentPrice)}</strong>
          <span className="mt-1 block text-sm text-muted">{screens.listing.observedAt(formatInstant(currentPrice.observedAt))}</span>
        </p>
      )}
    </>
  );
}
