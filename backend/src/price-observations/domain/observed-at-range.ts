import type { ObservedAt } from "../../shared/domain";
import { InvalidObservedRange } from "./errors";

/**
 * A stretch of time to read the Price History in (BR-06 of feature 05).
 *
 * It has a start and an end, and either may be absent: without a start it begins at the first
 * observation, and without an end it goes on to the last. The start is **included** and the end
 * is **excluded**, so that two ranges that meet at a moment share no observation.
 *
 * It is a Value Object because that rule has to give the same answer in every adapter, a
 * database one included. Use `of` to create one.
 */
export class ObservedAtRange {
  private constructor(
    readonly from: ObservedAt | null,
    readonly to: ObservedAt | null,
  ) {}

  /** Rejected if both ends are given and the start is not before the end. */
  static of(from: ObservedAt | null, to: ObservedAt | null): ObservedAtRange {
    if (from !== null && to !== null && from.epochMilliseconds >= to.epochMilliseconds) {
      throw new InvalidObservedRange(from.toIsoString(), to.toIsoString());
    }
    return new ObservedAtRange(from, to);
  }

  /** The range that has no start and no end: every moment is in it. */
  static unbounded(): ObservedAtRange {
    return new ObservedAtRange(null, null);
  }

  /** From the start, included, until the end, excluded. */
  includes(observedAt: ObservedAt): boolean {
    const moment = observedAt.epochMilliseconds;
    if (this.from !== null && moment < this.from.epochMilliseconds) return false;
    if (this.to !== null && moment >= this.to.epochMilliseconds) return false;
    return true;
  }
}
