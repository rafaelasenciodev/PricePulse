import { describe, expect, it } from "vitest";
import {
  InMemoryListingCatalogue,
  InMemoryPriceObservationRepository,
  SystemClock,
} from "../../../src/price-observations/adapters";
import { ProviderId } from "../../../src/price-observations/domain";
import { ListingId } from "../../../src/shared/domain";
import { describeRepositoryContract, observation } from "./repository-contract";

describeRepositoryContract("InMemoryPriceObservationRepository", () => new InMemoryPriceObservationRepository());

describe("InMemoryPriceObservationRepository: what is specific to this adapter", () => {
  it("BR-13: with several observations sharing the greatest Observed At, the first one stored is returned", async () => {
    const repository = new InMemoryPriceObservationRepository();
    const headphones = ListingId("headphones-shop-a");
    await repository.add(observation("2026-11-19T10:00:00Z", "100.00", headphones, ProviderId("first")));
    await repository.add(observation("2026-11-19T10:00:00Z", "90.00", headphones, ProviderId("second")));
    // The contract leaves this undefined (it cannot happen with a single Provider).
    // The test only pins what this adapter does, so that a change is deliberate.
    expect((await repository.findLatest(headphones))?.provider).toBe("first");
  });

  it("all() lists every stored observation and cannot be used to change the store", async () => {
    const repository = new InMemoryPriceObservationRepository();
    await repository.add(observation("2026-11-19T10:00:00Z", "100.00"));
    expect(repository.all()).toHaveLength(1);
    repository.all().pop();
    expect(repository.all()).toHaveLength(1);
  });
});

describe("InMemoryListingCatalogue (contract of ListingCatalogue)", () => {
  const HEADPHONES = ListingId("headphones-shop-a");
  const KEYBOARD = ListingId("keyboard-shop-b");

  it("BR-02: returns nothing for a Listing that does not exist", async () => {
    expect(await new InMemoryListingCatalogue().find(HEADPHONES)).toBeNull();
  });

  it("returns the currency of a Listing that exists", async () => {
    const catalogue = new InMemoryListingCatalogue();
    catalogue.addListing(HEADPHONES, "EUR");
    catalogue.addListing(KEYBOARD, "USD");
    expect(await catalogue.find(HEADPHONES)).toEqual({ currency: "EUR" });
    expect(await catalogue.find(KEYBOARD)).toEqual({ currency: "USD" });
  });

  it("adding a Listing again replaces its currency", async () => {
    const catalogue = new InMemoryListingCatalogue();
    catalogue.addListing(HEADPHONES, "EUR");
    catalogue.addListing(HEADPHONES, "USD");
    expect(await catalogue.find(HEADPHONES)).toEqual({ currency: "USD" });
  });
});

describe("SystemClock (contract of Clock)", () => {
  it("returns the current moment", () => {
    const before = Date.now();
    const moment = new SystemClock().now();
    const after = Date.now();
    expect(moment.getTime()).toBeGreaterThanOrEqual(before);
    expect(moment.getTime()).toBeLessThanOrEqual(after);
  });

  it("returns a new Date each time, so that a caller cannot change what another one sees", () => {
    const clock = new SystemClock();
    expect(clock.now()).not.toBe(clock.now());
  });
});
