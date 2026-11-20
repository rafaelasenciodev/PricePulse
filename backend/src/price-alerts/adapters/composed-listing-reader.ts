import type { ListingId, Price } from "../../shared/domain";
import type { ListingReader, ListingView } from "../application";

/** Where the currency of a Listing comes from: its currency, or null if the Listing does not exist. */
export type CurrencyOfListing = (listingId: ListingId) => Promise<string | null>;

/** Where the Current Price of a Listing comes from: a Price, or null if the Listing has none. */
export type CurrentPriceOfListing = (listingId: ListingId) => Promise<Price | null>;

/**
 * Implements ListingReader from two sources that this feature does not know.
 *
 * The currency comes from wherever the Listings are kept, and the Current Price from the
 * Price Observations. Both are given as functions, defined here, so that this feature
 * imports nothing from the feature that records the observations: the Composition Root
 * is the only place that knows both and connects them.
 */
export class ComposedListingReader implements ListingReader {
  constructor(
    private readonly currencyOf: CurrencyOfListing,
    private readonly currentPriceOf: CurrentPriceOfListing,
  ) {}

  async get(listingId: ListingId): Promise<ListingView | null> {
    const currency = await this.currencyOf(listingId);
    if (currency === null) return null; // the Listing does not exist: there is no price to look for

    const currentPrice = await this.currentPriceOf(listingId);
    return { currency, currentPrice };
  }
}
