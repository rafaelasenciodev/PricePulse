/** Ports: what the use cases of Accounts need from the outside (design, section 3). */

import type { UserId } from "../../shared/domain";
import type { Account, Email, FailedAttempts, Session } from "../domain";

/**
 * The email is already stored.
 *
 * Thrown by the repository when adding violates the uniqueness of the email. It is handled
 * inside the use case and reaches the caller as EmailAlreadyRegistered.
 */
export class EmailAlreadyStored extends Error {
  constructor() {
    super("An Account with this email is already stored");
    this.name = "EmailAlreadyStored";
  }
}

export interface AccountRepository {
  /** Stores a new Account. Atomic: throws EmailAlreadyStored if the email is stored, so two registrations at once leave one. */
  add(account: Account): Promise<void>;
  findByEmail(email: Email): Promise<Account | null>;
  find(id: UserId): Promise<Account | null>;
}

export interface SessionStore {
  add(session: Session): Promise<void>;
  /** A Session is found only by the hash of its token. */
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  /** Deleting one that does not exist is not an error. */
  delete(tokenHash: string): Promise<void>;
}

/** What an email had before an attempt was counted, and what it has now. */
export interface AttemptChange {
  readonly before: FailedAttempts;
  readonly after: FailedAttempts;
}

/**
 * The sign-in attempts of each email, by its normal form (`Email.normalize`), valid or not.
 * Capped in size so that trying many emails cannot make it grow for ever: the oldest are dropped.
 */
export interface LoginAttemptStore {
  /**
   * Replaces the state of the email by what `change` makes of the current one, and gives both.
   *
   * It is atomic: of attempts that arrive at the same time, each one sees the state that the
   * previous one left, so none is lost. That is what makes the limit hold (BR-06, SC-25).
   * `change` must be a pure function, since a database may need to run it more than once.
   */
  update(email: string, change: (current: FailedAttempts) => FailedAttempts): Promise<AttemptChange>;
  /** Gives the email no attempts. Clearing one that has none is not an error. */
  clear(email: string): Promise<void>;
}

export interface PasswordHasher {
  /** A hash that carries its version and parameters, with a salt of its own. */
  hash(password: string): Promise<string>;
  /** Takes the same time whatever the hash is. A text that is not a hash does not match. */
  verify(password: string, hash: string): Promise<boolean>;
}

export interface SessionTokens {
  /** A new token, random and unpredictable. */
  create(): string;
  /** The hash that is stored in place of the token. The same token always gives the same hash. */
  hash(token: string): string;
}

/** The current moment. A port of this module, since a module cannot import the one of another. */
export interface Clock {
  now(): Date;
}
