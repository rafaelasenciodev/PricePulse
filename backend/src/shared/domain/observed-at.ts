import { InvalidObservedAt } from "./errors";

// Date and time, then an optional fraction of a second, then a time zone that is always explicit.
const ISO_8601 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-](\d{2}):(\d{2}))$/;

/**
 * The moment at which a Provider saw the state of a Listing.
 *
 * It is an instant with millisecond precision, held as milliseconds since the epoch.
 * Two with the same instant are equal, whatever time zone they were written in.
 * Use the factory methods to create one.
 */
export class ObservedAt {
  private constructor(readonly epochMilliseconds: number) {}

  static fromEpochMilliseconds(milliseconds: number): ObservedAt {
    if (!Number.isSafeInteger(milliseconds) || Number.isNaN(new Date(milliseconds).getTime())) {
      throw new InvalidObservedAt(String(milliseconds));
    }
    return new ObservedAt(milliseconds);
  }

  /**
   * Parse a moment written as ISO 8601 with an explicit time zone, such as
   * "2026-11-19T10:00:00Z" or "2026-11-19T11:00:00+01:00".
   *
   * Strict: a moment without a time zone is rejected, because it would be read in the zone
   * of the machine. A date that does not exist (30 February) or a time that does not exist
   * (24:00, 10:60) is rejected too, instead of being moved to the next valid one.
   * Fractions of a second are cut at milliseconds.
   */
  static fromIsoString(text: string): ObservedAt {
    const match = ISO_8601.exec(text);
    if (match === null) throw new InvalidObservedAt(text);

    const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number) as [
      number, number, number, number, number, number,
    ];
    const offsetHour = Number(match[8] ?? 0);
    const offsetMinute = Number(match[9] ?? 0);

    // setUTCFullYear keeps years 0000 to 0099 as written; Date.UTC would read them as 19xx.
    const calendar = new Date(0);
    calendar.setUTCFullYear(year, month - 1, day);
    const dateExists = calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day;
    const timeExists = hour <= 23 && minute <= 59 && second <= 59 && offsetHour <= 23 && offsetMinute <= 59;
    if (!dateExists || !timeExists) throw new InvalidObservedAt(text);

    return ObservedAt.fromEpochMilliseconds(Date.parse(text));
  }

  /** The instant in UTC, such as "2026-11-19T10:00:00.000Z". */
  toIsoString(): string {
    return new Date(this.epochMilliseconds).toISOString();
  }

  equals(other: ObservedAt): boolean {
    return this.epochMilliseconds === other.epochMilliseconds;
  }
}
