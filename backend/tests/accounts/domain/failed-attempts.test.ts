import { describe, expect, it } from "vitest";
import { FailedAttempts, LOCK_MILLISECONDS, MAXIMUM_FAILED_ATTEMPTS } from "../../../src/accounts/domain";

const MINUTE = 60 * 1000;
const T0 = Date.parse("2026-11-19T10:00:00Z");

/** `n` failures in a row, one second apart, the last one at `T0 + (n - 1) * 1000`. */
function failures(n: number): FailedAttempts {
  let attempts = FailedAttempts.none();
  for (let i = 0; i < n; i++) attempts = attempts.afterFailureAt(T0 + i * 1000);
  return attempts;
}
const FIFTH = T0 + 4 * 1000;

describe("FailedAttempts", () => {
  it("BR-06: the numbers are 5 failures and 15 minutes", () => {
    expect(MAXIMUM_FAILED_ATTEMPTS).toBe(5);
    expect(LOCK_MILLISECONDS).toBe(15 * MINUTE);
  });

  it("starts with no failures and is not locked", () => {
    const none = FailedAttempts.none();
    expect(none.count).toBe(0);
    expect(none.isLockedAt(T0)).toBe(false);
    expect(none.secondsToWaitAt(T0)).toBe(0);
  });

  it.each([1, 2, 3, 4])("SC-11 / BR-06: %i failures do not lock", (n) => {
    const attempts = failures(n);
    expect(attempts.count).toBe(n);
    expect(attempts.isLockedAt(T0 + 10_000)).toBe(false);
  });

  it("SC-11 / BR-06: the fifth failure locks for 15 minutes from that failure", () => {
    const attempts = failures(5);
    expect(attempts.isLockedAt(FIFTH)).toBe(true);
    expect(attempts.lockedUntil).toBe(FIFTH + 15 * MINUTE);
    expect(attempts.secondsToWaitAt(FIFTH)).toBe(15 * 60);
  });

  it("SC-11: the time to wait is rounded up to whole seconds", () => {
    expect(failures(5).secondsToWaitAt(FIFTH + 1)).toBe(15 * 60);
    expect(failures(5).secondsToWaitAt(FIFTH + 14 * MINUTE + 59_500)).toBe(1);
  });

  it.each([
    [15 * MINUTE - 1, true],
    [15 * MINUTE, false],
    [15 * MINUTE + 1, false],
  ])("SC-13 / BR-06: %i ms after the fifth failure it is locked: %s", (elapsed, locked) => {
    expect(failures(5).isLockedAt(FIFTH + elapsed)).toBe(locked);
  });

  it("BR-06: a failure while locked changes nothing, so the lock is not extended", () => {
    const locked = failures(5);
    expect(locked.afterFailureAt(FIFTH + 5 * MINUTE)).toBe(locked);
  });

  it("BR-06: a lock that has passed counts as no failures, so it takes 5 more to lock again", () => {
    const later = FIFTH + 15 * MINUTE;
    let attempts = failures(5);
    for (let i = 1; i <= 4; i++) {
      attempts = attempts.afterFailureAt(later + i);
      expect(attempts.count).toBe(i);
      expect(attempts.isLockedAt(later + i)).toBe(false);
    }
    expect(attempts.afterFailureAt(later + 5).isLockedAt(later + 5)).toBe(true);
  });

  it("is immutable: a failure gives a new state and leaves the earlier one as it was", () => {
    const before = failures(2);
    before.afterFailureAt(T0 + 5000);
    expect(before.count).toBe(2);
  });

  it("rebuilds the state a store kept", () => {
    const kept = FailedAttempts.of(5, FIFTH + 15 * MINUTE);
    expect(kept.isLockedAt(FIFTH)).toBe(true);
    expect(FailedAttempts.of(3, null).count).toBe(3);
  });
});
