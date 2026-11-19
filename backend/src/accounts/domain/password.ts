import { Email } from "./email";
import { PasswordIsEmail, PasswordTooLong, PasswordTooShort } from "./errors";

export const MINIMUM_PASSWORD_LENGTH = 10;
export const MAXIMUM_PASSWORD_LENGTH = 128;

/**
 * BR-03: a password has from 10 to 128 characters and is not the email. There are no other
 * rules of composition. Characters are counted as people see them, so an emoji is one.
 *
 * It is a rule and not a Value Object: a password is never kept (BR-04), so there is nothing
 * to hold once it has been checked and hashed.
 */
export function assertValidPassword(password: string, email: Email): void {
  const length = [...password].length;
  if (length < MINIMUM_PASSWORD_LENGTH) throw new PasswordTooShort(MINIMUM_PASSWORD_LENGTH);
  if (length > MAXIMUM_PASSWORD_LENGTH) throw new PasswordTooLong(MAXIMUM_PASSWORD_LENGTH);
  if (Email.normalize(password) === email.value) throw new PasswordIsEmail();
}
