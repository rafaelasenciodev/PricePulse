/**
 * Application tests of UC-01 Record Price Observation.
 *
 * Each test names the scenario (SC-nn) or the business rule (BR-nn) it verifies.
 * The ports are replaced by small test doubles: the in-memory adapters belong to Phase 6.
 *
 * Not tested here, and where they are:
 * - SC-06, SC-07, SC-08: the Current Price is read through `findLatest`, which this use case
 *   does not call. It belongs to the contract tests of the repository adapters.
 * - SC-16, SC-17: rejected at the HTTP boundary, before the use case (contract, decision 1).
 * - SC-21: the use case has no port to Price Alerts, so there is nothing to call.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  ApplicationError,
  CLOCK_TOLERANCE_MILLISECONDS,
  InvalidObservation,
  ListingNotFound,
  ObservationAlreadyExists,
  ObservationConflict,
  RecordPriceObservation,
  type Clock,
  type ListingCatalogue,
  type PriceObservationRepository,
  type RecordPriceObservationCommand,
} from "../../../src/price-observations/application";
import { PriceObservation, ProviderId } from "../../../src/price-observations/domain";
import { ListingId, ObservedAt, Price, UnsupportedCurrency } from "../../../src/shared/domain";

const SIMULATOR = ProviderId("simulator");
const HEADPHONES = ListingId("headphones-shop-a");
const KEYBOARD = ListingId("keyboard-shop-b");
const NOW = new Date("2026-11-19T12:00:00Z");

// ---------------------------------------------------------------------------
// Test doubles for the ports
// ---------------------------------------------------------------------------

class FakeCatalogue implements ListingCatalogue {
  private readonly listings = new Map<ListingId, string>();
  add(listingId: ListingId, currency: string): void {
    this.listings.set(listingId, currency);
  }
  async find(listingId: ListingId) {
    const currency = this.listings.get(listingId);
    return currency === undefined ? null : { id: listingId, title: "A Listing", retailer: "A Retailer", currency };
  }
  /** Recording a price never lists the Catalogue: it fails if it ever does. */
  async list(): Promise<never> {
    throw new Error("Recording a price must not list the Catalogue");
  }
}

/** Keeps observations in a list and enforces the uniqueness guarantee, as persistence must. */
class FakeRepository implements PriceObservationRepository {
  protected readonly stored: PriceObservation[] = [];

  async find(provider: ProviderId, listingId: ListingId, observedAt: ObservedAt) {
    return this.search(provider, listingId, observedAt);
  }

  async add(observation: PriceObservation): Promise<void> {
    // The check and the insertion must not be separated by an `await`: another request could slip in.
    if (this.search(observation.provider, observation.listingId, observation.observedAt) !== null) {
      throw new ObservationAlreadyExists();
    }
    this.stored.push(observation);
  }

  async findLatest(): Promise<PriceObservation | null> {
    throw new Error("The use case must not call findLatest");
  }

  async findByListing(): Promise<never> {
    throw new Error("The use case must not call findByListing");
  }

  all(): PriceObservation[] {
    return [...this.stored];
  }

  private search(provider: ProviderId, listingId: ListingId, observedAt: ObservedAt) {
    return (
      this.stored.find(
        (o) => o.provider === provider && o.listingId === listingId && o.observedAt.equals(observedAt),
      ) ?? null
    );
  }
}

class FixedClock implements Clock {
  constructor(private readonly moment: Date) {}
  now(): Date {
    return this.moment;
  }
}

// ---------------------------------------------------------------------------

class World {
  readonly catalogue = new FakeCatalogue();

  constructor(readonly observations: FakeRepository = new FakeRepository()) {
    this.catalogue.add(HEADPHONES, "EUR");
    this.catalogue.add(KEYBOARD, "USD");
  }

  record(changes: Partial<RecordPriceObservationCommand> = {}) {
    return new RecordPriceObservation(this.catalogue, this.observations, new FixedClock(NOW)).execute({
      provider: SIMULATOR,
      listingId: HEADPHONES,
      observedAt: "2026-11-19T10:00:00Z",
      price: { amount: "79.90", currency: "EUR" },
      ...changes,
    });
  }

  /** Stores an observation directly, as if it had been recorded earlier. */
  async store(observedAt: string, price: string | null, listingId: ListingId = HEADPHONES) {
    await this.observations.add(
      PriceObservation.record({
        provider: SIMULATOR,
        listingId,
        observedAt: ObservedAt.fromIsoString(observedAt),
        price: price === null ? null : Price.fromDecimalString(price, "EUR"),
        listingCurrency: "EUR",
        recordedAt: NOW,
        toleranceMilliseconds: CLOCK_TOLERANCE_MILLISECONDS,
      }),
    );
  }
}

let world: World;
beforeEach(() => {
  world = new World();
});

const iso = (millisecondsFromNow: number) => new Date(NOW.getTime() + millisecondsFromNow).toISOString();

describe("happy paths", () => {
  it("SC-01: records a Price Observation with a Price, for the authenticated Provider", async () => {
    const result = await world.record();
    expect(result.recorded).toBe(true);
    expect(result.observation).toEqual({
      provider: "simulator",
      listingId: HEADPHONES,
      observedAt: "2026-11-19T10:00:00.000Z",
      price: { amount: "79.90", currency: "EUR" },
    });
    expect(world.observations.all()).toHaveLength(1);
  });

  it("SC-02: records a Price Observation without a Price", async () => {
    const result = await world.record({ price: null });
    expect(result.recorded).toBe(true);
    expect(result.observation.price).toBeNull();
    expect(world.observations.all()[0]?.price).toBeNull();
  });

  it("SC-03: records a Price of zero", async () => {
    const result = await world.record({ price: { amount: "0.00", currency: "EUR" } });
    expect(result.observation.price).toEqual({ amount: "0.00", currency: "EUR" });
  });

  it("SC-04 / BR-06: a later observation is stored next to the earlier one", async () => {
    await world.store("2026-11-19T10:00:00Z", "100.00");
    const result = await world.record({ observedAt: "2026-11-19T11:00:00Z", price: { amount: "90.00", currency: "EUR" } });
    expect(result.recorded).toBe(true);
    expect(world.observations.all()).toHaveLength(2);
  });

  it("SC-05 / BR-06: an observation equal to the previous one is also stored", async () => {
    await world.store("2026-11-19T10:00:00Z", "100.00");
    const result = await world.record({ observedAt: "2026-11-19T11:00:00Z", price: { amount: "100.00", currency: "EUR" } });
    expect(result.recorded).toBe(true);
    expect(world.observations.all()).toHaveLength(2);
  });

  it("SC-09 / BR-08: an older observation is stored", async () => {
    await world.store("2026-11-19T11:00:00Z", "90.00");
    const result = await world.record({ observedAt: "2026-11-19T10:00:00Z", price: { amount: "100.00", currency: "EUR" } });
    expect(result.recorded).toBe(true);
    expect(world.observations.all()).toHaveLength(2);
  });

  it("an Observed At written in another time zone is stored as the same instant", async () => {
    const result = await world.record({ observedAt: "2026-11-19T11:00:00+01:00" });
    expect(result.observation.observedAt).toBe("2026-11-19T10:00:00.000Z");
  });

  it("the Listing is recorded in its own currency", async () => {
    const result = await world.record({ listingId: KEYBOARD, price: { amount: "50.00", currency: "USD" } });
    expect(result.observation.price).toEqual({ amount: "50.00", currency: "USD" });
  });
});

describe("the Observed At against the clock", () => {
  it("SC-10 / BR-12: accepts an Observed At later than now, within the tolerance", async () => {
    const result = await world.record({ observedAt: iso(CLOCK_TOLERANCE_MILLISECONDS) });
    expect(result.recorded).toBe(true);
  });

  it("SC-11 / BR-12: rejects an Observed At beyond the tolerance, and stores nothing", async () => {
    await world.store("2026-11-19T10:00:00Z", "100.00");
    const outcome = world.record({ observedAt: iso(CLOCK_TOLERANCE_MILLISECONDS + 1) });
    await expect(outcome).rejects.toThrow(InvalidObservation);
    await expect(outcome).rejects.toThrow("later than the moment of recording");
    expect(world.observations.all()).toHaveLength(1);
  });

  it("the tolerance is 5 minutes (contract, decision 5)", () => {
    expect(CLOCK_TOLERANCE_MILLISECONDS).toBe(300_000);
  });
});

describe("validity of the observation", () => {
  it("SC-12 / BR-04: rejects a negative Price", async () => {
    const outcome = world.record({ price: { amount: "-5.00", currency: "EUR" } });
    await expect(outcome).rejects.toThrow(InvalidObservation);
    await expect(outcome).rejects.toThrow("negative");
    expect(world.observations.all()).toEqual([]);
  });

  it("SC-13 / BR-05: rejects a Price with more decimals than the currency allows", async () => {
    const outcome = world.record({ price: { amount: "79.999", currency: "EUR" } });
    await expect(outcome).rejects.toThrow(InvalidObservation);
    await expect(outcome).rejects.toThrow("decimal");
    expect(world.observations.all()).toEqual([]);
  });

  it("BR-04: rejects an amount that is not a number", async () => {
    await expect(world.record({ price: { amount: "abc", currency: "EUR" } })).rejects.toThrow(InvalidObservation);
  });

  it("SC-14 / BR-05: rejects a Price in another currency than the Listing", async () => {
    const outcome = world.record({ price: { amount: "79.90", currency: "USD" } });
    await expect(outcome).rejects.toThrow(InvalidObservation);
    await expect(outcome).rejects.toThrow("not the one of the Listing");
    expect(world.observations.all()).toEqual([]);
  });

  it("decision 8: the currency is compared before the amount is read, so it is the one reported", async () => {
    const outcome = world.record({ price: { amount: "abc", currency: "USD" } });
    await expect(outcome).rejects.toThrow(InvalidObservation);
    await expect(outcome).rejects.toThrow("not the one of the Listing");
  });

  it("decision 8: a currency the system does not support is reported as not the Listing's, not as an internal error", async () => {
    const outcome = world.record({ price: { amount: "79.90", currency: "GBP" } });
    await expect(outcome).rejects.toThrow(InvalidObservation);
    await expect(outcome).rejects.not.toBeInstanceOf(UnsupportedCurrency);
  });

  it.each(["", "yesterday", "2026-11-19T10:00:00", "2026-02-30T10:00:00Z"])(
    "rejects the Observed At %j, which is not a valid instant",
    async (observedAt) => {
      const outcome = world.record({ observedAt });
      await expect(outcome).rejects.toThrow(InvalidObservation);
      await expect(outcome).rejects.toThrow("Observed At");
    },
  );

  it("keeps the original domain error as the cause", async () => {
    const error = await world.record({ price: { amount: "-5.00", currency: "EUR" } }).catch((e: unknown) => e);
    expect((error as Error).cause).toBeInstanceOf(Error);
  });
});

describe("who and on what", () => {
  it("SC-15 / BR-02: rejects a Listing that does not exist", async () => {
    const outcome = world.record({ listingId: ListingId("no-such-listing") });
    await expect(outcome).rejects.toThrow(ListingNotFound);
    expect(world.observations.all()).toEqual([]);
  });

  it("decision 3: a missing Listing is reported before an invalid observation", async () => {
    const outcome = world.record({ listingId: ListingId("no-such-listing"), observedAt: "yesterday" });
    await expect(outcome).rejects.toThrow(ListingNotFound);
  });

  it("BR-01: the observation belongs to the Provider of the command", async () => {
    const result = await world.record({ provider: ProviderId("another-provider") });
    expect(result.observation.provider).toBe("another-provider");
  });
});

describe("resends", () => {
  it.each([
    ["with a Price", { amount: "79.90", currency: "EUR" }],
    ["without a Price", null],
  ])("SC-18 / BR-09: repeating the same recording %s returns the existing one", async (_case, price) => {
    const first = await world.record({ price });
    const second = await world.record({ price });
    expect(first.recorded).toBe(true);
    expect(second.recorded).toBe(false);
    expect(second.observation).toEqual(first.observation);
    expect(world.observations.all()).toHaveLength(1);
  });

  it("SC-19 / BR-10: the same Observed At with a different Price is a Conflict, and nothing changes", async () => {
    await world.record();
    const outcome = world.record({ price: { amount: "85.00", currency: "EUR" } });
    await expect(outcome).rejects.toThrow(ObservationConflict);
    expect(world.observations.all()).toHaveLength(1);
    expect(world.observations.all()[0]?.price?.toDecimalString()).toBe("79.90");
  });

  it("SC-20 / BR-10: the same Observed At without a Price, against a stored Price, is a Conflict", async () => {
    await world.record();
    await expect(world.record({ price: null })).rejects.toThrow(ObservationConflict);
    expect(world.observations.all()[0]?.price?.toDecimalString()).toBe("79.90");
  });

  it("BR-10: the same Observed At with a Price, against a stored absence of Price, is a Conflict", async () => {
    await world.record({ price: null });
    await expect(world.record()).rejects.toThrow(ObservationConflict);
    expect(world.observations.all()[0]?.price).toBeNull();
  });

  it("BR-08 / BR-09: repeating an older recording after a later one returns the existing one", async () => {
    const older = await world.record({ observedAt: "2026-11-19T10:00:00Z", price: { amount: "100.00", currency: "EUR" } });
    await world.record({ observedAt: "2026-11-19T11:00:00Z", price: { amount: "90.00", currency: "EUR" } });
    const repeated = await world.record({ observedAt: "2026-11-19T10:00:00Z", price: { amount: "100.00", currency: "EUR" } });
    expect(repeated.recorded).toBe(false);
    expect(repeated.observation).toEqual(older.observation);
    expect(world.observations.all()).toHaveLength(2);
  });

  it("BR-09: the identity includes the Provider, so another Provider records its own observation", async () => {
    await world.record();
    const other = await world.record({ provider: ProviderId("another-provider") });
    expect(other.recorded).toBe(true);
    expect(world.observations.all()).toHaveLength(2);
  });

  it("BR-09: the identity includes the Listing", async () => {
    await world.record();
    const other = await world.record({ listingId: KEYBOARD, price: { amount: "79.90", currency: "USD" } });
    expect(other.recorded).toBe(true);
  });

  it("a resend is validated again: the same invalid content is still rejected", async () => {
    await world.record();
    await expect(world.record({ price: { amount: "-1.00", currency: "EUR" } })).rejects.toThrow(InvalidObservation);
  });
});

describe("concurrency (contract, decision 4)", () => {
  /** Simulates a concurrent request: the first search finds nothing even though
   * another request has just stored an observation with the same identity. */
  class StaleFirstRead extends FakeRepository {
    private searches = 0;

    constructor(private readonly concurrentPrice: string | null) {
      super();
    }

    override async find(provider: ProviderId, listingId: ListingId, observedAt: ObservedAt) {
      this.searches += 1;
      if (this.searches === 1) {
        await this.add(
          PriceObservation.record({
            provider,
            listingId,
            observedAt,
            price: this.concurrentPrice === null ? null : Price.fromDecimalString(this.concurrentPrice, "EUR"),
            listingCurrency: "EUR",
            recordedAt: NOW,
            toleranceMilliseconds: CLOCK_TOLERANCE_MILLISECONDS,
          }),
        );
        return null;
      }
      return super.find(provider, listingId, observedAt);
    }
  }

  it("a concurrent request with the same content: the existing observation is returned", async () => {
    const racing = new World(new StaleFirstRead("79.90"));
    const result = await racing.record();
    expect(result.recorded).toBe(false);
    expect(racing.observations.all()).toHaveLength(1);
  });

  it("a concurrent request with different content is a Conflict", async () => {
    const racing = new World(new StaleFirstRead("85.00"));
    await expect(racing.record()).rejects.toThrow(ObservationConflict);
    expect(racing.observations.all()).toHaveLength(1);
  });

  it("a concurrent request without a Price, against a Price, is a Conflict", async () => {
    const racing = new World(new StaleFirstRead(null));
    await expect(racing.record()).rejects.toThrow(ObservationConflict);
  });

  it("two identical requests started together store exactly one observation", async () => {
    const results = await Promise.all([world.record(), world.record()]);
    expect(results.map((r) => r.recorded).sort()).toEqual([false, true]);
    expect(world.observations.all()).toHaveLength(1);
  });

  it("two requests with different Prices started together: one wins, the other is a Conflict", async () => {
    const outcomes = await Promise.allSettled([
      world.record({ price: { amount: "79.90", currency: "EUR" } }),
      world.record({ price: { amount: "85.00", currency: "EUR" } }),
    ]);
    expect(outcomes.map((o) => o.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(world.observations.all()).toHaveLength(1);
  });
});

describe("failures that are not business errors (contract: internal errors)", () => {
  // They must reach the caller unchanged, so that the HTTP layer reports a 500 and
  // nobody mistakes a broken catalogue or a broken store for a mistake of the Provider.

  it("an unsupported currency of the catalogue is an internal error, not an invalid observation", async () => {
    world.catalogue.add(ListingId("odd-listing"), "XYZ");
    const outcome = world.record({ listingId: ListingId("odd-listing"), price: { amount: "10", currency: "XYZ" } });
    await expect(outcome).rejects.toThrow(UnsupportedCurrency);
    await expect(outcome).rejects.not.toBeInstanceOf(ApplicationError);
  });

  it("an unavailable observation of such a Listing is still recorded: there is no currency to read", async () => {
    world.catalogue.add(ListingId("odd-listing"), "XYZ");
    const result = await world.record({ listingId: ListingId("odd-listing"), price: null });
    expect(result.recorded).toBe(true);
  });

  it("a failure of the repository is not hidden or turned into a business error", async () => {
    class BrokenStore extends FakeRepository {
      override async add(): Promise<void> {
        throw new Error("the store is unavailable");
      }
    }
    const outcome = new World(new BrokenStore()).record();
    await expect(outcome).rejects.toThrow("the store is unavailable");
    await expect(outcome).rejects.not.toBeInstanceOf(ApplicationError);
  });

  it("a failure of the clock is not turned into a business error", async () => {
    const brokenClock: Clock = { now: () => new Date(Number.NaN) };
    const outcome = new RecordPriceObservation(world.catalogue, world.observations, brokenClock).execute({
      provider: SIMULATOR,
      listingId: HEADPHONES,
      observedAt: "2026-11-19T10:00:00Z",
      price: null,
    });
    await expect(outcome).rejects.toThrow("not a valid date");
    await expect(outcome).rejects.not.toBeInstanceOf(ApplicationError);
  });

  it("gives up with an internal error if the uniqueness guarantee keeps failing", async () => {
    /** Claims there is no observation yet, yet refuses every insertion: it should never happen. */
    class AlwaysConflicting extends FakeRepository {
      attempts = 0;
      override async find() {
        return null;
      }
      override async add(): Promise<void> {
        this.attempts += 1;
        throw new ObservationAlreadyExists();
      }
    }
    const conflicting = new AlwaysConflicting();
    const outcome = new World(conflicting).record();
    await expect(outcome).rejects.toThrow("repeated concurrent conflicts");
    await expect(outcome).rejects.not.toBeInstanceOf(ApplicationError);
    expect(conflicting.attempts).toBe(2); // one retry, as the contract says, and no more
  });
});
