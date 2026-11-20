/** PostgreSQL implementations of the ports of price observations (feature 11, ADR-0006). The schema is in `database/migrations`. */

import type { Pool } from "pg";
import { ListingId } from "../../shared/domain";
import type { CatalogueListing, CataloguePage, CataloguePageQuery, ListingCatalogue } from "../application";
import type { ListingText } from "./in-memory";

interface ListingRow {
  id: string;
  title: string;
  retailer: string;
  currency: string;
}

const toListing = (row: ListingRow): CatalogueListing => ({
  id: ListingId(row.id),
  title: row.title,
  retailer: row.retailer,
  currency: row.currency,
});

/**
 * Implements ListingCatalogue. The order is by `title_key`, the title in lower case as JavaScript makes it, and then
 * by identifier, both compared with the collation "C" of their columns: the order of the domain and not the database's
 * own, so it does not depend on the machine (BR-06). The one difference is described in decision 3 of the design.
 */
export class PostgresListingCatalogue implements ListingCatalogue {
  constructor(private readonly pool: Pool) {}

  /** Adds a Listing, or replaces the one with that identifier. The same rules as the in-memory Catalogue. */
  async addListing(listingId: ListingId, currency: string, text?: ListingText): Promise<void> {
    const { title, retailer } = text ?? { title: listingId as string, retailer: "Unknown retailer" };
    if (title.trim() === "" || retailer.trim() === "") {
      throw new RangeError(`The title and the Retailer of the Listing ${JSON.stringify(listingId)} must not be empty`);
    }
    await this.pool.query(
      `INSERT INTO listings (id, title, title_key, retailer, currency) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET title = $2, title_key = $3, retailer = $4, currency = $5`,
      [listingId, title, title.toLowerCase(), retailer, currency],
    );
  }

  async find(listingId: ListingId): Promise<CatalogueListing | null> {
    const { rows } = await this.pool.query<ListingRow>("SELECT id, title, retailer, currency FROM listings WHERE id = $1", [listingId]);
    return rows[0] ? toListing(rows[0]) : null;
  }

  async list(query: CataloguePageQuery): Promise<CataloguePage> {
    // One statement, so the page and the total come from one snapshot. The total is a row of its own that the page is
    // joined to, so it is there even when the page is empty.
    const { rows } = await this.pool.query<{ total: number; id: string | null; title: string; retailer: string; currency: string }>(
      `SELECT c.total, p.id, p.title, p.retailer, p.currency
         FROM (SELECT count(*) AS total FROM listings) c
         LEFT JOIN LATERAL (
           SELECT id, title, title_key, retailer, currency FROM listings ORDER BY title_key, id LIMIT $1 OFFSET $2
         ) p ON true
        ORDER BY p.title_key, p.id`,
      [query.limit, query.offset],
    );
    return {
      items: rows.flatMap((row) => (row.id === null ? [] : [toListing({ ...row, id: row.id })])),
      total: rows[0]?.total ?? 0,
    };
  }
}
