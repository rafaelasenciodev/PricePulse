/**
 * The contract of PriceObservationRepository, as tests that any adapter must pass.
 *
 * It is a function so that the in-memory adapter and, later, a database adapter run exactly
 * the same checks: what matters is the contract of the port, not the adapter.
 * (Not a *.test.ts file: it is run from the test of each adapter.)
 */

import { beforeEach, describe, expect, it } from "vitest";
import { CLOCK_TOLERANCE_MILLISECONDS, ObservationAlreadyExists, type PriceObservationRepository } from "../../../src/price-observations/application";
import { PriceObservation, ProviderId } from "../../../src/price-observations/domain";
import { ListingId, ObservedAt, Price } from "../../../src/shared/domain";

const SIMULATOR = ProviderId("simulator");
const OTHER_PROVIDER = ProviderId("other-provider");
const HEADPHONES = ListingId("headphones-shop-a");
const KEYBOARD = ListingId("keyboard-shop-a");

export function observation(
  observedAt: string,
  price: string | null,
  listingId: ListingId = HEADPHONES,
  provider: ProviderId = SIMULATOR,
): PriceObservation {
  return PriceObservation.record({
    provider,
    listingId,
    observedAt: ObservedAt.fromIsoString(observedAt),
    price: price === null ? null : Price.fromDecimalString(price, "EUR"),
    listingCurrency: "EUR",
    recordedAt: new Date("2026-11-19T12:00:00Z"),
    toleranceMilliseconds: CLOCK_TOLERANCE_MILLISECONDS,
  });
}

const at = (iso: string) => ObservedAt.fromIsoString(iso);

export function describeRepositoryContract(name: string, create: () => PriceObservationRepository | Promise<PriceObservationRepository>): void {
  describe(`${name} fulfils the contract of PriceObservationRepository`, () => {
    let repository: PriceObservationRepository;
    beforeEach(async () => {
      repository = await create();
    });

    describe("find", () => {
      it("returns nothing when nothing is stored", async () => {
        expect(await repository.find(SIMULATOR, HEADPHONES, at("2026-11-19T10:00:00Z"))).toBeNull();
      });

      it("returns the stored Price Observation with that Provider, Listing and Observed At", async () => {
        const stored = observation("2026-11-19T10:00:00Z", "79.90");
        await repository.add(stored);
        const found = await repository.find(SIMULATOR, HEADPHONES, at("2026-11-19T10:00:00Z"));
        expect(found?.hasSameContentAs(stored)).toBe(true);
        expect(found?.observedAt.equals(stored.observedAt)).toBe(true);
      });

      it("finds an observation without a Price too", async () => {
        await repository.add(observation("2026-11-19T10:00:00Z", null));
        const found = await repository.find(SIMULATOR, HEADPHONES, at("2026-11-19T10:00:00Z"));
        expect(found).not.toBeNull();
        expect(found?.price).toBeNull();
      });

      it("BR-09: each part of the identity counts: another Observed At, Listing or Provider finds nothing", async () => {
        await repository.add(observation("2026-11-19T10:00:00Z", "79.90"));
        expect(await repository.find(SIMULATOR, HEADPHONES, at("2026-11-19T10:00:00.001Z"))).toBeNull();
        expect(await repository.find(SIMULATOR, KEYBOARD, at("2026-11-19T10:00:00Z"))).toBeNull();
        expect(await repository.find(OTHER_PROVIDER, HEADPHONES, at("2026-11-19T10:00:00Z"))).toBeNull();
      });

      it("recognises the same instant written in another time zone", async () => {
        await repository.add(observation("2026-11-19T10:00:00Z", "79.90"));
        expect(await repository.find(SIMULATOR, HEADPHONES, at("2026-11-19T11:00:00+01:00"))).not.toBeNull();
      });
    });

    describe("add", () => {
      it("BR-06: stores observations that differ only in their Observed At", async () => {
        await repository.add(observation("2026-11-19T10:00:00Z", "79.90"));
        await repository.add(observation("2026-11-19T11:00:00Z", "79.90"));
        expect(await repository.find(SIMULATOR, HEADPHONES, at("2026-11-19T11:00:00Z"))).not.toBeNull();
      });

      it("BR-09: stores observations of another Provider or another Listing at the same Observed At", async () => {
        await repository.add(observation("2026-11-19T10:00:00Z", "79.90"));
        await expect(repository.add(observation("2026-11-19T10:00:00Z", "79.90", HEADPHONES, OTHER_PROVIDER))).resolves.toBeUndefined();
        await expect(repository.add(observation("2026-11-19T10:00:00Z", "79.90", KEYBOARD))).resolves.toBeUndefined();
      });

      it("BR-10: refuses a second observation with the same identity, even with other content", async () => {
        await repository.add(observation("2026-11-19T10:00:00Z", "79.90"));
        await expect(repository.add(observation("2026-11-19T10:00:00Z", "85.00"))).rejects.toThrow(
          ObservationAlreadyExists,
        );
        await expect(repository.add(observation("2026-11-19T10:00:00Z", null))).rejects.toThrow(ObservationAlreadyExists);
      });

      it("BR-10: a refused observation does not replace the stored one", async () => {
        await repository.add(observation("2026-11-19T10:00:00Z", "79.90"));
        await repository.add(observation("2026-11-19T10:00:00Z", "85.00")).catch(() => undefined);
        const found = await repository.find(SIMULATOR, HEADPHONES, at("2026-11-19T10:00:00Z"));
        expect(found?.price?.toDecimalString()).toBe("79.90");
      });

      it("the guarantee holds when two identical additions start together: exactly one succeeds", async () => {
        const outcomes = await Promise.allSettled([
          repository.add(observation("2026-11-19T10:00:00Z", "79.90")),
          repository.add(observation("2026-11-19T10:00:00Z", "79.90")),
        ]);
        expect(outcomes.map((o) => o.status).sort()).toEqual(["fulfilled", "rejected"]);
      });
    });

    describe("findLatest (BR-07)", () => {
      it("returns nothing for a Listing without observations", async () => {
        expect(await repository.findLatest(HEADPHONES)).toBeNull();
      });

      it("returns the one with the greatest Observed At", async () => {
        await repository.add(observation("2026-11-19T10:00:00Z", "100.00"));
        await repository.add(observation("2026-11-19T11:00:00Z", "90.00"));
        const latest = await repository.findLatest(HEADPHONES);
        expect(latest?.price?.toDecimalString()).toBe("90.00");
      });

      it("BR-08: does not depend on the order in which they were stored", async () => {
        await repository.add(observation("2026-11-19T11:00:00Z", "90.00"));
        await repository.add(observation("2026-11-19T10:00:00Z", "100.00"));
        const latest = await repository.findLatest(HEADPHONES);
        expect(latest?.price?.toDecimalString()).toBe("90.00");
      });

      it("a latest observation without a Price is the latest: it does not fall back to an earlier Price", async () => {
        await repository.add(observation("2026-11-19T10:00:00Z", "100.00"));
        await repository.add(observation("2026-11-19T11:00:00Z", null));
        const latest = await repository.findLatest(HEADPHONES);
        expect(latest).not.toBeNull();
        expect(latest?.price).toBeNull();
      });

      it("only considers the Listing asked for", async () => {
        await repository.add(observation("2026-11-19T10:00:00Z", "100.00"));
        await repository.add(observation("2026-11-19T11:00:00Z", "50.00", KEYBOARD));
        expect((await repository.findLatest(HEADPHONES))?.price?.toDecimalString()).toBe("100.00");
        expect((await repository.findLatest(KEYBOARD))?.price?.toDecimalString()).toBe("50.00");
      });

      it("considers every Provider: the greatest Observed At wins", async () => {
        await repository.add(observation("2026-11-19T10:00:00Z", "100.00", HEADPHONES, SIMULATOR));
        await repository.add(observation("2026-11-19T11:00:00Z", "90.00", HEADPHONES, OTHER_PROVIDER));
        expect((await repository.findLatest(HEADPHONES))?.price?.toDecimalString()).toBe("90.00");
      });

      it("tells instants apart by the millisecond", async () => {
        await repository.add(observation("2026-11-19T10:00:00.001Z", "90.00"));
        await repository.add(observation("2026-11-19T10:00:00.000Z", "100.00"));
        expect((await repository.findLatest(HEADPHONES))?.price?.toDecimalString()).toBe("90.00");
      });
    });
  });
}
