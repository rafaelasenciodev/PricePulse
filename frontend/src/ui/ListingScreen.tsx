import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSession } from "../session";
import { messageFor, screens } from "../texts";
import { ListingFacts } from "./ListingFacts";
import { LoadFailed } from "./LoadFailed";
import { PriceAlertForm } from "./PriceAlertForm";
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
    content = <p role="status">{screens.loading}</p>;
  } else if (state.status === "failed") {
    const { failure } = state;
    content =
      failure.kind === "answer" && failure.code === "LISTING_NOT_FOUND" ? (
        <div>
          <p role="alert" className="error">
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
      <>
        <h1>{listing.title}</h1>
        <ListingFacts listing={listing} />
        <PriceAlertForm listing={listing} onDone={done} />
      </>
    );
  }

  return (
    <>
      <p>
        <Link to="/catalogue">{screens.listing.backToCatalogue}</Link>
      </p>
      {notice !== null && <p role="status">{notice}</p>}
      {content}
    </>
  );
}
