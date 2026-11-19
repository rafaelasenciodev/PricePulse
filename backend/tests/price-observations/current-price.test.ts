/**
 * The two features working together, through the real use cases and the in-memory adapters.
 *
 * The Current Price of a Listing is not stored anywhere: it follows from the Price
 * Observations (BR-07, discovery Q8). These tests record observations with the use case of
 * this feature and read the Current Price the way feature 01 does, through ListingReader.
 * They cover the scenarios SC-06, SC-07 and SC-08, which the use case tests leave out because
 * the use case does not read the Current Price, and they check that Create Price Alert sees
 * what was observed.
 *
 * The sources of the reader are connected here by hand, as the Composition Root will do.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ComposedListingReader, InMemoryPriceAlertRepository } from "../../src/price-alerts/adapters";
import { CreatePriceAlert, TargetAlreadyReached } from "../../src/price-alerts/application";
import { UserId } from "../../src/price-alerts/domain";
import { InMemoryListingCatalogue, InMemoryPriceObservationRepository } from "../../src/price-observations/adapters";
import { RecordPriceObservation, type Clock } from "../../src/price-observations/application";
import { ProviderId } from "../../src/price-observations/domain";
import { ListingId } from "../../src/shared/domain";

const SIMULATOR = ProviderId("simulator");
const HEADPHONES = ListingId("headphones-shop-a");
const KEYBOARD = ListingId("keyboard-shop-b");
const USER = UserId("user-1");

class World {
  readonly catalogue = new InMemoryListingCatalogue();
  readonly observations = new InMemoryPriceObservationRepository();
  readonly alerts = new InMemoryPriceAlertRepository();
  private readonly clock: Clock = { now: () => new Date("2026-11-19T12:00:00Z") };

  readonly reader = new ComposedListingReader(
    async (id) => (await this.catalogue.find(id))?.currency ?? null,
    async (id) => (await this.observations.findLatest(id))?.price ?? null,
  );

  constructor() {
    this.catalogue.addListing(HEADPHONES, "EUR");
    this.catalogue.addListing(KEYBOARD, "USD");
  }

  /** Records an observation of the headphones, at the hour given on 2026-11-19. */
  record(hour: string, amount: string | null, listingId: ListingId = HEADPHONES) {
    const currency = listingId === KEYBOARD ? "USD" : "EUR";
    return new RecordPriceObservation(this.catalogue, this.observations, this.clock).execute({
      provider: SIMULATOR,
      listingId,
      observedAt: `2026-11-19T${hour}:00:00Z`,
      price: amount === null ? null : { amount, currency },
    });
  }

  async currentPrice(listingId: ListingId = HEADPHONES) {
    return (await this.reader.get(listingId))?.currentPrice?.toDecimalString() ?? null;
  }

  createAlert(target: string) {
    return new CreatePriceAlert(this.reader, this.alerts).execute({
      owner: USER,
      listingId: HEADPHONES,
      targetAmount: target,
    });
  }
}

let world: World;
beforeEach(() => {
  world = new World();
});

describe("the Current Price follows from the Price Observations (BR-07)", () => {
  it("SC-08: a Listing with no Price Observation has no Current Price", async () => {
    expect(await world.reader.get(HEADPHONES)).toEqual({ currency: "EUR", currentPrice: null });
  });

  it("a Listing that does not exist is not found, whatever was recorded", async () => {
    expect(await world.reader.get(ListingId("no-such-listing"))).toBeNull();
  });

  it("SC-01: after recording a Price, it is the Current Price, in the currency of the Listing", async () => {
    await world.record("10", "79.90");
    const view = await world.reader.get(HEADPHONES);
    expect(view?.currentPrice?.toDecimalString()).toBe("79.90");
    expect(view?.currentPrice?.currency).toBe("EUR");
  });

  it("SC-04: a later observation defines the Current Price", async () => {
    await world.record("10", "100.00");
    await world.record("11", "90.00");
    expect(await world.currentPrice()).toBe("90.00");
  });

  it("SC-05: a later observation equal to the previous one leaves the Current Price as it was", async () => {
    await world.record("10", "100.00");
    await world.record("11", "100.00");
    expect(await world.currentPrice()).toBe("100.00");
  });

  it("SC-06: a latest observation without a Price leaves the Listing with no Current Price", async () => {
    await world.record("10", "100.00");
    await world.record("11", null);
    expect(await world.currentPrice()).toBeNull();
  });

  it("SC-07: a Price after an observation without one is the Current Price again", async () => {
    await world.record("10", "100.00");
    await world.record("11", null);
    await world.record("12", "95.00");
    expect(await world.currentPrice()).toBe("95.00");
  });

  it("SC-09: an older observation, recorded later, does not change the Current Price", async () => {
    await world.record("11", "90.00");
    await world.record("10", "100.00");
    expect(await world.currentPrice()).toBe("90.00");
    expect(world.observations.all()).toHaveLength(2);
  });

  it("SC-03: a Price of zero is a Current Price, not the absence of one", async () => {
    await world.record("10", "0.00");
    const view = await world.reader.get(HEADPHONES);
    expect(view?.currentPrice).not.toBeNull();
    expect(view?.currentPrice?.toDecimalString()).toBe("0.00");
  });

  it("a Price repeated (BR-09) does not change the Current Price", async () => {
    await world.record("10", "100.00");
    await world.record("11", "90.00");
    await world.record("10", "100.00"); // a resend of the older one
    expect(await world.currentPrice()).toBe("90.00");
  });

  it("each Listing has its own Current Price, in its own currency", async () => {
    await world.record("10", "100.00");
    await world.record("11", "50.00", KEYBOARD);
    expect(await world.currentPrice(HEADPHONES)).toBe("100.00");
    expect(await world.currentPrice(KEYBOARD)).toBe("50.00");
    expect((await world.reader.get(KEYBOARD))?.currency).toBe("USD");
  });
});

describe("Create Price Alert sees what was observed", () => {
  it("a Target Price below the observed Price creates an Active Price Alert", async () => {
    await world.record("10", "100.00");
    const result = await world.createAlert("80.00");
    expect(result.created).toBe(true);
    expect(result.alert.status).toBe("active");
  });

  it("a Target Price that the observed Price already reaches is rejected", async () => {
    await world.record("10", "75.00");
    await expect(world.createAlert("80.00")).rejects.toThrow(TargetAlreadyReached);
    expect(world.alerts.all()).toEqual([]);
  });

  it("the Price that counts is the latest one: a rise after a fall allows the alert", async () => {
    await world.record("10", "75.00");
    await world.record("11", "100.00");
    await expect(world.createAlert("80.00")).resolves.toMatchObject({ created: true });
  });

  it("a Listing with no observation, or whose latest has no Price, accepts any valid Target Price", async () => {
    await expect(world.createAlert("80.00")).resolves.toMatchObject({ created: true });

    const another = new World();
    await another.record("10", "75.00");
    await another.record("11", null);
    await expect(another.createAlert("80.00")).resolves.toMatchObject({ created: true });
  });

  it("SC-21 / BR-11: recording a Price that reaches the Target Price leaves the Price Alert Active", async () => {
    await world.record("10", "100.00");
    await world.createAlert("80.00");
    await world.record("11", "75.00");
    const [alert] = world.alerts.all();
    expect(alert?.isActive).toBe(true);
    expect(world.alerts.all()).toHaveLength(1);
  });
});
