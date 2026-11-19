import { describe, expect, it } from "vitest";
import { InvalidObservedAt, ObservedAt } from "../../../src/price-observations/domain";
import { InvalidValue } from "../../../src/shared/domain";

describe("ObservedAt", () => {
  it("reads the same instant written in different time zones as equal", () => {
    const utc = ObservedAt.fromIsoString("2026-11-19T10:00:00Z");
    const madrid = ObservedAt.fromIsoString("2026-11-19T11:00:00+01:00");
    const newYork = ObservedAt.fromIsoString("2026-11-19T05:00:00-05:00");
    expect(madrid.equals(utc)).toBe(true);
    expect(newYork.equals(utc)).toBe(true);
    expect(madrid.epochMilliseconds).toBe(Date.UTC(2026, 10, 19, 10, 0, 0));
  });

  it("tells two different instants apart", () => {
    const first = ObservedAt.fromIsoString("2026-11-19T10:00:00Z");
    const second = ObservedAt.fromIsoString("2026-11-19T10:00:00.001Z");
    expect(first.equals(second)).toBe(false);
  });

  it("keeps milliseconds and cuts any further fraction of a second", () => {
    expect(ObservedAt.fromIsoString("2026-11-19T10:00:00.123Z").toIsoString()).toBe("2026-11-19T10:00:00.123Z");
    expect(ObservedAt.fromIsoString("2026-11-19T10:00:00.1239999Z").toIsoString()).toBe("2026-11-19T10:00:00.123Z");
  });

  it("writes the instant in UTC", () => {
    expect(ObservedAt.fromIsoString("2026-11-19T11:00:00+01:00").toIsoString()).toBe("2026-11-19T10:00:00.000Z");
  });

  it("accepts a leap day only in a leap year", () => {
    expect(() => ObservedAt.fromIsoString("2028-02-29T10:00:00Z")).not.toThrow();
    expect(() => ObservedAt.fromIsoString("2026-02-29T10:00:00Z")).toThrow(InvalidObservedAt);
  });

  it.each([
    ["no time zone", "2026-11-19T10:00:00"],
    ["a date only", "2026-11-19"],
    ["a space instead of T", "2026-11-19 10:00:00Z"],
    ["text", "yesterday"],
    ["an empty text", ""],
    ["a month that does not exist", "2026-13-01T10:00:00Z"],
    ["a day that does not exist", "2026-02-30T10:00:00Z"],
    ["24:00, which Date would move to the next day", "2026-11-19T24:00:00Z"],
    ["a minute that does not exist", "2026-11-19T10:60:00Z"],
    ["a second that does not exist", "2026-11-19T10:00:60Z"],
    ["an offset that does not exist", "2026-11-19T10:00:00+24:00"],
    ["a space around it", " 2026-11-19T10:00:00Z"],
  ])("rejects %s", (_why, text) => {
    expect(() => ObservedAt.fromIsoString(text)).toThrow(InvalidObservedAt);
  });

  it("an invalid Observed At is a mistake of the Provider", () => {
    expect(() => ObservedAt.fromIsoString("yesterday")).toThrow(InvalidValue);
  });

  it("keeps years before 100 as written", () => {
    expect(ObservedAt.fromIsoString("0024-02-29T00:00:00Z").toIsoString()).toBe("0024-02-29T00:00:00.000Z");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 1.5, 8.64e15 + 1])("rejects %s milliseconds", (milliseconds) => {
    expect(() => ObservedAt.fromEpochMilliseconds(milliseconds)).toThrow(InvalidObservedAt);
  });
});
