/**
 * The points of the chart (feature 13): the rules of what is drawn, which are checked here and not on the SVG
 * (D3 of the design). Each test names the scenario (SC-nn) or the rule (BR-nn).
 */

import { describe, expect, it } from "vitest";
import type { PriceObservation } from "../../src/api";
import { chartPoints } from "../../src/ui/chartPoints";

const at = (hour: number, amount: string | null): PriceObservation => ({
  observedAt: `2026-11-19T${String(hour).padStart(2, "0")}:00:00.000Z`,
  price: amount === null ? null : { amount, currency: "EUR" },
});

describe("chartPoints", () => {
  it("SC-05: has one point for each observation, oldest first, though the API gives the newest first", () => {
    const { points } = chartPoints([at(12, "90.00"), at(11, "95.00"), at(10, "100.00")]);
    expect(points.map((p) => p.amount)).toEqual(["100.00", "95.00", "90.00"]);
  });

  it("SC-06 / BR-03: an observation with no price is not a point, and no point is zero", () => {
    const { points } = chartPoints([at(12, "90.00"), at(11, null), at(10, "100.00")]);
    expect(points.map((p) => p.amount)).toEqual(["100.00", "90.00"]);
    expect(points.some((p) => p.value === 0)).toBe(false);
  });

  it("BR-03: zero, which is a valid price, is a point", () => {
    expect(chartPoints([at(10, "0.00"), at(11, "5.00")]).points.map((p) => p.amount)).toEqual(["0.00", "5.00"]);
  });

  it("SC-07 / BR-04: counts the points that there really are, so that the screen can tell fewer than two", () => {
    expect(chartPoints([]).points).toHaveLength(0);
    expect(chartPoints([at(10, null)]).points).toHaveLength(0);
    expect(chartPoints([at(10, "10.00"), at(11, null)]).points).toHaveLength(1);
  });

  it("SC-08 / BR-07: gives the lowest and the highest price with the text that the API wrote", () => {
    const { lowest, highest } = chartPoints([at(10, "100.00"), at(11, "79.90"), at(12, "90.00")]);
    expect(lowest?.amount).toBe("79.90");
    expect(highest?.amount).toBe("100.00");
  });

  it("SC-08: compares prices as amounts and not as text, so that 9.50 is lower than 10.00", () => {
    const { lowest, highest } = chartPoints([at(10, "10.00"), at(11, "9.50")]);
    expect(lowest?.amount).toBe("9.50");
    expect(highest?.amount).toBe("10.00");
  });

  it("SC-08: when two prices are equal it gives the earliest", () => {
    const { lowest } = chartPoints([at(12, "50.00"), at(10, "50.00"), at(11, "60.00")]);
    expect(lowest?.observedAt).toBe("2026-11-19T10:00:00.000Z");
  });

  it("has no lowest and no highest without points", () => {
    expect(chartPoints([at(10, null)])).toEqual({ points: [], lowest: null, highest: null });
  });

  it("does not draw what cannot be placed: an amount that is not a number, or a moment that is not a date", () => {
    const bad: PriceObservation[] = [
      { observedAt: "2026-11-19T10:00:00.000Z", price: { amount: "n/a", currency: "EUR" } },
      { observedAt: "yesterday", price: { amount: "10.00", currency: "EUR" } },
    ];
    expect(chartPoints([...bad, at(11, "20.00")]).points.map((p) => p.amount)).toEqual(["20.00"]);
  });

  it("SC-10: draws every observation that it is given, so the limit belongs to the request", () => {
    const hundred = Array.from({ length: 100 }, (_, i) => ({
      observedAt: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString(),
      price: { amount: `${i + 1}.00`, currency: "EUR" },
    }));
    expect(chartPoints(hundred).points).toHaveLength(100);
  });
});
