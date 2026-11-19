/** In-memory implementations of the stores of Accounts, to run the application without infrastructure. */

import {
  EmailAlreadyStored,
  type AccountRepository,
  type LoginAttemptStore,
  type SessionStore,
} from "../application";
import { FailedAttempts, type Account, type Email, type Session } from "../domain";
import type { UserId } from "../../shared/domain";

/** Implements AccountRepository, including the uniqueness of the email. */
export class InMemoryAccountRepository implements AccountRepository {
  private readonly byEmail = new Map<string, Account>();

  async add(account: Account): Promise<void> {
    // The check and the insertion must not be separated by an `await`: JavaScript can
    // switch to another request at each `await`, which would break the guarantee.
    if (this.byEmail.has(account.email.value)) throw new EmailAlreadyStored();
    this.byEmail.set(account.email.value, account);
  }

  async findByEmail(email: Email): Promise<Account | null> {
    return this.byEmail.get(email.value) ?? null;
  }

  async find(id: UserId): Promise<Account | null> {
    for (const account of this.byEmail.values()) if (account.id === id) return account;
    return null;
  }

  /** Every stored Account. For tests and checks. */
  all(): Account[] {
    return [...this.byEmail.values()];
  }
}

/** Implements SessionStore. */
export class InMemorySessionStore implements SessionStore {
  private readonly byHash = new Map<string, Session>();

  async add(session: Session): Promise<void> {
    this.byHash.set(session.tokenHash, session);
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    return this.byHash.get(tokenHash) ?? null;
  }

  async delete(tokenHash: string): Promise<void> {
    this.byHash.delete(tokenHash);
  }

  /** Every stored Session. For tests and checks. */
  all(): Session[] {
    return [...this.byHash.values()];
  }
}

/** How many emails a LoginAttemptStore remembers unless it is told otherwise. */
export const DEFAULT_ATTEMPT_CAPACITY = 10_000;

/**
 * Implements LoginAttemptStore with a cap in size, so that trying many emails cannot make it
 * grow for ever. When it is full, the email that was written longest ago is dropped.
 *
 * Limitation: someone who tries as many different emails as the capacity can push out the
 * failures of another email, and with them its lock.
 */
export class InMemoryLoginAttemptStore implements LoginAttemptStore {
  // A Map iterates in insertion order, and a key that is saved again is moved to the end.
  private readonly byEmail = new Map<string, FailedAttempts>();

  constructor(private readonly capacity: number = DEFAULT_ATTEMPT_CAPACITY) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError("The capacity must be at least 1");
  }

  async get(email: string): Promise<FailedAttempts> {
    return this.byEmail.get(email) ?? FailedAttempts.none();
  }

  async save(email: string, attempts: FailedAttempts): Promise<void> {
    this.byEmail.delete(email);
    this.byEmail.set(email, attempts);
    if (this.byEmail.size > this.capacity) {
      const oldest = this.byEmail.keys().next().value as string;
      this.byEmail.delete(oldest);
    }
  }

  async clear(email: string): Promise<void> {
    this.byEmail.delete(email);
  }

  /** How many emails are remembered. For tests and checks. */
  size(): number {
    return this.byEmail.size;
  }
}
