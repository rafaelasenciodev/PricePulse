import { describe, expect, it } from "vitest";
import { CreatedAt, InvalidCreatedAt } from "../../../src/price-alerts/domain";

describe("CreatedAt", () => {
  it("is the instant of a Date, in UTC with milliseconds", () => {
    const createdAt = CreatedAt.fromDate(new Date("2026-11-19T11:00:00.123+01:00"));
    expect(createdAt.toIsoString()).toBe("2026-11-19T10:00:00.123Z");
    expect(createdAt.epochMilliseconds).toBe(Date.UTC(2026, 10, 19, 10, 0, 0, 123));
  });

  it("compares by instant", () => {
    const first = CreatedAt.fromEpochMilliseconds(1_000);
    expect(first.equals(CreatedAt.fromEpochMilliseconds(1_000))).toBe(true);
    expect(first.equals(CreatedAt.fromEpochMilliseconds(1_001))).toBe(false);
  });

  it("does not change with the Date it was made from", () => {
    const date = new Date("2026-11-19T10:00:00Z");
    const createdAt = CreatedAt.fromDate(date);
    date.setUTCFullYear(2000);
    expect(createdAt.toIsoString()).toBe("2026-11-19T10:00:00.000Z");
  });

  it.each([[Number.NaN], [1.5], [8.64e15 + 1], [Number.POSITIVE_INFINITY]])(
    "rejects %s: a clock that gives an instant that does not exist is a defect",
    (milliseconds) => {
      expect(() => CreatedAt.fromEpochMilliseconds(milliseconds)).toThrow(InvalidCreatedAt);
    },
  );

  it("rejects an invalid Date", () => {
    expect(() => CreatedAt.fromDate(new Date("not a date"))).toThrow(InvalidCreatedAt);
  });
});
