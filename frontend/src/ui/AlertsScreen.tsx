import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { AlertStatus } from "../api";
import { useSession } from "../session";
import { failures, screens } from "../texts";
import { AlertEntry, type Outcome } from "./AlertEntry";
import { LoadFailed } from "./LoadFailed";
import { PAGE_SIZE, Pager, pageFrom } from "./Pager";
import { useRequest } from "./useRequest";
import { useTitles } from "./useTitles";

const STATUSES: readonly AlertStatus[] = ["active", "triggered", "cancelled"];

/** The state asked for in `?status=`. Anything else is every state. */
const statusFrom = (value: string | null): AlertStatus | undefined => STATUSES.find((status) => status === value);

/** The address of the list, with the state and the page that the address keeps (BR-02). */
function alertsAddress(status: AlertStatus | undefined, page?: number) {
  const query = new URLSearchParams();
  if (status !== undefined) query.set("status", status);
  if (page !== undefined) query.set("page", String(page));
  const search = query.toString();
  return { pathname: "/alerts", search: search === "" ? "" : `?${search}` };
}

/** A filter by state: a pill, and the one that is chosen is filled. */
const FILTER =
  "rounded-full border border-line px-3 py-1 text-sm text-ink no-underline hover:bg-surface " +
  "aria-[current=true]:border-accent aria-[current=true]:bg-accent aria-[current=true]:text-accent-ink";

/** The Price Alerts of the person, newest first, one page at a time, and filtered by state (BR-02, BR-03). */
export function AlertsScreen() {
  const { api } = useSession();
  const [params] = useSearchParams();
  const page = pageFrom(params.get("page"));
  const status = statusFrom(params.get("status"));
  const query = { ...(status === undefined ? {} : { status }), limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
  const { state, retry } = useRequest(() => api.alerts(query), [status, page]);
  // What a change told is kept here, not in the entry: the list is read again after it and the entries are made anew (BR-08).
  const [notice, setNotice] = useState<Outcome | null>(null);
  // A notice is about the list, not about a page of it: it stays when the list leads to another page, as it does when a
  // cancelled alert was the only one of the last page, and goes when the person chooses another state.
  useEffect(() => setNotice(null), [status]);
  // Each outcome starts a new generation of entries, so that the form or the question of the one that was acted on is
  // gone at once, and does not wait for the read to replace the list: a fast answer would not unmount it.
  const [generation, setGeneration] = useState(0);
  const titles = useTitles(state.status === "ready" ? state.data.items.map((alert) => alert.listingId) : []);

  let content;
  if (state.status === "loading") {
    content = <p role="status" className="text-muted">{screens.loading}</p>;
  } else if (state.status === "failed") {
    content = <LoadFailed message={failures.readAlerts.other} onRetry={retry} />;
  } else if (state.data.total === 0) {
    content = (
      <>
        <p className="mt-0 text-muted">{status === undefined ? screens.alerts.empty : screens.alerts.emptyFiltered}</p>
        {status === undefined && <Link to="/catalogue">{screens.alerts.toCatalogue}</Link>}
      </>
    );
  } else {
    content = (
      <Pager page={page} data={state.data} label={screens.alerts.pagesLabel} addressOf={(n) => alertsAddress(status, n)}>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {state.data.items.map((alert) => (
            <AlertEntry
              key={`${generation}:${alert.id}`}
              alert={alert}
              listing={titles.get(alert.listingId)}
              onOutcome={(outcome) => {
                setNotice(outcome);
                setGeneration((n) => n + 1);
                retry();
              }}
            />
          ))}
        </ul>
      </Pager>
    );
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">{screens.alerts.title}</h1>
      <nav aria-label={screens.alerts.filterLabel} className="mb-4 flex flex-wrap gap-2">
        {[undefined, ...STATUSES].map((option) => (
          <Link key={option ?? "all"} to={alertsAddress(option)} aria-current={option === status ? "true" : undefined} className={FILTER}>
            {screens.alerts.filters[option ?? "all"]}
          </Link>
        ))}
      </nav>
      {notice !== null && (
        <p role={notice.done ? "status" : "alert"} className={`mb-4 rounded-lg border bg-surface p-3 text-sm ${notice.done ? "border-line" : "border-danger text-danger"}`}>
          {notice.text}
        </p>
      )}
      {content}
    </>
  );
}
