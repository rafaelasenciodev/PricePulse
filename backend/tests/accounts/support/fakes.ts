/**
 * Doubles for the tests of the use cases: the ports whose real adapter is slow or random. The stores
 * are the in-memory adapters, which the contracts check.
 */

import type { Clock, PasswordHasher, SessionTokens } from "../../../src/accounts/application";

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
