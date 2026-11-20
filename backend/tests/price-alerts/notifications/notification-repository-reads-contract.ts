/**
 * The contract of the operation that feature 05 adds to NotificationRepository to read the
 * Notifications of an owner by pages, as tests that any adapter must pass.
 *
 * It is a function so that the in-memory adapter and, later, a database adapter run exactly the
 * same checks. (Not a *.test.ts file: it is run from the test of each adapter.)
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { NotificationRepository } from "../../../src/price-alerts/application";
import { AlertId, type Notification } from "../../../src/price-alerts/domain";
import { aNotification, type NotificationSpec } from "../../support/notifications";
import { UserId } from "../../../src/shared/domain";

const OWNER = UserId("user-1");

export function describeNotificationRepositoryReadsContract(name: string, create: () => NotificationRepository | Promise<NotificationRepository>): void {
  describe(`NotificationRepository, reading by owner: ${name}`, () => {
    let repository: NotificationRepository;

    const add = async (...specs: NotificationSpec[]) => {
      for (const spec of specs) await repository.add(aNotification(spec));
    };

    const page = (query: { limit?: number; offset?: number } = {}, owner: UserId = OWNER) =>
      repository.findByOwner(owner, { limit: query.limit ?? 20, offset: query.offset ?? 0 });

    const alerts = (notifications: readonly Notification[]) => notifications.map((n) => n.alertId as string);

    beforeEach(async () => {
      repository = await create();
    });

    it("returns an empty page and a total of zero for an owner without Notifications", async () => {
      await add({ owner: "user-2" });
      expect(await page()).toEqual({ items: [], total: 0 });
    });

    it("returns the Notification with what it states", async () => {
      await add({ alertId: AlertId("alert-1"), owner: "user-1", listing: "keyboard-shop-b", target: "80.00", price: "79.90", observedAt: "2026-11-19T10:00:00Z" });

      const [found] = (await page()).items;

      expect(found?.alertId).toBe("alert-1");
      expect(found?.owner).toBe("user-1");
      expect(found?.listingId).toBe("keyboard-shop-b");
      expect(found?.targetPrice.toDecimalString()).toBe("80.00");
      expect(found?.currentPrice.toDecimalString()).toBe("79.90");
      expect(found?.observedAt.toIsoString()).toBe("2026-11-19T10:00:00.000Z");
    });

    it("BR-01: returns only the Notifications of the owner, and the total counts only theirs", async () => {
      await add({ alertId: AlertId("mine"), owner: "user-1" }, { alertId: AlertId("theirs-1"), owner: "user-2" }, { alertId: AlertId("theirs-2"), owner: "user-2" });

      const mine = await page();
      const theirs = await page({}, UserId("user-2"));

      expect(alerts(mine.items)).toEqual(["mine"]);
      expect(mine.total).toBe(1);
      expect(theirs.total).toBe(2);
    });

    it("BR-02: comes newest first by the Observed At of the price that reached the target", async () => {
      await add(
        { alertId: AlertId("oldest"), observedAt: "2026-11-19T08:00:00Z" },
        { alertId: AlertId("newest"), observedAt: "2026-11-19T12:00:00Z" },
        { alertId: AlertId("middle"), observedAt: "2026-11-19T10:00:00Z" },
      );
      expect(alerts((await page()).items)).toEqual(["newest", "middle", "oldest"]);
    });

    it("BR-02: tells the milliseconds of the Observed At apart", async () => {
      await add({ alertId: AlertId("a"), observedAt: "2026-11-19T10:00:00.001Z" }, { alertId: AlertId("b"), observedAt: "2026-11-19T10:00:00.002Z" });
      expect(alerts((await page()).items)).toEqual(["b", "a"]);
    });

    it("BR-02: two observed at the same moment come by the identifier of their Price Alert, so that the pages are stable", async () => {
      await add(
        { alertId: AlertId("c"), observedAt: "2026-11-19T10:00:00Z" },
        { alertId: AlertId("a"), observedAt: "2026-11-19T10:00:00Z" },
        { alertId: AlertId("b"), observedAt: "2026-11-19T10:00:00Z" },
      );
      expect(alerts((await page()).items)).toEqual(["a", "b", "c"]);
    });

    it("the order follows the Observed At and not the order in which the Notifications were stored", async () => {
      await add({ alertId: AlertId("late"), observedAt: "2026-11-19T12:00:00Z" });
      await add({ alertId: AlertId("early"), observedAt: "2026-11-19T08:00:00Z" });
      expect(alerts((await page()).items)).toEqual(["late", "early"]);
    });

    it("a Notification stored afterwards appears in the list, and the one that was there stays findable by its Price Alert", async () => {
      await add({ alertId: AlertId("first") });
      await add({ alertId: AlertId("second"), observedAt: "2026-11-19T11:00:00Z" });
      expect((await page()).total).toBe(2);
      expect((await repository.findByAlert(AlertId("first")))?.alertId).toBe("first");
    });

    describe("pages", () => {
      beforeEach(async () => {
        // Five Notifications, observed one hour apart: n-5 is the newest.
        for (let hour = 1; hour <= 5; hour++) await add({ alertId: AlertId(`n-${hour}`), observedAt: `2026-11-19T0${hour}:00:00Z` });
      });

      it("BR-08: gives the page asked for, and the total of all of them", async () => {
        const result = await page({ limit: 2, offset: 0 });
        expect(alerts(result.items)).toEqual(["n-5", "n-4"]);
        expect(result.total).toBe(5);
      });

      it("the next page continues where the first one ended", async () => {
        expect(alerts((await page({ limit: 2, offset: 2 })).items)).toEqual(["n-3", "n-2"]);
      });

      it("the last page can be shorter than the limit", async () => {
        expect(alerts((await page({ limit: 2, offset: 4 })).items)).toEqual(["n-1"]);
      });

      it("a page beyond the end is empty, and the total is still known", async () => {
        const result = await page({ limit: 2, offset: 10 });
        expect(result.items).toEqual([]);
        expect(result.total).toBe(5);
      });

      it("a limit larger than the total returns all of them", async () => {
        expect(alerts((await page({ limit: 100 })).items)).toEqual(["n-5", "n-4", "n-3", "n-2", "n-1"]);
      });

      it("walking the pages returns every Notification once and in order", async () => {
        const seen: string[] = [];
        for (let offset = 0; offset < 5; offset += 2) seen.push(...alerts((await page({ limit: 2, offset })).items));
        expect(seen).toEqual(["n-5", "n-4", "n-3", "n-2", "n-1"]);
      });
    });
  });
}
