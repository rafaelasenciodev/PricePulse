import { InvalidCreatedAt } from "./errors";

/**
 * The moment at which a Price Alert was created (BR-09 of feature 04).
 *
 * It is an instant with millisecond precision, held as milliseconds since the epoch. Two with
 * the same instant are equal. It holds no mutable object, which a `Date` would be.
 * Use the factory methods to create one.
 */
export class CreatedAt {
  private constructor(readonly epochMilliseconds: number) {}

  static fromEpochMilliseconds(milliseconds: number): CreatedAt {
    if (!Number.isSafeInteger(milliseconds) || Number.isNaN(new Date(milliseconds).getTime())) {
      throw new InvalidCreatedAt(String(milliseconds));
    }
    return new CreatedAt(milliseconds);
  }

  /** The moment of a `Date`, such as the one a clock gives. An invalid date is a defect of the clock. */
  static fromDate(date: Date): CreatedAt {
    return CreatedAt.fromEpochMilliseconds(date.getTime());
  }

  /** The instant in UTC, such as "2026-11-19T10:00:00.000Z". */
  toIsoString(): string {
    return new Date(this.epochMilliseconds).toISOString();
  }

  equals(other: CreatedAt): boolean {
    return this.epochMilliseconds === other.epochMilliseconds;
  }
}
