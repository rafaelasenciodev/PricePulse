import type { Clock } from "../application";

/** Implements Clock with the time of the machine. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
