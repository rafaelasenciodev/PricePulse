import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryListingCatalogue, InMemoryPriceObservationRepository } from "../../../src/price-observations/adapters";
import {
  InvalidRange,
  ListingNotFound,
  ReadPriceHistory,
  type ListingCatalogue,
  type PriceObservationRepository,
} from "../../../src/price-observations/application";
import { ListingId } from "../../../src/shared/domain";
import { anObservation, type ObservationSpec } from "../../support/observations";

const HEADPHONES = ListingId("headphones-shop-a");

let catalogue: InMemoryListingCatalogue;
let observations: InMemoryPriceObservationRepository;

const read = (
  query: { listingId?: ListingId; from?: string; to?: string; limit?: number; offset?: number } = {},
  repository: PriceObservationRepository = observations,
  listings: ListingCatalogue = catalogue,
) => {
  const { listingId = HEADPHONES, limit = 20, offset = 0, ...range } = query;
  return new ReadPriceHistory(listings, repository).execute({ listingId, limit, offset, ...range });
};

const add = async (...specs: ObservationSpec[]) => {
  for (const spec of specs) await observations.add(anObservation(spec));
};

const moments = (result: { items: readonly { observedAt: string }[] }) => result.items.map((o) => o.observedAt.slice(11, 16));

beforeEach(() => {
  catalogue = new InMemoryListingCatalogue();
  observations = new InMemoryPriceObservationRepository();
  catalogue.addListing(HEADPHONES, "EUR");
});

describe("reading the Price History of a Listing", () => {
  it("SC-10 / BR-05: lists its observations newest Observed At first, each with its Provider, Observed At and Price", async () => {
    await add(
      { observedAt: "2026-11-19T10:00:00Z", price: "100.00" },
      { observedAt: "2026-11-19T11:00:00Z", price: "90.00" },
      { observedAt: "2026-11-19T12:00:00Z", price: "95.00" },
    );

    const result = await read();

    expect(moments(result)).toEqual(["12:00", "11:00", "10:00"]);
    expect(result.items[0]).toEqual({
      provider: "simulator",
      listingId: HEADPHONES,
      observedAt: "2026-11-19T12:00:00.000Z",
      price: { amount: "95.00", currency: "EUR" },
    });
    expect(result.total).toBe(3);
  });

  it("SC-10 / BR-05: two observations at the same moment, of different Providers, keep a stable order", async () => {
    await add(
      { provider: "provider-b", observedAt: "2026-11-19T10:00:00Z" },
      { provider: "provider-a", observedAt: "2026-11-19T10:00:00Z" },
    );
    expect((await read()).items.map((o) => o.provider)).toEqual(["provider-a", "provider-b"]);
  });

  it("SC-11 / BR-05: a moment when the Listing was unavailable is in the history, without a Price", async () => {
    await add({ observedAt: "2026-11-19T10:00:00Z", price: "100.00" }, { observedAt: "2026-11-19T11:00:00Z", price: null });

    const result = await read();

    expect(result.items[0]).toMatchObject({ observedAt: "2026-11-19T11:00:00.000Z", price: null });
    expect(result.items[1]?.price).toEqual({ amount: "100.00", currency: "EUR" });
  });

  it("SC-12 / BR-05: an observation that arrived late is in its place by Observed At", async () => {
    await add({ observedAt: "2026-11-19T11:00:00Z" }, { observedAt: "2026-11-19T10:00:00Z" });
    expect(moments(await read())).toEqual(["11:00", "10:00"]);
  });

  it("SC-12 / BR-05: the order does not depend on the order in which they were recorded", async () => {
    await add({ observedAt: "2026-11-19T10:00:00Z" }, { observedAt: "2026-11-19T12:00:00Z" }, { observedAt: "2026-11-19T11:00:00Z" });
    expect(moments(await read())).toEqual(["12:00", "11:00", "10:00"]);
  });

  it("SC-13 / BR-05: only the observations of the Listing asked for are in its history, and the total counts only those", async () => {
    catalogue.addListing(ListingId("keyboard-shop-b"), "EUR");
    await add({ listing: HEADPHONES }, { listing: "keyboard-shop-b", observedAt: "2026-11-19T11:00:00Z" }, { listing: "keyboard-shop-b", observedAt: "2026-11-19T12:00:00Z" });

    const result = await read({ listingId: HEADPHONES });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("SC-14 / BR-05: a Listing without observations has an empty history, and it is not an error", async () => {
    expect(await read()).toEqual({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it("SC-15 / BR-07: the history of a Listing that does not exist is not found", async () => {
    await expect(read({ listingId: ListingId("no-such-listing") })).rejects.toThrow(ListingNotFound);
  });

  it("SC-15 / BR-07: it does not matter that observations of that Listing are stored: the Listing has to exist", async () => {
    await add({ listing: "ghost" });
    await expect(read({ listingId: ListingId("ghost") })).rejects.toThrow(ListingNotFound);
  });
});

describe("a range of the history", () => {
  beforeEach(async () => {
    await add({ observedAt: "2026-11-19T10:00:00Z" }, { observedAt: "2026-11-19T11:00:00Z" }, { observedAt: "2026-11-19T12:00:00Z" });
  });

  it("SC-16 / BR-06: includes its start and leaves out its end", async () => {
    const result = await read({ from: "2026-11-19T10:00:00Z", to: "2026-11-19T12:00:00Z" });
    expect(moments(result)).toEqual(["11:00", "10:00"]);
  });

  it.each([
    ["from 11:00", { from: "2026-11-19T11:00:00Z" }, ["12:00", "11:00"]],
    ["to 11:00", { to: "2026-11-19T11:00:00Z" }, ["10:00"]],
  ])("SC-17 / BR-06: a range with only an end of the two: %s", async (_name, range, expected) => {
    expect(moments(await read(range))).toEqual(expected);
  });

  it("reads the ends in any time zone: 11:00 at +01:00 is 10:00 UTC", async () => {
    const result = await read({ from: "2026-11-19T11:00:00+01:00", to: "2026-11-19T13:00:00+01:00" });
    expect(moments(result)).toEqual(["11:00", "10:00"]);
  });

  it("a range that includes nothing gives an empty page, and it is not an error", async () => {
    const result = await read({ from: "2027-01-01T00:00:00Z" });
    expect(result).toMatchObject({ items: [], total: 0 });
  });
});

describe("a range that is not valid", () => {
  it.each([
    ["a start that is not an instant", { from: "yesterday" }, "start"],
    ["an end that is not an instant", { to: "tomorrow" }, "end"],
    ["a start without a time zone", { from: "2026-11-19T10:00:00" }, "start"],
    ["an end on a day that does not exist", { to: "2026-02-30T10:00:00Z" }, "end"],
  ])("SC-18 / BR-06: %s is rejected, and the message says which", async (_name, range, which) => {
    const outcome = await read(range).catch((error: unknown) => error);
    expect(outcome).toBeInstanceOf(InvalidRange);
    expect((outcome as Error).message).toContain(`The ${which} of the range is not an instant`);
  });

  it.each([
    ["a start after the end", "2026-11-19T12:00:00Z", "2026-11-19T10:00:00Z"],
    ["a start equal to the end", "2026-11-19T10:00:00Z", "2026-11-19T10:00:00Z"],
  ])("SC-18 / BR-06: %s is rejected", async (_name, from, to) => {
    const outcome = await read({ from, to }).catch((error: unknown) => error);
    expect(outcome).toBeInstanceOf(InvalidRange);
    expect((outcome as Error).message).toContain("is not before its end");
  });

  it("the Listing is looked for before the range is read: a Listing that does not exist is not found whatever the range is", async () => {
    await expect(read({ listingId: ListingId("no-such-listing"), from: "yesterday" })).rejects.toThrow(ListingNotFound);
  });

  it("an invalid range gives no page at all", async () => {
    await add({ observedAt: "2026-11-19T10:00:00Z" });
    await expect(read({ from: "yesterday" })).rejects.toThrow(InvalidRange);
  });
});

describe("the pages of the history", () => {
  beforeEach(async () => {
    for (const hour of ["08", "09", "10", "11", "12"]) await add({ observedAt: `2026-11-19T${hour}:00:00Z` });
  });

  it("SC-19 / BR-05 / BR-08: the total counts the range, not the page", async () => {
    const result = await read({ from: "2026-11-19T09:00:00Z", limit: 2 });
    expect(moments(result)).toEqual(["12:00", "11:00"]);
    expect(result).toMatchObject({ total: 4, limit: 2, offset: 0 });
  });

  it("the next page continues where the first one ended", async () => {
    const result = await read({ from: "2026-11-19T09:00:00Z", limit: 2, offset: 2 });
    expect(moments(result)).toEqual(["10:00", "09:00"]);
  });

  it("a page beyond the end is empty, and the total is still known", async () => {
    const result = await read({ limit: 2, offset: 10 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(5);
  });

  it("walking the pages returns every observation once and in order", async () => {
    const seen: string[] = [];
    for (let offset = 0; offset < 5; offset += 2) seen.push(...moments(await read({ limit: 2, offset })));
    expect(seen).toEqual(["12:00", "11:00", "10:00", "09:00", "08:00"]);
  });
});

describe("what the use case does and does not do (BR-09)", () => {
  it("SC-09 / BR-09: only reads the Listing and the history: it cannot record, notify or evaluate", async () => {
    await add({ observedAt: "2026-11-19T10:00:00Z" });
    const calls: string[] = [];
    const spyObservations = Object.create(observations, {
      findByListing: { value: async (...args: Parameters<typeof observations.findByListing>) => (calls.push("findByListing"), observations.findByListing(...args)) },
      add: { value: async () => calls.push("add") },
    }) as PriceObservationRepository;
    const spyCatalogue = Object.create(catalogue, {
      find: { value: async (...args: Parameters<typeof catalogue.find>) => (calls.push("find"), catalogue.find(...args)) },
    }) as ListingCatalogue;

    await read({}, spyObservations, spyCatalogue);

    expect(calls).toEqual(["find", "findByListing"]);
    expect(observations.all()).toHaveLength(1);
  });
});
