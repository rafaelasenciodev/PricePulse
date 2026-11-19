/** Errors raised by the domain of Accounts when a business rule is broken. */

import { InvalidValue } from "../../shared/domain";

/*
 * Every error here is a mistake of the person who registers, so they all extend InvalidValue
 * and the application reports them as an invalid registration (BR-01, BR-03).
 */

/** BR-01: the text is not an email. The text is not repeated, since it may be anything. */
export class InvalidEmail extends InvalidValue {
  constructor() {
    super("The email is not valid");
  }
}

/** BR-03: fewer than the minimum number of characters. */
export class PasswordTooShort extends InvalidValue {
  constructor(minimum: number) {
    super(`The password must have at least ${minimum} characters`);
  }
}

/** BR-03: more than the maximum number of characters. */
export class PasswordTooLong extends InvalidValue {
  constructor(maximum: number) {
    super(`The password must have at most ${maximum} characters`);
  }
}

/** BR-03: the password is the email. */
export class PasswordIsEmail extends InvalidValue {
  constructor() {
    super("The password must not be the email");
  }
}
