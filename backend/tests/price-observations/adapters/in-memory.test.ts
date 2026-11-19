import { describe, expect, it } from "vitest";
import {
  InMemoryListingCatalogue,
  InMemoryPriceObservationRepository,
  SystemClock,
} from "../../../src/price-observations/adapters";
import { ProviderId } from "../../../src/price-observations/domain";
import { ListingId } from "../../../src/shared/domain";
import { describeListingCatalogueContract } from "../catalogue/listing-catalogue-contract";
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

describeListingCatalogueContract("InMemoryListingCatalogue", () => {
  const catalogue = new InMemoryListingCatalogue();
  return { catalogue, add: (l) => catalogue.addListing(ListingId(l.id), l.currency, { title: l.title, retailer: l.retailer }) };
});

describe("InMemoryListingCatalogue: what is specific to this adapter", () => {
  const HEADPHONES = ListingId("headphones-shop-a");
  const KEYBOARD = ListingId("keyboard-shop-b");

  it("adding a Listing again replaces it, and it is listed once", async () => {
    const catalogue = new InMemoryListingCatalogue();
    catalogue.addListing(HEADPHONES, "EUR", { title: "Old title", retailer: "Old shop" });
    catalogue.addListing(HEADPHONES, "USD", { title: "New title", retailer: "New shop" });
    expect(await catalogue.find(HEADPHONES)).toEqual({ id: HEADPHONES, title: "New title", retailer: "New shop", currency: "USD" });
    expect((await catalogue.list({ limit: 10, offset: 0 })).total).toBe(1);
  });

  it("without a text, the title is the identifier and the Retailer is \"Unknown retailer\", so a test that needs a currency stays short", async () => {
    const catalogue = new InMemoryListingCatalogue();
    catalogue.addListing(KEYBOARD, "USD");
    expect(await catalogue.find(KEYBOARD)).toEqual({ id: KEYBOARD, title: "keyboard-shop-b", retailer: "Unknown retailer", currency: "USD" });
  });

  it.each([
    ["an empty title", { title: "", retailer: "Shop" }],
    ["a title of spaces", { title: "   ", retailer: "Shop" }],
    ["an empty Retailer", { title: "Title", retailer: "" }],
    ["a Retailer of spaces", { title: "Title", retailer: "  \t " }],
  ])("refuses %s, and stores nothing", async (_what, text) => {
    const catalogue = new InMemoryListingCatalogue();
    expect(() => catalogue.addListing(HEADPHONES, "EUR", text)).toThrow(RangeError);
    expect(await catalogue.find(HEADPHONES)).toBeNull();
  });

  it("a refused text does not replace a Listing that was there", async () => {
    const catalogue = new InMemoryListingCatalogue();
    catalogue.addListing(HEADPHONES, "EUR", { title: "Title", retailer: "Shop" });
    expect(() => catalogue.addListing(HEADPHONES, "USD", { title: "", retailer: "Shop" })).toThrow(RangeError);
    expect((await catalogue.find(HEADPHONES))?.currency).toBe("EUR");
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
