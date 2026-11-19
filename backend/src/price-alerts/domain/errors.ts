/** Errors raised by the domain when a business rule or an invariant is broken. */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * A value given by a User that is not acceptable (BR-03, BR-04).
 *
 * The application reports every InvalidValue as an invalid Target Price. A new
 * validation of that kind extends this class and is reported without further changes.
 * Errors that are not a mistake of the User (an unsupported currency of the
 * catalogue, a mismatch of currencies) do not extend it: they are internal errors.
 */
export class InvalidValue extends DomainError {}

/** The catalogue holds a currency the system does not support. An internal error. */
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

/** BR-04: more decimal places than the currency allows. */
export class TooManyDecimals extends InvalidValue {
  constructor(amount: string, currency: string, allowed: number) {
    super(`${amount} ${currency} has more than ${allowed} decimal places`);
  }
}

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

/** BR-05: the Current Price already reaches the Target Price. */
export class TargetAlreadyReached extends DomainError {
  constructor() {
    super("The Target Price is already reached by the Current Price");
  }
}
