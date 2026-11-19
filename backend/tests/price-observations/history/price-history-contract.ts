/**
 * The contract of the operation that feature 05 adds to PriceObservationRepository to read the
 * Price History of a Listing by pages, as tests that any adapter must pass.
 *
 * It is a function so that the in-memory adapter and, later, a database adapter run exactly the
 * same checks. (Not a *.test.ts file: it is run from the test of each adapter.)
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { PriceObservationRepository } from "../../../src/price-observations/application";
import { ObservedAtRange, type PriceObservation } from "../../../src/price-observations/domain";
import { ListingId, ObservedAt } from "../../../src/shared/domain";
import { anObservation, type ObservationSpec } from "../../support/observations";

const HEADPHONES = ListingId("headphones-shop-a");
const at = (text: string) => ObservedAt.fromIsoString(`2026-11-19T${text}:00Z`);

export function describePriceHistoryContract(name: string, create: () => PriceObservationRepository): void {
  describe(`PriceObservationRepository, reading the Price History: ${name}`, () => {
    let repository: PriceObservationRepository;

    const add = async (...specs: ObservationSpec[]) => {
      for (const spec of specs) await repository.add(anObservation(spec));
    };

    const history = (
      query: { listing?: ListingId; range?: ObservedAtRange; limit?: number; offset?: number } = {},
    ) =>
      repository.findByListing(query.listing ?? HEADPHONES, {
        range: query.range ?? ObservedAtRange.unbounded(),
        limit: query.limit ?? 20,
        offset: query.offset ?? 0,
      });

    const hours = (items: readonly PriceObservation[]) => items.map((o) => o.observedAt.toIsoString().slice(11, 16));

    beforeEach(() => {
      repository = create();
    });

    it("returns an empty page and a total of zero for a Listing without observations", async () => {
      await add({ listing: "keyboard-shop-b" });
      expect(await history()).toEqual({ items: [], total: 0 });
    });

    it("returns each observation with its Provider, Listing, Observed At and Price", async () => {
      await add({ provider: "simulator", listing: "headphones-shop-a", observedAt: "2026-11-19T10:00:00Z", price: "79.90" });

      const [found] = (await history()).items;

      expect(found?.provider).toBe("simulator");
      expect(found?.listingId).toBe("headphones-shop-a");
      expect(found?.observedAt.toIsoString()).toBe("2026-11-19T10:00:00.000Z");
      expect(found?.price?.toDecimalString()).toBe("79.90");
    });

    it("BR-05: returns an observation without a Price, which means the Listing was unavailable", async () => {
      await add({ observedAt: "2026-11-19T10:00:00Z", price: "100.00" }, { observedAt: "2026-11-19T11:00:00Z", price: null });
      const result = await history();
      expect(hours(result.items)).toEqual(["11:00", "10:00"]);
      expect(result.items[0]?.price).toBeNull();
    });

    it("BR-05: returns only the observations of the Listing, and the total counts only those", async () => {
      await add({ listing: "headphones-shop-a" }, { listing: "keyboard-shop-b", observedAt: "2026-11-19T11:00:00Z" }, { listing: "keyboard-shop-b", observedAt: "2026-11-19T12:00:00Z" });
      const result = await history({ listing: HEADPHONES });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("BR-05: comes newest Observed At first, whatever the order in which they were stored", async () => {
      await add({ observedAt: "2026-11-19T10:00:00Z" }, { observedAt: "2026-11-19T12:00:00Z" }, { observedAt: "2026-11-19T11:00:00Z" });
      expect(hours((await history()).items)).toEqual(["12:00", "11:00", "10:00"]);
    });

    it("tells the milliseconds of the Observed At apart", async () => {
      await add({ observedAt: "2026-11-19T10:00:00.001Z" }, { observedAt: "2026-11-19T10:00:00.002Z" });
      const stamps = (await history()).items.map((o) => o.observedAt.toIsoString());
      expect(stamps).toEqual(["2026-11-19T10:00:00.002Z", "2026-11-19T10:00:00.001Z"]);
    });

    it("two at the same moment, of different Providers, come by Provider, so that the pages are stable", async () => {
      await add({ provider: "provider-b", observedAt: "2026-11-19T10:00:00Z" }, { provider: "provider-c", observedAt: "2026-11-19T10:00:00Z" }, { provider: "provider-a", observedAt: "2026-11-19T10:00:00Z" });
      expect((await history()).items.map((o) => o.provider)).toEqual(["provider-a", "provider-b", "provider-c"]);
    });

    describe("the range (BR-06)", () => {
      beforeEach(async () => {
        await add({ observedAt: "2026-11-19T10:00:00Z" }, { observedAt: "2026-11-19T11:00:00Z" }, { observedAt: "2026-11-19T12:00:00Z" });
      });

      it("an unbounded range returns everything", async () => {
        expect(hours((await history()).items)).toEqual(["12:00", "11:00", "10:00"]);
      });

      it("includes its start and leaves out its end", async () => {
        const range = ObservedAtRange.of(at("10:00"), at("12:00"));
        const result = await history({ range });
        expect(hours(result.items)).toEqual(["11:00", "10:00"]);
        expect(result.total).toBe(2);
      });

      it("a range with only a start", async () => {
        expect(hours((await history({ range: ObservedAtRange.of(at("11:00"), null) })).items)).toEqual(["12:00", "11:00"]);
      });

      it("a range with only an end", async () => {
        expect(hours((await history({ range: ObservedAtRange.of(null, at("11:00")) })).items)).toEqual(["10:00"]);
      });

      it("a range that includes nothing gives an empty page and a total of zero", async () => {
        const result = await history({ range: ObservedAtRange.of(at("13:00"), null) });
        expect(result).toEqual({ items: [], total: 0 });
      });

      it("the limits of the range are exact to the millisecond", async () => {
        await add({ observedAt: "2026-11-19T10:59:59.999Z" }, { observedAt: "2026-11-19T11:00:00.001Z" });
        const range = ObservedAtRange.of(at("11:00"), ObservedAt.fromIsoString("2026-11-19T11:00:00.001Z"));
        const stamps = (await history({ range })).items.map((o) => o.observedAt.toIsoString());
        expect(stamps).toEqual(["2026-11-19T11:00:00.000Z"]);
      });
    });

    describe("pages (BR-08)", () => {
      beforeEach(async () => {
        for (const hour of ["08", "09", "10", "11", "12"]) await add({ observedAt: `2026-11-19T${hour}:00:00Z` });
      });

      it("gives the page asked for, and the total of all of them", async () => {
        const result = await history({ limit: 2, offset: 0 });
        expect(hours(result.items)).toEqual(["12:00", "11:00"]);
        expect(result.total).toBe(5);
      });

      it("the next page continues where the first one ended", async () => {
        expect(hours((await history({ limit: 2, offset: 2 })).items)).toEqual(["10:00", "09:00"]);
      });

      it("the last page can be shorter than the limit", async () => {
        expect(hours((await history({ limit: 2, offset: 4 })).items)).toEqual(["08:00"]);
      });

      it("a page beyond the end is empty, and the total is still known", async () => {
        const result = await history({ limit: 2, offset: 10 });
        expect(result.items).toEqual([]);
        expect(result.total).toBe(5);
      });

      it("the total counts the range and not the page", async () => {
        const range = ObservedAtRange.of(at("09:00"), null);
        const result = await history({ range, limit: 2 });
        expect(hours(result.items)).toEqual(["12:00", "11:00"]);
        expect(result.total).toBe(4);
      });

      it("walking the pages returns every observation once and in order", async () => {
        const seen: string[] = [];
        for (let offset = 0; offset < 5; offset += 2) seen.push(...hours((await history({ limit: 2, offset })).items));
        expect(seen).toEqual(["12:00", "11:00", "10:00", "09:00", "08:00"]);
      });
    });
  });
}
