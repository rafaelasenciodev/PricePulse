/** Errors raised by the domain of Price Observations when a business rule or an invariant is broken. */

import { DomainError, InvalidValue } from "../../shared/domain";

/*
 * Two groups, as in the domain model:
 * - InvalidValue: the value given cannot be accepted (a mistake of the Provider).
 * - Other domain errors: the observation breaks a rule of the Listing or of time.
 * The application reports all of them as an invalid observation.
 */

/** BR-04: the Price of a Price Observation cannot be negative. */
export class NegativePrice extends InvalidValue {
  constructor(amount: string) {
    super(`The Price cannot be negative, got ${amount}`);
  }
}

/** The Observed At is not a valid instant. */
export class InvalidObservedAt extends InvalidValue {
  constructor(value: string) {
    super(`The Observed At is not a valid instant: ${JSON.stringify(value)}`);
  }
}

/** BR-05: the currency of the Price is not the one of the Listing. */
export class ObservationCurrencyMismatch extends DomainError {
  constructor(priceCurrency: string, listingCurrency: string) {
    super(`The Price is in ${priceCurrency} but the Listing is priced in ${listingCurrency}`);
  }
}

/** BR-12: the Observed At is later than the moment of recording, beyond the tolerance. */
export class ObservedInTheFuture extends DomainError {
  constructor(observedAt: string, recordedAt: string) {
    super(`The Observed At ${observedAt} is later than the moment of recording ${recordedAt}`);
  }
}
