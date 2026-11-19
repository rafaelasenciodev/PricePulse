/** UC-02 Read the Price History (see the design of feature 05). */

import { InvalidValue, ObservedAt, type ListingId } from "../../shared/domain";
import { ObservedAtRange } from "../domain";
import { InvalidRange, ListingNotFound } from "./errors";
import { toObservationView, type PriceObservationView } from "./price-observation-view";
import type { ListingCatalogue, PriceObservationRepository } from "./ports";

export interface ReadPriceHistoryCommand {
  readonly listingId: ListingId;
  /** The start of the range, included: ISO 8601 with an explicit time zone. Without it, from the first observation. */
  readonly from?: string;
  /** The end of the range, excluded: ISO 8601 with an explicit time zone. Without it, to the last observation. */
  readonly to?: string;
  /** How many observations at most. The way in checks that it is valid. */
  readonly limit: number;
  /** How many observations to skip. The way in checks that it is valid. */
  readonly offset: number;
}

export interface ReadPriceHistoryResult {
  /** The page, newest Observed At first (BR-05). */
  readonly items: readonly PriceObservationView[];
  /** How many observations the range includes, in all pages. */
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export class ReadPriceHistory {
  constructor(
    private readonly catalogue: ListingCatalogue,
    private readonly observations: PriceObservationRepository,
  ) {}

  async execute(command: ReadPriceHistoryCommand): Promise<ReadPriceHistoryResult> {
    // 1. The Listing exists (BR-07). It comes before the range, as when a price is recorded.
    const listing = await this.catalogue.find(command.listingId);
    if (listing === null) throw new ListingNotFound(command.listingId);

    // 2. The range is valid (BR-06)
    const range = readRange(command.from, command.to);

    // 3. The page of the history, newest first (BR-05)
    const { limit, offset } = command;
    const page = await this.observations.findByListing(command.listingId, { range, limit, offset });
    return { items: page.items.map(toObservationView), total: page.total, limit, offset };
  }
}

function readRange(from: string | undefined, to: string | undefined): ObservedAtRange {
  const start = from === undefined ? null : readInstant(from, "start");
  const end = to === undefined ? null : readInstant(to, "end");
  try {
    return ObservedAtRange.of(start, end);
  } catch (error) {
    if (error instanceof InvalidValue) throw new InvalidRange(error.message, { cause: error });
    throw error;
  }
}

function readInstant(text: string, which: "start" | "end"): ObservedAt {
  try {
    return ObservedAt.fromIsoString(text);
  } catch (error) {
    if (error instanceof InvalidValue) {
      throw new InvalidRange(`The ${which} of the range is not an instant: ${JSON.stringify(text)}`, { cause: error });
    }
    throw error;
  }
}
