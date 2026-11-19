/**
 * The contract of the operations that feature 03 adds to PriceAlertRepository, as tests that
 * any adapter must pass: finding the Active alerts of a Listing, and saving an alert.
 *
 * It is a function so that the in-memory adapter and, later, a database adapter run exactly
 * the same checks. (Not a *.test.ts file: it is run from the test of each adapter.)
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { PriceAlertRepository } from "../../../src/price-alerts/application";
import { AlertStatus, PriceAlert, TargetPrice, UserId, newAlertId } from "../../../src/price-alerts/domain";
import { ListingId } from "../../../src/shared/domain";

const OWNER = UserId("user-1");
const OTHER_OWNER = UserId("user-2");
const LISTING = ListingId("headphones-shop-a");
const OTHER_LISTING = ListingId("keyboard-shop-b");

const active = (owner: UserId = OWNER, listing: ListingId = LISTING) =>
  new PriceAlert(newAlertId(), owner, listing, TargetPrice.fromDecimalString("80.00", "EUR"), AlertStatus.Active);

const ids = (alerts: readonly PriceAlert[]) => alerts.map((a) => a.id).sort();

export function describeAlertRepositoryEvaluationContract(name: string, create: () => PriceAlertRepository): void {
  describe(`PriceAlertRepository, operations of the evaluation: ${name}`, () => {
    let repository: PriceAlertRepository;

    beforeEach(() => {
      repository = create();
    });

    describe("findActiveByListing", () => {
      it("returns nothing for a Listing without Price Alerts", async () => {
        expect(await repository.findActiveByListing(LISTING)).toEqual([]);
      });

      it("returns the Active Price Alerts of every owner of the Listing", async () => {
        const mine = active(OWNER);
        const theirs = active(OTHER_OWNER);
        await repository.add(mine);
        await repository.add(theirs);
        expect(ids(await repository.findActiveByListing(LISTING))).toEqual(ids([mine, theirs]));
      });

      it("BR-01: returns only the Price Alerts of the Listing asked for", async () => {
        const here = active(OWNER, LISTING);
        await repository.add(here);
        await repository.add(active(OWNER, OTHER_LISTING));
        expect(ids(await repository.findActiveByListing(LISTING))).toEqual(ids([here]));
      });

      it("BR-01: never returns a Triggered Price Alert", async () => {
        const stays = active(OWNER);
        const ends = active(OTHER_OWNER);
        await repository.add(stays);
        await repository.add(ends);
        await repository.save(ends.trigger());
        expect(ids(await repository.findActiveByListing(LISTING))).toEqual(ids([stays]));
      });
    });

    describe("save", () => {
      it("stores the new state: a Price Alert that was saved as Triggered is no longer Active", async () => {
        const alert = active();
        await repository.add(alert);
        await repository.save(alert.trigger());
        expect(await repository.findActive(OWNER, LISTING)).toBeNull();
      });

      it("leaves the other Price Alerts as they were", async () => {
        const other = active(OTHER_OWNER);
        const alert = active(OWNER);
        await repository.add(other);
        await repository.add(alert);
        await repository.save(alert.trigger());
        expect((await repository.findActive(OTHER_OWNER, LISTING))?.id).toBe(other.id);
      });

      it("replaces the Price Alert with that identifier and not another of the same owner", async () => {
        const first = active(OWNER, LISTING);
        const second = active(OWNER, OTHER_LISTING);
        await repository.add(first);
        await repository.add(second);
        await repository.save(second.trigger());
        expect((await repository.findActive(OWNER, LISTING))?.id).toBe(first.id);
        expect(await repository.findActive(OWNER, OTHER_LISTING)).toBeNull();
      });

      it("saving the same Triggered Price Alert twice does no harm (two Evaluations at the same time)", async () => {
        const alert = active();
        await repository.add(alert);
        await repository.save(alert.trigger());
        await expect(repository.save(alert.trigger())).resolves.toBeUndefined();
        expect(await repository.findActive(OWNER, LISTING)).toBeNull();
      });

      it("fails for a Price Alert that was never added: saving is not a way to add one", async () => {
        await expect(repository.save(active().trigger())).rejects.toThrow();
        expect(await repository.findActiveByListing(LISTING)).toEqual([]);
      });

      it("BR-07 of feature 01: once Triggered, the owner can have a new Active Price Alert for the same Listing", async () => {
        const first = active();
        await repository.add(first);
        await repository.save(first.trigger());
        const second = active();
        await repository.add(second);
        expect((await repository.findActive(OWNER, LISTING))?.id).toBe(second.id);
      });
    });
  });
}
