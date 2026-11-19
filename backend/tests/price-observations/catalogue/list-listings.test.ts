/**
 * Application tests of UC-01 List Listings (feature 07). Each test names the scenario (SC-nn) or the
 * business rule (BR-nn) it verifies. The order of the Catalogue is the contract of the port, checked
 * with its adapter; here it is checked that the use case keeps it. The bounds of `limit` and `offset`
 * and the authentication belong to the way in, and are tested with the API.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryListingCatalogue, InMemoryPriceObservationRepository } from "../../../src/price-observations/adapters";
import {
  ListListings,
  type CataloguePage,
  type ListingCatalogue,
  type PriceObservationRepository,
} from "../../../src/price-observations/application";
import { ListingId } from "../../../src/shared/domain";
import { anObservation, type ObservationSpec } from "../../support/observations";

let catalogue: InMemoryListingCatalogue;
let observations: InMemoryPriceObservationRepository;

const list = (
  query: { limit?: number; offset?: number } = {},
  listings: ListingCatalogue = catalogue,
  repository: PriceObservationRepository = observations,
) => new ListListings(listings, repository).execute({ limit: 20, offset: 0, ...query });

const addListing = (id: string, title: string, retailer: string, currency = "EUR") =>
  catalogue.addListing(ListingId(id), currency, { title, retailer });

const observe = async (...specs: ObservationSpec[]) => {
  for (const spec of specs) await observations.add(anObservation(spec));
};

/** `n` Listings whose titles sort in the order of their numbers. */
const addMany = (n: number) => {
  for (let i = 1; i <= n; i++) addListing(`listing-${String(i).padStart(2, "0")}`, `Item ${String(i).padStart(2, "0")}`, "Shop");
};

beforeEach(() => {
  catalogue = new InMemoryListingCatalogue();
  observations = new InMemoryPriceObservationRepository();
});

describe("what a Listing shows", () => {
  it("SC-01 / BR-01 / BR-02: shows its identifier, title, Retailer and currency, and the total", async () => {
    addListing("keyboard-shop-b", "Mechanical keyboard", "Shop B", "USD");
    addListing("headphones-shop-a", "Wireless headphones", "Shop A", "EUR");

    const result = await list();

    expect(result.total).toBe(2);
    expect(result.items).toEqual([
      { id: "keyboard-shop-b", title: "Mechanical keyboard", retailer: "Shop B", currency: "USD", currentPrice: null },
      { id: "headphones-shop-a", title: "Wireless headphones", retailer: "Shop A", currency: "EUR", currentPrice: null },
    ]);
  });

  it("BR-02: a Listing shows exactly those fields, so nothing else of the Catalogue leaks", async () => {
    addListing("headphones-shop-a", "Wireless headphones", "Shop A");
    expect(Object.keys((await list()).items[0]!).sort()).toEqual(["currency", "currentPrice", "id", "retailer", "title"]);
  });
});

describe("the order and the pages", () => {
  it("SC-02 / BR-01: keeps the order of the Catalogue: title, and then identifier", async () => {
    addListing("monitor-shop-a", "Monitor", "Shop A");
    addListing("headphones-shop-b", "Wireless headphones", "Shop B");
    addListing("headphones-shop-a", "Wireless headphones", "Shop A");
    addListing("keyboard-shop-b", "Mechanical keyboard", "Shop B");

    expect((await list()).items.map((l) => l.id)).toEqual([
      "keyboard-shop-b",
      "monitor-shop-a",
      "headphones-shop-a",
      "headphones-shop-b",
    ]);
  });

  it("BR-01: does not put the Listings in order itself: it shows the page as the Catalogue gives it", async () => {
    const page: CataloguePage = {
      items: [
        { id: ListingId("b"), title: "Second", retailer: "Shop", currency: "EUR" },
        { id: ListingId("a"), title: "First", retailer: "Shop", currency: "EUR" },
      ],
      total: 7,
    };
    const result = await list({}, { find: async () => null, list: async () => page });
    expect(result.items.map((l) => l.id)).toEqual(["b", "a"]);
    expect(result.total).toBe(7);
  });

  it("SC-03 / BR-01: an empty Catalogue is an empty page with a total of 0", async () => {
    expect(await list()).toEqual({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it("SC-10 / BR-07: a page holds the Listings that were asked for, and says the total, the limit and the offset", async () => {
    addMany(25);
    const result = await list({ limit: 20, offset: 0 });
    expect(result.items).toHaveLength(20);
    expect(result).toMatchObject({ total: 25, limit: 20, offset: 0 });
  });

  it("SC-11 / BR-01 / BR-07: the next page continues where the previous one stopped", async () => {
    addMany(25);
    const first = await list({ limit: 20, offset: 0 });
    const second = await list({ limit: 20, offset: 20 });
    expect(second.items.map((l) => l.id)).toEqual(["listing-21", "listing-22", "listing-23", "listing-24", "listing-25"]);
    expect(second.total).toBe(25);
    expect([...first.items, ...second.items].map((l) => l.id)).toHaveLength(25);
    expect(new Set([...first.items, ...second.items].map((l) => l.id)).size).toBe(25);
  });

  it("SC-12 / BR-07: a page beyond the end is empty and still says the total", async () => {
    addMany(3);
    expect(await list({ offset: 10 })).toEqual({ items: [], total: 3, limit: 20, offset: 10 });
  });

  it.each([
    [1, 1],
    [100, 3],
  ])("SC-13 / BR-07: with a limit of %i it shows %i Listings of 3", async (limit, shown) => {
    addMany(3);
    const result = await list({ limit });
    expect(result.items).toHaveLength(shown);
    expect(result.total).toBe(3);
  });

  it("reads the latest observation of the Listings of the page and no others", async () => {
    addMany(25);
    const reads: string[] = [];
    const spying: PriceObservationRepository = new Proxy(observations, {
      get(target, property, receiver) {
        if (property === "findLatest") {
          return (id: ListingId) => {
            reads.push(id);
            return target.findLatest(id);
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    await list({ limit: 5, offset: 10 }, catalogue, spying);
    expect(reads).toEqual(["listing-11", "listing-12", "listing-13", "listing-14", "listing-15"]);
  });
});

describe("the Current Price of a Listing (BR-03)", () => {
  beforeEach(() => {
    addListing("headphones-shop-a", "Wireless headphones", "Shop A");
  });

  const only = async () => (await list()).items[0]!;

  it("SC-04: shows the price and when it was observed", async () => {
    await observe({ observedAt: "2026-11-19T10:00:00Z", price: "100.00" });
    expect((await only()).currentPrice).toEqual({ amount: "100.00", currency: "EUR", observedAt: "2026-11-19T10:00:00.000Z" });
  });

  it("SC-05: a Listing with no Price Observation shows none", async () => {
    expect((await only()).currentPrice).toBeNull();
  });

  it("SC-06: a Listing whose latest observation has no Price shows none, although an earlier one had", async () => {
    await observe({ observedAt: "2026-11-19T09:00:00Z", price: "50.00" }, { observedAt: "2026-11-19T10:00:00Z", price: null });
    expect((await only()).currentPrice).toBeNull();
  });

  it("SC-07: the one with the greatest Observed At is the Current Price, whoever reported it and whenever it arrived", async () => {
    await observe(
      { provider: "simulator", observedAt: "2026-11-19T10:00:00Z", price: "90.00" },
      { provider: "other", observedAt: "2026-11-19T09:00:00Z", price: "95.00" },
    );
    expect((await only()).currentPrice?.amount).toBe("90.00");
  });

  it("SC-08: each Listing shows its own, in its own currency", async () => {
    addListing("keyboard-shop-b", "Mechanical keyboard", "Shop B", "USD");
    await observe({ price: "100.00" }, { listing: "keyboard-shop-b", price: "50.00", currency: "USD" });
    const [keyboard, headphones] = (await list()).items;
    expect(headphones?.currentPrice).toMatchObject({ amount: "100.00", currency: "EUR" });
    expect(keyboard?.currentPrice).toMatchObject({ amount: "50.00", currency: "USD" });
  });

  it("SC-09: a price recorded after a read is shown by the next one", async () => {
    await observe({ observedAt: "2026-11-19T10:00:00Z", price: "100.00" });
    expect((await only()).currentPrice?.amount).toBe("100.00");
    await observe({ observedAt: "2026-11-19T11:00:00Z", price: "79.90" });
    expect((await only()).currentPrice?.amount).toBe("79.90");
  });
});

describe("reading changes nothing", () => {
  it("SC-20 / BR-05 / BR-08: it never writes: the repository refuses a write, and two reads give the same answer", async () => {
    addMany(3);
    await observe({ listing: "listing-01" });
    const readOnly: PriceObservationRepository = new Proxy(observations, {
      get(target, property, receiver) {
        if (property === "add") return () => Promise.reject(new Error("a read must not write"));
        return Reflect.get(target, property, receiver);
      },
    });
    const before = observations.all();
    const first = await list({}, catalogue, readOnly);
    const second = await list({}, catalogue, readOnly);
    expect(second).toEqual(first);
    expect(observations.all()).toEqual(before);
    expect((await catalogue.list({ limit: 100, offset: 0 })).total).toBe(3);
  });
});
