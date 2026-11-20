import type { Listing } from "../api";
import { screens } from "../texts";
import { formatInstant, formatPrice } from "./format";

/** What a Listing says of itself, apart from its title: its Retailer and its Current Price with the moment it was observed (BR-07, BR-08). */
export function ListingFacts({ listing }: { readonly listing: Listing }) {
  const { retailer, currentPrice } = listing;
  return (
    <>
      <p className="retailer">{screens.listing.retailer(retailer)}</p>
      {currentPrice === null ? (
        <p className="price">{screens.listing.noPrice}</p>
      ) : (
        <p className="price">
          <strong>{formatPrice(currentPrice)}</strong>{" "}
          <span className="muted">{screens.listing.observedAt(formatInstant(currentPrice.observedAt))}</span>
        </p>
      )}
    </>
  );
}
