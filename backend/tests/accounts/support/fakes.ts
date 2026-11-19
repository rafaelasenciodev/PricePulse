/**
 * Doubles of the ports of Accounts for the tests of the use cases. The in-memory adapters, which
 * the contracts check, come with the adapters; these are the smallest thing that lets a use case run.
 */

import {
  EmailAlreadyStored,
  type AccountRepository,
  type Clock,
  type LoginAttemptStore,
  type PasswordHasher,
  type SessionStore,
  type SessionTokens,
} from "../../../src/accounts/application";
import { FailedAttempts, type Account, type Email, type Session } from "../../../src/accounts/domain";
import type { UserId } from "../../../src/shared/domain";

export class FakeAccounts implements AccountRepository {
  readonly byEmail = new Map<string, Account>();
  /** Makes `findByEmail` answer null once, as if another registration were still to come. */
  hideOnce = false;

  async add(account: Account): Promise<void> {
    if (this.byEmail.has(account.email.value)) throw new EmailAlreadyStored();
    this.byEmail.set(account.email.value, account);
  }
  async findByEmail(email: Email): Promise<Account | null> {
    if (this.hideOnce) {
      this.hideOnce = false;
      return null;
    }
    return this.byEmail.get(email.value) ?? null;
  }
  async find(id: UserId): Promise<Account | null> {
    return [...this.byEmail.values()].find((a) => a.id === id) ?? null;
  }
}

export class FakeSessions implements SessionStore {
  readonly byHash = new Map<string, Session>();
  async add(session: Session): Promise<void> {
    this.byHash.set(session.tokenHash, session);
  }
  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    return this.byHash.get(tokenHash) ?? null;
  }
  async delete(tokenHash: string): Promise<void> {
    this.byHash.delete(tokenHash);
  }
}

export class FakeAttempts implements LoginAttemptStore {
  readonly byEmail = new Map<string, FailedAttempts>();
  async get(email: string): Promise<FailedAttempts> {
    return this.byEmail.get(email) ?? FailedAttempts.none();
  }
  async save(email: string, attempts: FailedAttempts): Promise<void> {
    this.byEmail.set(email, attempts);
  }
  async clear(email: string): Promise<void> {
    this.byEmail.delete(email);
  }
}

/** A hash that is the password written backwards with a mark: fast, and not the password itself. */
export class FakeHasher implements PasswordHasher {
  verifications: { password: string; hash: string }[] = [];
  hashes = 0;
  /** Every hash this hasher has made. */
  readonly produced = new Set<string>();
  async hash(password: string): Promise<string> {
    this.hashes++;
    const hash = `fake$${[...password].reverse().join("")}`;
    this.produced.add(hash);
    return hash;
  }
  async verify(password: string, hash: string): Promise<boolean> {
    this.verifications.push({ password, hash });
    return hash === `fake$${[...password].reverse().join("")}`;
  }
}

/** Tokens "token-1", "token-2", ... whose hash is "hash(token-1)". */
export class SequenceTokens implements SessionTokens {
  private next = 1;
  create(): string {
    return `token-${this.next++}`;
  }
  hash(token: string): string {
    return `hash(${token})`;
  }
}

export class MutableClock implements Clock {
  constructor(private time: number) {}
  now(): Date {
    return new Date(this.time);
  }
  advance(milliseconds: number): void {
    this.time += milliseconds;
  }
}
