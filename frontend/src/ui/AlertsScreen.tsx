import { Link, useSearchParams } from "react-router-dom";
import type { AlertStatus } from "../api";
import { useSession } from "../session";
import { failures, screens } from "../texts";
import { AlertEntry } from "./AlertEntry";
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

/** The Price Alerts of the person, newest first, one page at a time, and filtered by state (BR-02, BR-03). */
export function AlertsScreen() {
  const { api } = useSession();
  const [params] = useSearchParams();
  const page = pageFrom(params.get("page"));
  const status = statusFrom(params.get("status"));
  const query = { ...(status === undefined ? {} : { status }), limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
  const { state, retry } = useRequest(() => api.alerts(query), [status, page]);
  const titles = useTitles(state.status === "ready" ? state.data.items.map((alert) => alert.listingId) : []);

  let content;
  if (state.status === "loading") {
    content = <p role="status">{screens.loading}</p>;
  } else if (state.status === "failed") {
    content = <LoadFailed message={failures.readAlerts.other} onRetry={retry} />;
  } else if (state.data.total === 0) {
    content = (
      <>
        <p>{status === undefined ? screens.alerts.empty : screens.alerts.emptyFiltered}</p>
        {status === undefined && <Link to="/catalogue">{screens.alerts.toCatalogue}</Link>}
      </>
    );
  } else {
    content = (
      <Pager page={page} data={state.data} label={screens.alerts.pagesLabel} addressOf={(n) => alertsAddress(status, n)}>
        <ul className="listings">
          {state.data.items.map((alert) => (
            <AlertEntry key={alert.id} alert={alert} listing={titles.get(alert.listingId)} />
          ))}
        </ul>
      </Pager>
    );
  }

  return (
    <>
      <h1>{screens.alerts.title}</h1>
      <nav aria-label={screens.alerts.filterLabel} className="filters">
        {[undefined, ...STATUSES].map((option) => (
          <Link key={option ?? "all"} to={alertsAddress(option)} aria-current={option === status ? "true" : undefined}>
            {screens.alerts.filters[option ?? "all"]}
          </Link>
        ))}
      </nav>
      {content}
    </>
  );
}
