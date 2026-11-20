import { useSearchParams } from "react-router-dom";
import { useSession } from "../session";
import { failures, screens } from "../texts";
import { formatInstant, formatPrice } from "./format";
import { LoadFailed } from "./LoadFailed";
import { PAGE_SIZE, Pager, pageFrom } from "./Pager";
import { useRequest } from "./useRequest";
import { useTitles } from "./useTitles";

const pageAddress = (page: number) => ({ pathname: "/notifications", search: `?page=${page}` });

/**
 * The Notifications of the person, newest first, one page at a time (BR-09). They are a record: the screen says that
 * nothing is sent anywhere, and has no read state and no counter (BR-10).
 */
export function NotificationsScreen() {
  const { api } = useSession();
  const page = pageFrom(useSearchParams()[0].get("page"));
  const { state, retry } = useRequest(() => api.notifications({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }), [page]);
  const titles = useTitles(state.status === "ready" ? state.data.items.map((notification) => notification.listingId) : []);

  let content;
  if (state.status === "loading") {
    content = <p role="status">{screens.loading}</p>;
  } else if (state.status === "failed") {
    content = <LoadFailed message={failures.readNotifications.other} onRetry={retry} />;
  } else if (state.data.total === 0) {
    content = <p>{screens.notifications.empty}</p>;
  } else {
    content = (
      <Pager page={page} data={state.data} label={screens.notifications.pagesLabel} addressOf={pageAddress}>
        <ul className="listings">
          {state.data.items.map((notification) => {
            const listing = titles.get(notification.listingId);
            return (
              <li key={notification.alertId}>
                <h2>{listing?.title ?? notification.listingId}</h2>
                {listing !== undefined && <p className="retailer">{screens.listing.retailer(listing.retailer)}</p>}
                <p>{screens.notifications.targetPrice(formatPrice(notification.targetPrice))}</p>
                <p>
                  <strong>{screens.notifications.currentPrice(formatPrice(notification.currentPrice))}</strong>{" "}
                  <span className="muted">{screens.notifications.observedAt(formatInstant(notification.observedAt))}</span>
                </p>
              </li>
            );
          })}
        </ul>
      </Pager>
    );
  }

  return (
    <>
      <h1>{screens.notifications.title}</h1>
      <p className="muted">{screens.notifications.note}</p>
      {content}
    </>
  );
}
