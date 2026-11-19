/** Application errors that the callers of the use cases of Accounts must expect. */

/** Base class of the errors the caller of a use case must expect. */
export class ApplicationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** BR-01, BR-03: the email or the password is not acceptable. The message says which. */
export class InvalidRegistration extends ApplicationError {}

/** BR-02: the email already has an Account. */
export class EmailAlreadyRegistered extends ApplicationError {
  constructor() {
    super("The email is already registered");
  }
}

/** BR-05: the email or the password is not valid. It never says which of the two. */
export class InvalidCredentials extends ApplicationError {
  constructor() {
    super("The email or the password is not valid");
  }
}

/** BR-06: the email is locked. It carries the whole seconds to wait. */
export class TooManyAttempts extends ApplicationError {
  constructor(readonly secondsToWait: number) {
    super(`Too many failed attempts, try again in ${secondsToWait} seconds`);
  }
}

/** BR-08, BR-09: the token is unknown, expired, or of a Session that ended. */
export class Unauthenticated extends ApplicationError {
  constructor() {
    super("The token does not identify anybody");
  }
}
