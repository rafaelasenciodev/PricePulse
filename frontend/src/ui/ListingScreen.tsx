import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSession } from "../session";
import { messageFor, screens } from "../texts";
import { ListingFacts } from "./ListingFacts";
import { LoadFailed } from "./LoadFailed";
import { PriceAlertForm } from "./PriceAlertForm";
import { PriceHistory } from "./PriceHistory";
import { useRequest } from "./useRequest";

/** One Listing, with a form to create a Price Alert for it (BR-08). */
export function ListingScreen() {
  const { id = "" } = useParams();
  const { api } = useSession();
  const { state, retry } = useRequest(() => api.listing(id), [id]);
  // The result of creating a Price Alert is kept here, not in the form: the Listing is read again after it (BR-11) and the form is made anew.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => setNotice(null), [id]);

  function done(message: string) {
    setNotice(message);
    retry();
  }

  let content;
  if (state.status === "loading") {
    content = <p role="status" className="text-muted">{screens.loading}</p>;
  } else if (state.status === "failed") {
    const { failure } = state;
    content =
      failure.kind === "answer" && failure.code === "LISTING_NOT_FOUND" ? (
        <div>
          <p role="alert" className="text-danger">
            {messageFor("readListing", failure)}
          </p>
          <Link to="/catalogue">{screens.listing.toCatalogue}</Link>
        </div>
      ) : (
        <LoadFailed message={messageFor("readListing", failure)} onRetry={retry} />
      );
  } else {
    const listing = state.data;
    content = (
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <h1 className="m-0 text-2xl font-semibold">{listing.title}</h1>
          <ListingFacts listing={listing} />
          <PriceHistory listingId={listing.id} />
        </div>
        <aside>
          <PriceAlertForm listing={listing} onDone={done} />
        </aside>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 mt-0 text-sm">
        <Link to="/catalogue">{screens.listing.backToCatalogue}</Link>
      </p>
      {notice !== null && (
        <p role="status" className="mb-4 rounded-lg border border-line bg-surface p-3 text-sm">
          {notice}
        </p>
      )}
      {content}
    </>
  );
}
