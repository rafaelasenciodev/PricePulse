/**
 * The contract of the operations that feature 04 adds to PriceAlertRepository to read alerts, as
 * tests that any adapter must pass: finding one alert of an owner, and listing the alerts of an
 * owner by pages.
 *
 * It is a function so that the in-memory adapter and, later, a database adapter run exactly the
 * same checks. (Not a *.test.ts file: it is run from the test of each adapter.)
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { PriceAlertRepository } from "../../../src/price-alerts/application";
import { AlertId, AlertStatus, type PriceAlert } from "../../../src/price-alerts/domain";
import { anAlert, type AlertSpec } from "../../support/alerts";
import { UserId } from "../../../src/shared/domain";

const OWNER = UserId("user-1");
const OTHER_OWNER = UserId("user-2");

export function describeAlertRepositoryReadsContract(name: string, create: () => PriceAlertRepository | Promise<PriceAlertRepository>): void {
  describe(`PriceAlertRepository, reading alerts: ${name}`, () => {
    let repository: PriceAlertRepository;

    /** Adds an alert, in the state the spec says: Triggered and Cancelled ones are made through the port, as in use. */
    const add = async (spec: AlertSpec = {}): Promise<PriceAlert> => {
      const { status = AlertStatus.Active, ...rest } = spec;
      const alert = anAlert(rest);
      await repository.add(alert);
      if (status === AlertStatus.Triggered) await repository.save(alert.trigger(), AlertStatus.Active);
      if (status === AlertStatus.Cancelled) await repository.save(alert.cancel(), AlertStatus.Active);
      return alert;
    };

    const page = (query: { status?: AlertStatus; limit?: number; offset?: number } = {}, owner: UserId = OWNER) => {
      const { status, limit = 20, offset = 0 } = query;
      return repository.findByOwner(owner, status === undefined ? { limit, offset } : { status, limit, offset });
    };

    const ids = (alerts: readonly PriceAlert[]) => alerts.map((a) => a.id);

    beforeEach(async () => {
      repository = await create();
    });

    describe("find", () => {
      it("returns nothing when nothing is stored", async () => {
        expect(await repository.find(OWNER, AlertId("no-such-alert"))).toBeNull();
      });

      it("returns the alert of the owner, with its data", async () => {
        const alert = await add({ owner: "user-1", listing: "headphones-shop-a", target: "80.00", createdAt: "2026-11-19T10:00:00Z" });
        const found = await repository.find(OWNER, alert.id);
        expect(found?.id).toBe(alert.id);
        expect(found?.owner).toBe(OWNER);
        expect(found?.listingId).toBe("headphones-shop-a");
        expect(found?.targetPrice.toDecimalString()).toBe("80.00");
        expect(found?.status).toBe(AlertStatus.Active);
        expect(found?.createdAt.toIsoString()).toBe("2026-11-19T10:00:00.000Z");
      });

      it("BR-01: returns nothing for an alert of another owner, as for one that does not exist", async () => {
        const theirs = await add({ owner: "user-2" });
        expect(await repository.find(OWNER, theirs.id)).toBeNull();
        expect((await repository.find(OTHER_OWNER, theirs.id))?.id).toBe(theirs.id);
      });

      it("returns the one that was asked for, among several", async () => {
        const first = await add({ listing: "l-1" });
        const second = await add({ listing: "l-2" });
        expect((await repository.find(OWNER, second.id))?.listingId).toBe("l-2");
        expect((await repository.find(OWNER, first.id))?.listingId).toBe("l-1");
      });

      it.each([[AlertStatus.Active], [AlertStatus.Triggered], [AlertStatus.Cancelled]])(
        "returns an alert in the state %s",
        async (status) => {
          const alert = await add({ status });
          expect((await repository.find(OWNER, alert.id))?.status).toBe(status);
        },
      );
    });

    describe("findByOwner", () => {
      it("returns an empty page and a total of zero for an owner without alerts", async () => {
        await add({ owner: "user-2" });
        expect(await page()).toEqual({ items: [], total: 0 });
      });

      it("BR-01: returns only the alerts of the owner, and the total counts only theirs", async () => {
        const mine = await add({ owner: "user-1", listing: "l-1" });
        await add({ owner: "user-2", listing: "l-2" });
        await add({ owner: "user-2", listing: "l-3" });
        const result = await page();
        expect(ids(result.items)).toEqual([mine.id]);
        expect(result.total).toBe(1);
      });

      it("BR-02: comes newest first by creation moment", async () => {
        const oldest = await add({ listing: "l-1", createdAt: "2026-11-19T08:00:00Z" });
        const newest = await add({ listing: "l-2", createdAt: "2026-11-19T12:00:00Z" });
        const middle = await add({ listing: "l-3", createdAt: "2026-11-19T10:00:00Z" });
        expect(ids((await page()).items)).toEqual([newest.id, middle.id, oldest.id]);
      });

      it("tells apart the milliseconds of the creation moment", async () => {
        const earlier = await add({ listing: "l-1", createdAt: "2026-11-19T10:00:00.001Z" });
        const later = await add({ listing: "l-2", createdAt: "2026-11-19T10:00:00.002Z" });
        expect(ids((await page()).items)).toEqual([later.id, earlier.id]);
      });

      it("two alerts with the same creation moment come by identifier, so that the pages are stable", async () => {
        await add({ id: AlertId("b"), listing: "l-1", createdAt: "2026-11-19T10:00:00Z" });
        await add({ id: AlertId("c"), listing: "l-2", createdAt: "2026-11-19T10:00:00Z" });
        await add({ id: AlertId("a"), listing: "l-3", createdAt: "2026-11-19T10:00:00Z" });
        expect(ids((await page()).items)).toEqual(["a", "b", "c"]);
      });

      it("SC-02 / BR-02: without a filter it returns the alerts in every state", async () => {
        await add({ listing: "l-1", status: AlertStatus.Active });
        await add({ listing: "l-2", status: AlertStatus.Triggered });
        await add({ listing: "l-3", status: AlertStatus.Cancelled });
        const result = await page();
        expect(result.items.map((a) => a.status).sort()).toEqual(["active", "cancelled", "triggered"]);
        expect(result.total).toBe(3);
      });

      it.each([[AlertStatus.Active], [AlertStatus.Triggered], [AlertStatus.Cancelled]])(
        "SC-02 / BR-02: filtered by the state %s it returns only those, and the total counts only those",
        async (status) => {
          await add({ listing: "l-1", status: AlertStatus.Active });
          await add({ listing: "l-2", status: AlertStatus.Triggered });
          await add({ listing: "l-3", status: AlertStatus.Cancelled });
          const result = await page({ status });
          expect(result.items.map((a) => a.status)).toEqual([status]);
          expect(result.total).toBe(1);
        },
      );

      it("follows the changes of state: a cancelled alert moves from the Active ones to the Cancelled ones", async () => {
        const alert = await add({ listing: "l-1" });
        await repository.save(alert.cancel(), AlertStatus.Active);
        expect((await page({ status: AlertStatus.Active })).total).toBe(0);
        expect(ids((await page({ status: AlertStatus.Cancelled })).items)).toEqual([alert.id]);
      });

      it("a change of state or of Target Price does not change the order: it follows the creation moment", async () => {
        const older = await add({ listing: "l-1", createdAt: "2026-11-19T08:00:00Z" });
        const newer = await add({ listing: "l-2", createdAt: "2026-11-19T12:00:00Z" });
        await repository.save(older.cancel(), AlertStatus.Active);
        await repository.save(newer.changeTargetPrice(newer.targetPrice, null), AlertStatus.Active);
        expect(ids((await page()).items)).toEqual([newer.id, older.id]);
      });

      describe("pages", () => {
        beforeEach(async () => {
          // Five alerts, created one hour apart: l-5 is the newest.
          for (let hour = 1; hour <= 5; hour++) await add({ listing: `l-${hour}`, createdAt: `2026-11-19T0${hour}:00:00Z` });
        });

        const listings = (result: { items: readonly PriceAlert[] }) => result.items.map((a) => a.listingId);

        it("gives the page asked for, and the total of all of them", async () => {
          const result = await page({ limit: 2, offset: 0 });
          expect(listings(result)).toEqual(["l-5", "l-4"]);
          expect(result.total).toBe(5);
        });

        it("the next page continues where the first one ended", async () => {
          expect(listings(await page({ limit: 2, offset: 2 }))).toEqual(["l-3", "l-2"]);
        });

        it("the last page can be shorter than the limit", async () => {
          expect(listings(await page({ limit: 2, offset: 4 }))).toEqual(["l-1"]);
        });

        it("a page beyond the end is empty, and the total is still known", async () => {
          const result = await page({ limit: 2, offset: 10 });
          expect(result.items).toEqual([]);
          expect(result.total).toBe(5);
        });

        it("a limit larger than the total returns all of them", async () => {
          expect(listings(await page({ limit: 100 }))).toEqual(["l-5", "l-4", "l-3", "l-2", "l-1"]);
        });

        it("walking the pages returns every alert once and in order", async () => {
          const seen: string[] = [];
          for (let offset = 0; offset < 5; offset += 2) seen.push(...listings(await page({ limit: 2, offset })));
          expect(seen).toEqual(["l-5", "l-4", "l-3", "l-2", "l-1"]);
        });

        it("the total counts the alerts that match the filter, not the page", async () => {
          await add({ listing: "l-6", status: AlertStatus.Cancelled });
          const result = await page({ status: AlertStatus.Cancelled, limit: 1 });
          expect(result.total).toBe(1);
        });
      });
    });
  });
}
