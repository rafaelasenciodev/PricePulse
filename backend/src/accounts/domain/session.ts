import type { UserId } from "../../shared/domain";

/** BR-07: a Session lasts 7 days from its creation. */
export const SESSION_LIFETIME_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

/**
 * The period during which a token identifies an Account.
 *
 * It holds the hash of the token and never the token (ADR-0004). Instants are milliseconds
 * since the epoch, as the clock of the module gives them.
 */
export class Session {
  private constructor(
    readonly tokenHash: string,
    readonly userId: UserId,
    readonly createdAt: number,
    readonly expiresAt: number,
  ) {}

  static start(tokenHash: string, userId: UserId, now: number): Session {
    return new Session(tokenHash, userId, now, now + SESSION_LIFETIME_MILLISECONDS);
  }

  /** BR-08: valid until the expiry, which is already too late. */
  isValidAt(now: number): boolean {
    return now < this.expiresAt;
  }
}
