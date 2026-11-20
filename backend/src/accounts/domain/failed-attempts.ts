/** BR-06: at this many sign-in attempts in a row an email is locked. */
export const MAXIMUM_FAILED_ATTEMPTS = 5;
export const LOCK_MILLISECONDS = 15 * 60 * 1000;

/**
 * How many sign-in attempts in a row an email has had, and until when it is locked (BR-06).
 *
 * An attempt is counted when it starts, before the password is checked, and a success clears the
 * count. So attempts that arrive at the same time are all counted, and an attempt that fails needs
 * nothing more. It is immutable: an attempt gives the next state. The lock runs from the attempt
 * that caused it and attempts refused during it do not extend it. A lock that has passed counts as
 * no attempts. Clearing the count after a success is the job of the store.
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

  /** The state after an attempt at `now`. An attempt while locked changes nothing. */
  afterAttemptAt(now: number): FailedAttempts {
    if (this.isLockedAt(now)) return this;
    const previous = this.lockedUntil === null ? this.count : 0;
    const count = previous + 1;
    return new FailedAttempts(count, count >= MAXIMUM_FAILED_ATTEMPTS ? now + LOCK_MILLISECONDS : null);
  }
}
