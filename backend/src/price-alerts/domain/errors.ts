/** Errors raised by the domain of Price Alerts when a business rule or an invariant is broken. */

import { DomainError, InvalidValue } from "../../shared/domain";

/*
 * The application reports every InvalidValue as an invalid Target Price (a mistake of the
 * User, BR-03, BR-04) and lets any other domain error through as an internal one. Errors
 * that are not a mistake of the User (an unsupported currency of the catalogue, a mismatch
 * of currencies) do not extend InvalidValue.
 */

/** BR-03: the Target Price must be greater than zero. */
export class NonPositiveTargetPrice extends InvalidValue {
  constructor(amount: string) {
    super(`The Target Price must be greater than zero, got ${amount}`);
  }
}

/** Prices in different currencies cannot be compared. */
export class CurrencyMismatch extends DomainError {
  constructor(first: string, second: string) {
    super(`Cannot compare prices in ${first} and ${second}`);
  }
}

/** BR-06: only an Active Price Alert can become Triggered. A defect if it happens: the use case never asks. */
export class AlertNotActive extends DomainError {
  constructor(alertId: string) {
    super(`The Price Alert ${JSON.stringify(alertId)} is not Active`);
  }
}

/** BR-04: a Notification is only produced for a Price Alert that the Current Price reaches. */
export class TargetNotReached extends DomainError {
  constructor(alertId: string) {
    super(`The Current Price does not reach the Target Price of the Price Alert ${JSON.stringify(alertId)}`);
  }
}

/** BR-05: the Current Price already reaches the Target Price. */
export class TargetAlreadyReached extends DomainError {
  constructor() {
    super("The Target Price is already reached by the Current Price");
  }
}
