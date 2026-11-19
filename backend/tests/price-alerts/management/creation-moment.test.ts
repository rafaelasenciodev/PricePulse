/**
 * BR-09 of feature 04: a Price Alert has a creation moment that never changes.
 * It is given by the clock of the creation (SC-22) and kept through the life of the alert.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryListingReader, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { CreatePriceAlert, type Clock } from "../../../src/price-alerts/application";
import { UserId } from "../../../src/price-alerts/domain";
import { ListingId, Price } from "../../../src/shared/domain";

const USER = UserId("user-1");
const LISTING = ListingId("headphones-shop-a");

let alerts: InMemoryPriceAlertRepository;
let now: Date;
let create: (targetAmount: string) => ReturnType<CreatePriceAlert["execute"]>;

beforeEach(() => {
  alerts = new InMemoryPriceAlertRepository();
  const listings = new InMemoryListingReader();
  listings.addListing(LISTING, "EUR", Price.fromDecimalString("100.00", "EUR"));
  now = new Date("2026-11-19T10:00:00Z");
  const clock: Clock = { now: () => now };
  create = (targetAmount) => new CreatePriceAlert(listings, alerts, clock).execute({ owner: USER, listingId: LISTING, targetAmount });
});

describe("the creation moment of a Price Alert", () => {
  it("SC-22 / BR-09: a new Price Alert records when it was created", async () => {
    const result = await create("80.00");
    expect(result.alert.createdAt).toBe("2026-11-19T10:00:00.000Z");
    expect(alerts.all()[0]?.createdAt.toIsoString()).toBe("2026-11-19T10:00:00.000Z");
  });

  it("BR-09: a repeated creation returns the existing alert with its original creation moment", async () => {
    await create("80.00");
    now = new Date("2026-11-19T11:30:00Z");

    const repeated = await create("80.00");

    expect(repeated.created).toBe(false);
    expect(repeated.alert.createdAt).toBe("2026-11-19T10:00:00.000Z");
  });

  it("BR-09: becoming Triggered does not change it", async () => {
    await create("80.00");
    const [alert] = alerts.all();
    expect(alert?.trigger().createdAt.toIsoString()).toBe("2026-11-19T10:00:00.000Z");
  });

  it("the creation moment is taken when the alert is made, from the clock given", async () => {
    now = new Date("2030-01-02T03:04:05.678Z");
    const result = await create("80.00");
    expect(result.alert.createdAt).toBe("2030-01-02T03:04:05.678Z");
  });
});
