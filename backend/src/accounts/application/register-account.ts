/** UC-01 Register (see the design). */

import { InvalidValue } from "../../shared/domain";
import {
  Account,
  Email,
  InvalidEmail,
  PasswordIsEmail,
  PasswordTooLong,
  PasswordTooShort,
  assertValidPassword,
  newUserId,
} from "../domain";
import { toView, type AccountView } from "./account-view";
import { EmailAlreadyRegistered, InvalidRegistration, type RegistrationProblem } from "./errors";
import { EmailAlreadyStored, type AccountRepository, type PasswordHasher } from "./ports";

export interface RegisterAccountCommand {
  readonly email: string;
  readonly password: string;
}

export class RegisterAccount {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(command: RegisterAccountCommand): Promise<AccountView> {
    // 1. The email and the password are valid (BR-01, BR-03)
    let email: Email;
    try {
      email = Email.of(command.email);
      assertValidPassword(command.password, email);
    } catch (error) {
      const problem = problemOf(error);
      if (problem !== null) throw new InvalidRegistration((error as InvalidValue).message, problem, { cause: error });
      throw error;
    }

    // 2. No Account has that email (BR-02). The hash is slow on purpose, so it comes after.
    if ((await this.accounts.findByEmail(email)) !== null) throw new EmailAlreadyRegistered();

    // 3. Only the hash is stored (BR-04). If another registration came first, the store refuses.
    const account = new Account(newUserId(), email, await this.hasher.hash(command.password));
    try {
      await this.accounts.add(account);
    } catch (error) {
      if (error instanceof EmailAlreadyStored) throw new EmailAlreadyRegistered();
      throw error;
    }
    return toView(account);
  }
}

/**
 * What is wrong with a registration, from the rule of the domain that was broken. An error of the domain that is not
 * one of these four would be a defect and not a mistake of the person, so it is not turned into a problem.
 */
function problemOf(error: unknown): RegistrationProblem | null {
  if (error instanceof InvalidEmail) return "EMAIL_NOT_VALID";
  if (error instanceof PasswordTooShort) return "PASSWORD_TOO_SHORT";
  if (error instanceof PasswordTooLong) return "PASSWORD_TOO_LONG";
  if (error instanceof PasswordIsEmail) return "PASSWORD_IS_EMAIL";
  return null;
}
