import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useSession } from "../session";
import { failures, screens } from "../texts";
import { ListingFacts } from "./ListingFacts";
import { LoadFailed } from "./LoadFailed";
import { useRequest } from "./useRequest";

const PAGE_SIZE = 20;

/** The page asked for in `?page=`. What is not a whole number from 1 is the first page. */
function pageFrom(value: string | null): number {
  if (value === null || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

const pageAddress = (page: number) => ({ pathname: "/catalogue", search: `?page=${page}` });

/** The Catalogue, one page at a time, in the order that the API gives (BR-07). */
export function CatalogueScreen() {
  const { api } = useSession();
  const page = pageFrom(useSearchParams()[0].get("page"));
  const { state, retry } = useRequest(() => api.listings({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }), [page]);

  let content;
  if (state.status === "loading") {
    content = <p role="status">{screens.loading}</p>;
  } else if (state.status === "failed") {
    content = <LoadFailed message={failures.readCatalogue.other} onRetry={retry} />;
  } else {
    const { items, total, offset } = state.data;
    if (total === 0) {
      content = <p>{screens.catalogue.empty}</p>;
    } else if (items.length === 0) {
      // A page that is past the end, such as an old address: the last page is the nearest one that exists.
      return <Navigate to={pageAddress(Math.ceil(total / PAGE_SIZE))} replace />;
    } else {
      const hasPrevious = page > 1;
      const hasNext = offset + items.length < total;
      content = (
        <>
          <p>{screens.catalogue.range(offset + 1, offset + items.length, total)}</p>
          <ul className="listings">
            {items.map((listing) => (
              <li key={listing.id}>
                <h2>
                  <Link to={`/listings/${encodeURIComponent(listing.id)}`}>{listing.title}</Link>
                </h2>
                <ListingFacts listing={listing} />
              </li>
            ))}
          </ul>
          <nav aria-label={screens.catalogue.pagesLabel} className="pages">
            {hasPrevious && <Link to={pageAddress(page - 1)}>{screens.catalogue.previous}</Link>}
            {hasNext && <Link to={pageAddress(page + 1)}>{screens.catalogue.next}</Link>}
          </nav>
        </>
      );
    }
  }

  return (
    <>
      <h1>{screens.catalogue.title}</h1>
      {content}
    </>
  );
}
