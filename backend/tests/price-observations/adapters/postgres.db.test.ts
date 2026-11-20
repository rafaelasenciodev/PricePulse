import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "../../../src/database/connect";
import { PostgresListingCatalogue } from "../../../src/price-observations/adapters";
import { ListingId } from "../../../src/shared/domain";
import { testPool, truncateAll } from "../../support/database";
import { describeListingCatalogueContract } from "../catalogue/listing-catalogue-contract";

let pool: Pool;
beforeAll(async () => {
  pool = await testPool();
});
afterAll(async () => {
  await pool.end();
});

describeListingCatalogueContract("PostgresListingCatalogue", async () => {
  await truncateAll(pool);
  const catalogue = new PostgresListingCatalogue(pool);
  return { catalogue, add: (l) => catalogue.addListing(ListingId(l.id), l.currency, { title: l.title, retailer: l.retailer }) };
});

describe("PostgresListingCatalogue: what is specific to this adapter", () => {
  const HEADPHONES = ListingId("headphones-shop-a");

  it("adding a Listing that exists replaces it", async () => {
    await truncateAll(pool);
    const catalogue = new PostgresListingCatalogue(pool);
    await catalogue.addListing(HEADPHONES, "EUR", { title: "Old title", retailer: "Old shop" });
    await catalogue.addListing(HEADPHONES, "USD", { title: "New title", retailer: "New shop" });
    expect(await catalogue.find(HEADPHONES)).toEqual({ id: HEADPHONES, title: "New title", retailer: "New shop", currency: "USD" });
    expect((await catalogue.list({ limit: 10, offset: 0 })).total).toBe(1);
  });

  it("refuses an empty title or Retailer", async () => {
    await truncateAll(pool);
    const catalogue = new PostgresListingCatalogue(pool);
    await expect(catalogue.addListing(HEADPHONES, "EUR", { title: " ", retailer: "Shop" })).rejects.toThrow(RangeError);
    await expect(catalogue.addListing(HEADPHONES, "EUR", { title: "Title", retailer: "" })).rejects.toThrow(RangeError);
  });

  it("without text, the title is the identifier and the Retailer is unknown, as in memory", async () => {
    await truncateAll(pool);
    const catalogue = new PostgresListingCatalogue(pool);
    await catalogue.addListing(HEADPHONES, "EUR");
    expect(await catalogue.find(HEADPHONES)).toEqual({ id: HEADPHONES, title: "headphones-shop-a", retailer: "Unknown retailer", currency: "EUR" });
  });
});
