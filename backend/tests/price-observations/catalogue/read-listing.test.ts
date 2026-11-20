/**
 * Application tests of UC-02 Read a Listing (feature 07). Each test names the scenario (SC-nn) or the
 * business rule (BR-nn) it verifies. The authentication belongs to the way in, and is tested with the API.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryListingCatalogue, InMemoryPriceObservationRepository } from "../../../src/price-observations/adapters";
import {
  ApplicationError,
  ListListings,
  ListingNotFound,
  ReadListing,
  type PriceObservationRepository,
} from "../../../src/price-observations/application";
import { ListingId } from "../../../src/shared/domain";
import { anObservation, type ObservationSpec } from "../../support/observations";

const HEADPHONES = ListingId("headphones-shop-a");

let catalogue: InMemoryListingCatalogue;
let observations: InMemoryPriceObservationRepository;

const read = (listingId: ListingId = HEADPHONES, repository: PriceObservationRepository = observations) =>
  new ReadListing(catalogue, repository).execute({ listingId });

const observe = async (...specs: ObservationSpec[]) => {
  for (const spec of specs) await observations.add(anObservation(spec));
};

beforeEach(() => {
  catalogue = new InMemoryListingCatalogue();
  observations = new InMemoryPriceObservationRepository();
  catalogue.addListing(HEADPHONES, "EUR", { title: "Wireless headphones", retailer: "Shop A" });
});

describe("reading one Listing", () => {
  it("SC-15 / BR-02 / BR-03 / BR-04: shows its title, Retailer, currency and Current Price with when it was observed", async () => {
    await observe({ observedAt: "2026-11-19T10:00:00Z", price: "100.00" });
    expect(await read()).toEqual({
      id: "headphones-shop-a",
      title: "Wireless headphones",
      retailer: "Shop A",
      currency: "EUR",
      currentPrice: { amount: "100.00", currency: "EUR", observedAt: "2026-11-19T10:00:00.000Z" },
    });
  });

  it("SC-15: it is the same view of the Listing that the list shows", async () => {
    await observe({ observedAt: "2026-11-19T10:00:00Z", price: "100.00" });
    const [fromList] = (await new ListListings(catalogue, observations).execute({ limit: 20, offset: 0 })).items;
    expect(await read()).toEqual(fromList);
  });

  it("SC-16 / BR-03 / BR-04: a Listing with no Current Price is found, and shows none", async () => {
    expect((await read()).currentPrice).toBeNull();
  });

  it("SC-16 / BR-03: neither does one whose latest observation has no Price", async () => {
    await observe({ observedAt: "2026-11-19T09:00:00Z", price: "50.00" }, { observedAt: "2026-11-19T10:00:00Z", price: null });
    expect((await read()).currentPrice).toBeNull();
  });

  it("BR-03: the Current Price is the one with the greatest Observed At", async () => {
    await observe({ observedAt: "2026-11-19T11:00:00Z", price: "90.00" }, { observedAt: "2026-11-19T10:00:00Z", price: "100.00" });
    expect((await read()).currentPrice?.amount).toBe("90.00");
  });
});

describe("a Listing that is not in the Catalogue", () => {
  it("SC-17 / BR-04: is not found, with the error of the module", async () => {
    const error = await read(ListingId("no-such-listing")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ListingNotFound);
    expect(error).toBeInstanceOf(ApplicationError);
  });

  it("SC-17: it does not look for its price", async () => {
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
    await read(ListingId("no-such-listing"), spying).catch(() => undefined);
    expect(reads).toEqual([]);
  });
});

describe("reading changes nothing", () => {
  it("SC-20 / BR-05: it never writes, and reading again gives the same answer", async () => {
    await observe({ price: "100.00" });
    const readOnly: PriceObservationRepository = new Proxy(observations, {
      get(target, property, receiver) {
        if (property === "add") return () => Promise.reject(new Error("a read must not write"));
        return Reflect.get(target, property, receiver);
      },
    });
    const before = observations.all();
    const first = await read(HEADPHONES, readOnly);
    expect(await read(HEADPHONES, readOnly)).toEqual(first);
    expect(observations.all()).toEqual(before);
  });
});
