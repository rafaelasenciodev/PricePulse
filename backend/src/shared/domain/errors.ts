/** Errors of the concepts that several features share: money, instants and their validation. */

/** Errors raised by the domain when a business rule or an invariant is broken. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * A value given by a caller that is not acceptable.
 *
 * Each feature decides how it reports an InvalidValue to its own caller. A new validation
 * of that kind extends this class and is reported without further changes. Errors that are
 * not a mistake of the caller (an unsupported currency held by the catalogue, for example)
 * do not extend it: they are internal errors.
 */
export class InvalidValue extends DomainError {}

/** The system holds a currency it does not support. An internal error. */
export class UnsupportedCurrency extends DomainError {
  constructor(currency: string) {
    super(`Unsupported currency: ${JSON.stringify(currency)}`);
  }
}

export class InvalidAmount extends InvalidValue {
  constructor(amount: string) {
    super(`The amount is not a valid number: ${JSON.stringify(amount)}`);
  }
}

/** The Observed At is not a valid instant. */
export class InvalidObservedAt extends InvalidValue {
  constructor(value: string) {
    super(`The Observed At is not a valid instant: ${JSON.stringify(value)}`);
  }
}

/** More decimal places than the currency allows. */
export class TooManyDecimals extends InvalidValue {
  constructor(amount: string, currency: string, allowed: number) {
    super(`${amount} ${currency} has more than ${allowed} decimal places`);
  }
}
