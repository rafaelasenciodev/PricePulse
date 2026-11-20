import { useEffect, useState } from "react";
import type { Listing } from "../api";
import { useSession } from "../session";

/** The Listings that were found, by identifier. One that is not in the map has no title to show. */
export type Titles = ReadonlyMap<string, Listing>;

const NONE: Titles = new Map();

/**
 * Finds the Listings of a page of alerts or Notifications, to show their titles instead of their identifiers (Q2 of
 * feature 09, Q8 of feature 10).
 *
 * It reads the Catalogue once, for up to 100 Listings, and then asks for each Listing that was not in it, one request
 * for each distinct identifier. A failure of any of those reads is not shown and not tried again: that Listing has no
 * title, and the screen shows its identifier. The titles arrive after the entries, so nothing waits for them, and
 * nothing is kept for another page or another screen.
 */
export function useTitles(listingIds: readonly string[]): Titles {
  const { api } = useSession();
  const wanted = [...new Set(listingIds)].sort();
  const key = JSON.stringify(wanted);
  const [found, setFound] = useState<{ readonly key: string; readonly titles: Titles }>({ key: "", titles: NONE });

  useEffect(() => {
    if (wanted.length === 0) return;
    let current = true;
    void (async () => {
      const titles = new Map<string, Listing>();
      const catalogue = await api.listings({ limit: 100, offset: 0 });
      if (catalogue.ok) for (const listing of catalogue.data.items) titles.set(listing.id, listing);
      const missing = wanted.filter((id) => !titles.has(id));
      const reads = await Promise.all(missing.map((id) => api.listing(id)));
      reads.forEach((read, i) => {
        if (read.ok) titles.set(missing[i] as string, read.data);
      });
      if (current) setFound({ key, titles });
    })();
    return () => {
      current = false;
    };
    // `key` says which Listings are wanted: the list itself is a new array on every render.
  }, [key, api]);

  return found.key === key ? found.titles : NONE;
}
