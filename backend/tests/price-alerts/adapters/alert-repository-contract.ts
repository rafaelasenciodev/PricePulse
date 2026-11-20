/**
 * The contract of the base operations of PriceAlertRepository, as tests that any adapter must pass: adding an alert,
 * finding the Active one of an owner for a Listing, and the guarantee that an owner has one Active alert per Listing.
 *
 * It is a function so that the in-memory adapter and the one of PostgreSQL run exactly the same checks. (Not a
 * *.test.ts file: it is run from the test of each adapter.) The checks were in the test of the in-memory adapter
 * until feature 11, which needed them for a second adapter.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ActiveAlertAlreadyExists, type PriceAlertRepository } from "../../../src/price-alerts/application";
import { AlertStatus, PriceAlert, TargetPrice, newAlertId } from "../../../src/price-alerts/domain";
import { ListingId, UserId } from "../../../src/shared/domain";
import { CREATED_AT } from "../../support/created-at";

const USER = UserId("user-1");
const OTHER_USER = UserId("user-2");
const LISTING = ListingId("headphones-shop-a");
const OTHER_LISTING = ListingId("keyboard-shop-a");

const alert = (owner: UserId = USER, listing: ListingId = LISTING, status: AlertStatus = AlertStatus.Active) =>
  new PriceAlert(newAlertId(), owner, listing, TargetPrice.fromDecimalString("80.00", "EUR"), status, CREATED_AT);

export function describeAlertRepositoryBaseContract(name: string, create: () => PriceAlertRepository | Promise<PriceAlertRepository>): void {
  describe(`PriceAlertRepository, base operations: ${name}`, () => {
    let repository: PriceAlertRepository;
    beforeEach(async () => {
      repository = await create();
    });

    it("finds the Active Price Alert of an owner for a Listing", async () => {
      const stored = alert();
      await repository.add(stored);
      expect((await repository.findActive(USER, LISTING))?.equals(stored)).toBe(true);
    });

    it("find is scoped to owner and Listing", async () => {
      await repository.add(alert());
      expect(await repository.findActive(OTHER_USER, LISTING)).toBeNull();
      expect(await repository.findActive(USER, OTHER_LISTING)).toBeNull();
    });

    it("never returns a Triggered Price Alert", async () => {
      await repository.add(alert(USER, LISTING, AlertStatus.Triggered));
      expect(await repository.findActive(USER, LISTING)).toBeNull();
    });

    it("BR-07: refuses a second Active Price Alert for the same owner and Listing, and keeps the first", async () => {
      const first = alert();
      await repository.add(first);
      await expect(repository.add(alert())).rejects.toThrow(ActiveAlertAlreadyExists);
      expect(await repository.findActiveByListing(LISTING)).toHaveLength(1);
      expect((await repository.findActive(USER, LISTING))?.equals(first)).toBe(true);
    });

    it.each([
      ["another owner", () => alert(OTHER_USER)],
      ["another Listing", () => alert(USER, OTHER_LISTING)],
      ["a Triggered Price Alert", () => alert(USER, LISTING, AlertStatus.Triggered)],
    ])("accepts an alert that does not conflict: %s", async (_name, second) => {
      const first = alert();
      const other = second();
      await repository.add(first);
      await repository.add(other);
      expect((await repository.find(other.owner, other.id))?.equals(other)).toBe(true);
      expect((await repository.find(first.owner, first.id))?.equals(first)).toBe(true);
    });

    it("keeps the guarantee when two adds are started at the same time", async () => {
      const results = await Promise.allSettled([repository.add(alert()), repository.add(alert())]);
      expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
      expect(await repository.findActiveByListing(LISTING)).toHaveLength(1);
    });
  });
}
