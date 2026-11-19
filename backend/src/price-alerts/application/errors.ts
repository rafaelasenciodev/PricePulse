/** Application errors expected by the use case contract. */

import type { ListingId } from "../domain";

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

/** BR-03, BR-04: the Target Price is not valid. */
export class InvalidTargetPrice extends ApplicationError {}

/** BR-07, BR-08: the User already has an Active Price Alert for the Listing with a different Target Price. */
export class DuplicateAlert extends ApplicationError {
  constructor() {
    super("The User already has an Active Price Alert for this Listing with a different Target Price");
  }
}

/** BR-05: the Current Price of the Listing already reaches the Target Price. */
export class TargetAlreadyReached extends ApplicationError {}
