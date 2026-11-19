/**
 * The contract of ListingCatalogue, as tests that any adapter must pass.
 *
 * It is a function so that the in-memory adapter and, later, a database adapter run exactly the same
 * checks: what matters is the contract of the port, above all the order of `list`, which a database
 * has to answer the same way. The port has no operation to add a Listing, so the adapter gives one here.
 * (Not a *.test.ts file: it is run from the test of each adapter.)
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { ListingCatalogue } from "../../../src/price-observations/application";
import { ListingId } from "../../../src/shared/domain";

export interface CatalogueFixture {
  readonly catalogue: ListingCatalogue;
  /** Puts a Listing in the Catalogue. */
  add(listing: { id: string; title: string; retailer: string; currency: string }): void;
}

const ids = (page: { items: readonly { id: string }[] }) => page.items.map((l) => l.id);

export function describeListingCatalogueContract(name: string, create: () => CatalogueFixture): void {
  describe(`ListingCatalogue: ${name}`, () => {
    let fixture: CatalogueFixture;
    let catalogue: ListingCatalogue;
    const add = (id: string, title: string, retailer = "Shop", currency = "EUR") => fixture.add({ id, title, retailer, currency });
    const all = () => catalogue.list({ limit: 100, offset: 0 });

    beforeEach(() => {
      fixture = create();
      catalogue = fixture.catalogue;
    });

    describe("find", () => {
      it("SC-17 / BR-04: finds nothing for a Listing that is not in the Catalogue", async () => {
        add("headphones-shop-a", "Wireless headphones");
        expect(await catalogue.find(ListingId("no-such-listing"))).toBeNull();
      });

      it("SC-01 / BR-02: finds a Listing with its identifier, title, Retailer and currency", async () => {
        add("keyboard-shop-b", "Mechanical keyboard", "Shop B", "USD");
        expect(await catalogue.find(ListingId("keyboard-shop-b"))).toEqual({
          id: "keyboard-shop-b",
          title: "Mechanical keyboard",
          retailer: "Shop B",
          currency: "USD",
        });
      });
    });

    describe("list", () => {
      it("SC-03 / BR-01: an empty Catalogue is an empty page with a total of 0", async () => {
        expect(await all()).toEqual({ items: [], total: 0 });
      });

      it("SC-01 / BR-02: lists every Listing with its identifier, title, Retailer and currency", async () => {
        add("keyboard-shop-b", "Mechanical keyboard", "Shop B", "USD");
        add("headphones-shop-a", "Wireless headphones", "Shop A", "EUR");
        expect(await all()).toEqual({
          items: [
            { id: "keyboard-shop-b", title: "Mechanical keyboard", retailer: "Shop B", currency: "USD" },
            { id: "headphones-shop-a", title: "Wireless headphones", retailer: "Shop A", currency: "EUR" },
          ],
          total: 2,
        });
      });

      describe("the order (BR-01)", () => {
        it("SC-02: by title and then by identifier", async () => {
          add("monitor-shop-a", "Monitor");
          add("headphones-shop-b", "Wireless headphones");
          add("headphones-shop-a", "Wireless headphones");
          add("keyboard-shop-b", "Mechanical keyboard");
          expect(ids(await all())).toEqual(["keyboard-shop-b", "monitor-shop-a", "headphones-shop-a", "headphones-shop-b"]);
        });

        it("does not depend on the order in which the Listings were added", async () => {
          const listings: [string, string][] = [
            ["c", "Cherry"],
            ["a", "Apple"],
            ["b2", "Banana"],
            ["b1", "Banana"],
          ];
          const forward = create();
          const backward = create();
          for (const [id, title] of listings) forward.add({ id, title, retailer: "Shop", currency: "EUR" });
          for (const [id, title] of [...listings].reverse()) backward.add({ id, title, retailer: "Shop", currency: "EUR" });
          const expected = ["a", "b1", "b2", "c"];
          expect(ids(await forward.catalogue.list({ limit: 100, offset: 0 }))).toEqual(expected);
          expect(ids(await backward.catalogue.list({ limit: 100, offset: 0 }))).toEqual(expected);
        });

        it("a capital does not decide: titles are compared in lower case", async () => {
          add("z", "Zebra");
          add("a", "apple");
          add("b", "Banana");
          expect(ids(await all())).toEqual(["a", "b", "z"]);
        });

        it("two titles that differ only in capitals are a tie, and the identifier decides", async () => {
          add("id-2", "Monitor");
          add("id-1", "MONITOR");
          expect(ids(await all())).toEqual(["id-1", "id-2"]);
        });

        it("compares characters by their codes, so the order is the same on every machine: digits, then letters, and an accent after z", async () => {
          add("accent", "Éclair");
          add("zebra", "Zebra");
          add("digit", "27-inch monitor");
          add("apple", "Apple");
          expect(ids(await all())).toEqual(["digit", "apple", "zebra", "accent"]);
        });

        it("compares the identifiers by their codes too, so a capital comes before a lower case letter", async () => {
          add("a-shop", "Monitor");
          add("B-shop", "Monitor");
          expect(ids(await all())).toEqual(["B-shop", "a-shop"]);
        });
      });

      describe("the pages (BR-07)", () => {
        const addMany = (n: number) => {
          for (let i = 1; i <= n; i++) add(`listing-${String(i).padStart(2, "0")}`, `Item ${String(i).padStart(2, "0")}`);
        };

        it("SC-10: a page holds at most `limit` Listings, and the total counts all of them", async () => {
          addMany(25);
          const page = await catalogue.list({ limit: 20, offset: 0 });
          expect(page.items).toHaveLength(20);
          expect(page.total).toBe(25);
        });

        it("SC-11: the next page continues where the previous one stopped, with no gap and no repetition", async () => {
          addMany(25);
          const first = await catalogue.list({ limit: 10, offset: 0 });
          const second = await catalogue.list({ limit: 10, offset: 10 });
          const third = await catalogue.list({ limit: 10, offset: 20 });
          expect(third.items).toHaveLength(5);
          expect([...ids(first), ...ids(second), ...ids(third)]).toEqual(ids(await all()));
          expect(ids(await all())).toHaveLength(25);
        });

        it("SC-12: a page beyond the end is empty and still says the total", async () => {
          addMany(3);
          expect(await catalogue.list({ limit: 20, offset: 10 })).toEqual({ items: [], total: 3 });
        });

        it("SC-13: a limit of 1 gives the first Listing, and the total is still the whole Catalogue", async () => {
          addMany(3);
          const page = await catalogue.list({ limit: 1, offset: 0 });
          expect(ids(page)).toEqual(["listing-01"]);
          expect(page.total).toBe(3);
        });

        it("an offset in the middle starts at that Listing in the order of the Catalogue", async () => {
          addMany(5);
          expect(ids(await catalogue.list({ limit: 2, offset: 2 }))).toEqual(["listing-03", "listing-04"]);
        });

        it("the page that is given cannot be used to change the Catalogue", async () => {
          addMany(3);
          const page = await catalogue.list({ limit: 10, offset: 0 });
          (page.items as unknown[]).pop();
          expect((await catalogue.list({ limit: 10, offset: 0 })).items).toHaveLength(3);
        });
      });

      it("SC-20 / BR-05: reading it again gives the same answer", async () => {
        add("a", "Apple");
        add("b", "Banana");
        expect(await all()).toEqual(await all());
      });
    });
  });
}
