import type { PriceObservation } from "../api";

/**
 * One point of the chart. `amount` and `currency` are what the API wrote, and they are the only thing that is ever
 * shown. `value` exists to place the point on the axis and to find the lowest and the highest: it is never written
 * (D1 of the design of feature 13).
 */
export interface ChartPoint {
  readonly observedAt: string;
  readonly amount: string;
  readonly currency: string;
  readonly value: number;
}

export interface ChartData {
  /** Oldest first, which is the order of a time axis. */
  readonly points: readonly ChartPoint[];
  /** The lowest and the highest price of the points, or null when there are none. The earliest one when two are equal. */
  readonly lowest: ChartPoint | null;
  readonly highest: ChartPoint | null;
}

/**
 * The points of the chart from the Price History that the API gives, newest first (BR-03). An observation with no price
 * is left out and is never taken for zero. Zero, which the API accepts as a price, is a point.
 */
export function chartPoints(observations: readonly PriceObservation[]): ChartData {
  const points: ChartPoint[] = [];
  for (const { observedAt, price } of observations) {
    if (price === null) continue;
    const value = Number(price.amount);
    const time = Date.parse(observedAt);
    // What is not a number or a moment cannot be placed, so it is not drawn.
    if (!Number.isFinite(value) || Number.isNaN(time)) continue;
    points.push({ observedAt, amount: price.amount, currency: price.currency, value });
  }
  points.sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));

  let lowest: ChartPoint | null = null;
  let highest: ChartPoint | null = null;
  for (const point of points) {
    if (lowest === null || point.value < lowest.value) lowest = point;
    if (highest === null || point.value > highest.value) highest = point;
  }
  return { points, lowest, highest };
}
