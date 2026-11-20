import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartPoint } from "./chartPoints";
import { formatInstant, formatPrice } from "./format";

interface Datum {
  readonly time: number;
  readonly value: number;
  readonly amount: string;
  readonly currency: string;
  readonly observedAt: string;
}

const DAY = 24 * 60 * 60 * 1000;
const dayAndMonth = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const hourAndMinute = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

/** What a point says when it is pointed at: its moment and its price, as the API wrote it (D1). */
function PointTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: Datum }[] }) {
  const point = payload?.[0]?.payload;
  if (!active || point === undefined) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-md">
      <p className="m-0 font-semibold">{formatPrice(point)}</p>
      <p className="m-0 text-xs text-muted">{formatInstant(point.observedAt)}</p>
    </div>
  );
}

/**
 * The line of the prices of a Listing over time. It is only drawn: what it means is said in text next to it, so the
 * chart is hidden from a screen reader (BR-07). The number of a point places it, and what is written is its text (D1).
 */
export function PriceChart({ points }: { readonly points: readonly ChartPoint[] }) {
  const data: Datum[] = points.map((p) => ({ time: Date.parse(p.observedAt), value: p.value, amount: p.amount, currency: p.currency, observedAt: p.observedAt }));
  const first = data[0]?.time ?? 0;
  const last = data[data.length - 1]?.time ?? 0;
  // Several points within a day or two are told apart by the hour, and a longer period by the day.
  const format = last - first < 2 * DAY ? hourAndMinute : dayAndMonth;

  return (
    <div aria-hidden="true" className="h-72 w-full text-xs">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 288 }}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(t: number) => format.format(t)} stroke="var(--muted)" tickLine={false} />
          <YAxis domain={["auto", "auto"]} width={56} stroke="var(--muted)" tickLine={false} axisLine={false} />
          <Tooltip content={<PointTooltip />} />
          <Line dataKey="value" type="linear" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: "var(--accent)" }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
