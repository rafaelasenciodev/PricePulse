/** Application errors expected by the use case contract. */

import type { ListingId } from "../../shared/domain";

/** Base class of the errors the caller of a use case must expect. */
export class ApplicationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** BR-02: the Listing does not exist. */
export class ListingNotFound extends ApplicationError {
  constructor(readonly listingId: ListingId) {
    super(`The Listing ${JSON.stringify(listingId)} does not exist`);
  }
}

/**
 * BR-04, BR-05, BR-12: the Price Observation is not valid.
 * The message tells which part: the Observed At, the amount or the currency.
 */
export class InvalidObservation extends ApplicationError {}

/** BR-10: a Price Observation with the same Provider, Listing and Observed At is stored with different content. */
export class ObservationConflict extends ApplicationError {
  constructor() {
    super("A Price Observation with the same Provider, Listing and Observed At is stored with different content");
  }
}
