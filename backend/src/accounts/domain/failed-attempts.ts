/** BR-06: after this many failed sign-ins in a row an email is locked. */
export const MAXIMUM_FAILED_ATTEMPTS = 5;
export const LOCK_MILLISECONDS = 15 * 60 * 1000;

/**
 * How many sign-ins in a row have failed for an email, and until when it is locked (BR-06).
 *
 * It is immutable: a failure gives the next state. The lock runs from the failure that
 * caused it and attempts refused during it do not extend it. A lock that has passed counts
 * as no failures. Clearing the count after a success is the job of the store.
 */
export class FailedAttempts {
  private constructor(
    readonly count: number,
    readonly lockedUntil: number | null,
  ) {}

  static none(): FailedAttempts {
    return new FailedAttempts(0, null);
  }

  /** Rebuilds the state a store has kept. */
  static of(count: number, lockedUntil: number | null): FailedAttempts {
    return new FailedAttempts(count, lockedUntil);
  }

  isLockedAt(now: number): boolean {
    return this.lockedUntil !== null && now < this.lockedUntil;
  }

  /** Whole seconds to wait, rounded up, or 0 if it is not locked. */
  secondsToWaitAt(now: number): number {
    return this.isLockedAt(now) ? Math.ceil((this.lockedUntil! - now) / 1000) : 0;
  }

  /** The state after a sign-in fails at `now`. Failing while locked changes nothing. */
  afterFailureAt(now: number): FailedAttempts {
    if (this.isLockedAt(now)) return this;
    const previous = this.lockedUntil === null ? this.count : 0;
    const count = previous + 1;
    return new FailedAttempts(count, count >= MAXIMUM_FAILED_ATTEMPTS ? now + LOCK_MILLISECONDS : null);
  }
}
