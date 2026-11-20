import { useMemo } from "react";
import { useSession } from "../session";
import { messageFor, screens } from "../texts";
import { chartPoints, type ChartPoint } from "./chartPoints";
import { formatInstant, formatPrice } from "./format";
import { LoadFailed } from "./LoadFailed";
import { PriceChart } from "./PriceChart";
import { useRequest } from "./useRequest";

/** The newest observations that the application gives in one request (Q5). */
const HISTORY_LIMIT = 100;

/** The lowest or the highest price of the period shown, with the text that the API wrote (BR-07). */
function Extreme({ label, point }: { readonly label: string; readonly point: ChartPoint | null }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="m-0 text-lg font-semibold">{point === null ? "" : formatPrice(point)}</dd>
    </div>
  );
}

/**
 * The Price History of a Listing: a chart, the lowest and the highest price of what the chart shows, and the same
 * content as text. It reads on its own, so a failure to read it does not hide the rest of the Listing (BR-06, D2).
 */
export function PriceHistory({ listingId }: { readonly listingId: string }) {
  const { api } = useSession();
  const { state, retry } = useRequest(() => api.priceHistory(listingId, { limit: HISTORY_LIMIT, offset: 0 }), [listingId]);
  const data = useMemo(() => (state.status === "ready" ? chartPoints(state.data.items) : null), [state]);

  let body;
  if (state.status === "loading") {
    body = <p className="text-sm text-muted">{screens.history.loading}</p>;
  } else if (state.status === "failed") {
    body = <LoadFailed message={messageFor("readHistory", state.failure)} onRetry={retry} />;
  } else if (data === null || data.points.length < 2) {
    body = <p className="text-sm text-muted">{screens.history.notEnough}</p>;
  } else {
    const { points, lowest, highest } = data;
    body = (
      <>
        <dl className="m-0 mb-4 grid grid-cols-2 gap-4">
          <Extreme label={screens.history.lowest} point={lowest} />
          <Extreme label={screens.history.highest} point={highest} />
        </dl>
        <PriceChart points={points} />
        <table className="sr-only">
          <caption>{screens.history.tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{screens.history.moment}</th>
              <th scope="col">{screens.history.price}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.observedAt}>
                <td>{formatInstant(p.observedAt)}</td>
                <td>{formatPrice(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <section aria-labelledby="history-title" className="mt-8">
      <h2 id="history-title" className="mb-3 text-lg font-semibold">
        {screens.history.title}
      </h2>
      {body}
    </section>
  );
}
