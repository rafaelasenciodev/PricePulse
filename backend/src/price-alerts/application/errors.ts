/** Application errors expected by the use case contract. */

import type { ListingId } from "../../shared/domain";
import type { AlertId, AlertStatus } from "../domain";

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
 * BR-01 of feature 04: the Price Alert does not exist, or it belongs to another User. The two
 * cases are not told apart, in the error or in its message.
 */
export class AlertNotFound extends ApplicationError {
  constructor(readonly alertId: AlertId) {
    super(`The Price Alert ${JSON.stringify(alertId)} does not exist`);
  }
}

/**
 * BR-04, BR-05 of feature 04: the request needs the Price Alert to be Active, and it is not.
 * It was Triggered, so it has ended, or it was Cancelled.
 */
export class AlertNotActive extends ApplicationError {
  constructor(readonly status: AlertStatus) {
    super(`The Price Alert is ${status}, and only an Active one can be changed`);
  }
}

/**
 * BR-08 of feature 04: the Price Alert changed state between being read and being saved, for
 * example because an Evaluation Triggered it. Nothing was changed, and the request can be repeated.
 */
export class AlertConflict extends ApplicationError {
  constructor() {
    super("The Price Alert changed while the request was being applied");
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
