/** PostgreSQL implementations of the ports of price observations (feature 11, ADR-0006). The schema is in `database/migrations`. */

import type { Pool } from "pg";
import { isUniqueViolation } from "../../shared/database-errors";
import { ListingId, ObservedAt, Price } from "../../shared/domain";
import {
  ObservationAlreadyExists,
  type CatalogueListing,
  type CataloguePage,
  type CataloguePageQuery,
  type ListingCatalogue,
  type PriceHistoryPage,
  type PriceHistoryQuery,
  type PriceObservationRepository,
} from "../application";
import { PriceObservation, ProviderId } from "../domain";
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

interface ObservationRow {
  provider: string;
  listing_id: string;
  observed_at: number;
  price_minor_units: number | null;
  currency: string | null;
}

const OBSERVATION_COLUMNS = "provider, listing_id, observed_at, price_minor_units, currency";

function toObservation(row: ObservationRow): PriceObservation {
  const price = row.price_minor_units === null || row.currency === null ? null : Price.fromMinorUnits(row.price_minor_units, row.currency);
  return PriceObservation.restore(ProviderId(row.provider), ListingId(row.listing_id), ObservedAt.fromEpochMilliseconds(row.observed_at), price);
}

/** Implements PriceObservationRepository. The identity of an observation is the primary key, which is what `add` relies on. */
export class PostgresPriceObservationRepository implements PriceObservationRepository {
  constructor(private readonly pool: Pool) {}

  async find(provider: ProviderId, listingId: ListingId, observedAt: ObservedAt): Promise<PriceObservation | null> {
    const { rows } = await this.pool.query<ObservationRow>(
      `SELECT ${OBSERVATION_COLUMNS} FROM price_observations WHERE provider = $1 AND listing_id = $2 AND observed_at = $3`,
      [provider, listingId, observedAt.epochMilliseconds],
    );
    return rows[0] ? toObservation(rows[0]) : null;
  }

  async add(observation: PriceObservation): Promise<void> {
    try {
      await this.pool.query(`INSERT INTO price_observations (${OBSERVATION_COLUMNS}) VALUES ($1, $2, $3, $4, $5)`, [
        observation.provider,
        observation.listingId,
        observation.observedAt.epochMilliseconds,
        observation.price?.minorUnits ?? null,
        observation.price?.currency ?? null,
      ]);
    } catch (error) {
      if (isUniqueViolation(error, "price_observations_pkey")) throw new ObservationAlreadyExists();
      throw error;
    }
  }

  async findLatest(listingId: ListingId): Promise<PriceObservation | null> {
    // The contract leaves open which one is returned when several share the greatest Observed At (BR-13).
    // The provider breaks the tie so that the answer is at least the same each time.
    const { rows } = await this.pool.query<ObservationRow>(
      `SELECT ${OBSERVATION_COLUMNS} FROM price_observations WHERE listing_id = $1 ORDER BY observed_at DESC, provider LIMIT 1`,
      [listingId],
    );
    return rows[0] ? toObservation(rows[0]) : null;
  }

  async findByListing(listingId: ListingId, query: PriceHistoryQuery): Promise<PriceHistoryPage> {
    const from = query.range.from?.epochMilliseconds ?? null;
    const to = query.range.to?.epochMilliseconds ?? null;
    // The start is included and the end is excluded. One statement, so the page and the total are of one snapshot.
    const { rows } = await this.pool.query<{ total: number } & Partial<ObservationRow>>(
      `SELECT c.total, p.provider, p.listing_id, p.observed_at, p.price_minor_units, p.currency
         FROM (SELECT count(*) AS total FROM price_observations
                WHERE listing_id = $1 AND ($2::bigint IS NULL OR observed_at >= $2) AND ($3::bigint IS NULL OR observed_at < $3)) c
         LEFT JOIN LATERAL (
           SELECT ${OBSERVATION_COLUMNS} FROM price_observations
            WHERE listing_id = $1 AND ($2::bigint IS NULL OR observed_at >= $2) AND ($3::bigint IS NULL OR observed_at < $3)
            ORDER BY observed_at DESC, provider LIMIT $4 OFFSET $5
         ) p ON true
        ORDER BY p.observed_at DESC, p.provider`,
      [listingId, from, to, query.limit, query.offset],
    );
    return {
      items: rows.flatMap((row) => (row.provider === null || row.provider === undefined ? [] : [toObservation(row as ObservationRow)])),
      total: rows[0]?.total ?? 0,
    };
  }
}
