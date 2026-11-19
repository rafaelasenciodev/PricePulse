import { describe, expect, it } from "vitest";
import { InvalidObservedRange, ObservedAtRange } from "../../../src/price-observations/domain";
import { InvalidValue, ObservedAt } from "../../../src/shared/domain";

const at = (hour: string) => ObservedAt.fromIsoString(`2026-11-19T${hour}:00Z`);

describe("ObservedAtRange.includes", () => {
  const range = ObservedAtRange.of(at("10:00"), at("12:00"));

  it("SC-16 / BR-06: includes its start", () => {
    expect(range.includes(at("10:00"))).toBe(true);
  });

  it("SC-16 / BR-06: leaves out its end", () => {
    expect(range.includes(at("12:00"))).toBe(false);
  });

  it("SC-16 / BR-06: includes what is between the start and the end", () => {
    expect(range.includes(at("11:00"))).toBe(true);
  });

  it("leaves out what is before the start and after the end", () => {
    expect(range.includes(at("09:00"))).toBe(false);
    expect(range.includes(at("13:00"))).toBe(false);
  });

  it("tells the milliseconds apart at both ends", () => {
    const start = ObservedAt.fromIsoString("2026-11-19T10:00:00.000Z");
    const justBefore = ObservedAt.fromIsoString("2026-11-18T23:59:59.999Z");
    const lastIncluded = ObservedAt.fromIsoString("2026-11-19T11:59:59.999Z");
    expect(range.includes(start)).toBe(true);
    expect(range.includes(justBefore)).toBe(false);
    expect(range.includes(lastIncluded)).toBe(true);
  });

  it("SC-17 / BR-06: a range with only a start includes everything from it on", () => {
    const from = ObservedAtRange.of(at("11:00"), null);
    expect([at("10:00"), at("11:00"), at("12:00")].map((m) => from.includes(m))).toEqual([false, true, true]);
  });

  it("SC-17 / BR-06: a range with only an end includes everything before it", () => {
    const until = ObservedAtRange.of(null, at("11:00"));
    expect([at("10:00"), at("11:00"), at("12:00")].map((m) => until.includes(m))).toEqual([true, false, false]);
  });

  it("the unbounded range includes every moment", () => {
    const all = ObservedAtRange.unbounded();
    expect([at("00:00"), at("12:00"), at("23:59")].every((m) => all.includes(m))).toBe(true);
  });

  it("two ranges that meet at a moment share no observation", () => {
    const first = ObservedAtRange.of(at("10:00"), at("11:00"));
    const second = ObservedAtRange.of(at("11:00"), at("12:00"));
    const meeting = at("11:00");
    expect([first.includes(meeting), second.includes(meeting)]).toEqual([false, true]);
  });

  it("keeps its ends, for an adapter that has to ask a database the same question", () => {
    expect(range.from?.equals(at("10:00"))).toBe(true);
    expect(range.to?.equals(at("12:00"))).toBe(true);
    expect(ObservedAtRange.unbounded().from).toBeNull();
    expect(ObservedAtRange.unbounded().to).toBeNull();
  });
});

describe("ObservedAtRange.of", () => {
  it("SC-18 / BR-06: rejects a start after the end", () => {
    expect(() => ObservedAtRange.of(at("12:00"), at("10:00"))).toThrow(InvalidObservedRange);
  });

  it("SC-18 / BR-06: rejects a start equal to the end", () => {
    expect(() => ObservedAtRange.of(at("10:00"), at("10:00"))).toThrow(InvalidObservedRange);
  });

  it("accepts a start one millisecond before the end", () => {
    const from = ObservedAt.fromIsoString("2026-11-19T10:00:00.000Z");
    const to = ObservedAt.fromIsoString("2026-11-19T10:00:00.001Z");
    expect(() => ObservedAtRange.of(from, to)).not.toThrow();
  });

  it.each([
    ["only a start", at("10:00"), null],
    ["only an end", null, at("10:00")],
    ["neither", null, null],
  ])("accepts a range with %s", (_name, from, to) => {
    expect(() => ObservedAtRange.of(from, to)).not.toThrow();
  });

  it("the mistake is a value that cannot be accepted, and the message tells both ends", () => {
    const outcome = (() => {
      try {
        ObservedAtRange.of(at("12:00"), at("10:00"));
      } catch (error) {
        return error as Error;
      }
      return null;
    })();
    expect(outcome).toBeInstanceOf(InvalidValue);
    expect(outcome?.message).toContain("2026-11-19T12:00:00.000Z");
    expect(outcome?.message).toContain("2026-11-19T10:00:00.000Z");
  });
});
