import { useSearchParams } from "react-router-dom";
import { useSession } from "../session";
import { failures, screens } from "../texts";
import { ListingCard } from "./ListingCard";
import { LoadFailed } from "./LoadFailed";
import { PAGE_SIZE, Pager, pageFrom } from "./Pager";
import { useRequest } from "./useRequest";

const pageAddress = (page: number) => ({ pathname: "/catalogue", search: `?page=${page}` });

/** The Catalogue, one page at a time, in the order that the API gives (BR-07). */
export function CatalogueScreen() {
  const { api } = useSession();
  const page = pageFrom(useSearchParams()[0].get("page"));
  const { state, retry } = useRequest(() => api.listings({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }), [page]);

  let content;
  if (state.status === "loading") {
    content = <p role="status" className="text-muted">{screens.loading}</p>;
  } else if (state.status === "failed") {
    content = <LoadFailed message={failures.readCatalogue.other} onRetry={retry} />;
  } else if (state.data.total === 0) {
    content = <p className="text-muted">{screens.catalogue.empty}</p>;
  } else {
    content = (
      <Pager page={page} data={state.data} label={screens.catalogue.pagesLabel} addressOf={pageAddress}>
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {state.data.items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </ul>
      </Pager>
    );
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">{screens.catalogue.title}</h1>
      {content}
    </>
  );
}
