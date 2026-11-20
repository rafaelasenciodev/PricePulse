import { useSearchParams } from "react-router-dom";
import { useSession } from "../session";
import { failures, screens } from "../texts";
import { Card } from "./Card";
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
    content = <p role="status" className="text-muted">{screens.loading}</p>;
  } else if (state.status === "failed") {
    content = <LoadFailed message={failures.readNotifications.other} onRetry={retry} />;
  } else if (state.data.total === 0) {
    content = <p className="text-muted">{screens.notifications.empty}</p>;
  } else {
    content = (
      <Pager page={page} data={state.data} label={screens.notifications.pagesLabel} addressOf={pageAddress}>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {state.data.items.map((notification) => {
            const listing = titles.get(notification.listingId);
            return (
              <Card as="li" key={notification.alertId} className="flex flex-col gap-1">
                <h2 className="m-0 text-base font-semibold">{listing?.title ?? notification.listingId}</h2>
                {listing !== undefined && <p className="m-0 text-sm text-muted">{screens.listing.retailer(listing.retailer)}</p>}
                <p className="m-0 mt-2 text-sm">{screens.notifications.targetPrice(formatPrice(notification.targetPrice))}</p>
                <p className="m-0">
                  <strong className="text-lg font-semibold text-accent">{screens.notifications.currentPrice(formatPrice(notification.currentPrice))}</strong>{" "}
                  <span className="text-xs text-muted">{screens.notifications.observedAt(formatInstant(notification.observedAt))}</span>
                </p>
              </Card>
            );
          })}
        </ul>
      </Pager>
    );
  }

  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold">{screens.notifications.title}</h1>
      <p className="mb-4 mt-0 text-sm text-muted">{screens.notifications.note}</p>
      {content}
    </>
  );
}
