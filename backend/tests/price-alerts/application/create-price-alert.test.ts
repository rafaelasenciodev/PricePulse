/**
 * Application tests of UC-01 Create Price Alert.
 *
 * Each test names the scenario (SC-nn) or the business rule (BR-nn) it verifies.
 * SC-14 (not signed in) is rejected at the HTTP boundary and is tested with the API (contract, decision 1).
 * SC-05 needs no test of its own: the command has no email or Watchlist data, so nothing can require them (BR-10).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryListingReader, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import {
  ActiveAlertAlreadyExists,
  ApplicationError,
  CreatePriceAlert,
  DuplicateAlert,
  InvalidTargetPrice,
  ListingNotFound,
  TargetAlreadyReached,
} from "../../../src/price-alerts/application";
import {
  AlertStatus,
  CurrencyMismatch,
  ListingId,
  Price,
  PriceAlert,
  TargetPrice,
  UnsupportedCurrency,
  UserId,
  newAlertId,
} from "../../../src/price-alerts/domain";

const USER = UserId("user-1");
const OTHER_USER = UserId("user-2");
const HEADPHONES = ListingId("headphones-shop-a");
const KEYBOARD = ListingId("keyboard-shop-a");

const eur = (amount: string) => Price.fromDecimalString(amount, "EUR");

/** A catalogue, a repository and the use case wired to them. */
class World {
  readonly listings = new InMemoryListingReader();

  constructor(readonly alerts: InMemoryPriceAlertRepository = new InMemoryPriceAlertRepository()) {
    this.listings.addListing(HEADPHONES, "EUR", eur("100.00"));
  }

  create(targetAmount: string, owner: UserId = USER, listingId: ListingId = HEADPHONES) {
    return new CreatePriceAlert(this.listings, this.alerts).execute({ owner, listingId, targetAmount });
  }

  async storeActiveAlert(target: string, owner: UserId = USER, listingId: ListingId = HEADPHONES) {
    const stored = new PriceAlert(
      newAlertId(),
      owner,
      listingId,
      TargetPrice.fromDecimalString(target, "EUR"),
      AlertStatus.Active,
    );
    await this.alerts.add(stored);
    return stored;
  }
}

let world: World;
beforeEach(() => {
  world = new World();
});

describe("happy paths", () => {
  it("SC-01: creates an Active Price Alert below the Current Price", async () => {
    const result = await world.create("80.00");
    expect(result.created).toBe(true);
    expect(result.alert).toMatchObject({
      status: "active",
      listingId: HEADPHONES,
      targetAmount: "80.00",
      currency: "EUR",
    });
    const stored = await world.alerts.findActive(USER, HEADPHONES);
    expect(stored?.owner).toBe(USER);
  });

  it("SC-02: creates a Price Alert for a Listing without a Current Price", async () => {
    // An unavailable Listing and a Listing whose price is not known both have no Current Price.
    world.listings.addListing(KEYBOARD, "EUR", null);
    const result = await world.create("80.00", USER, KEYBOARD);
    expect(result.created).toBe(true);
    expect(result.alert.status).toBe("active");
  });

  it("SC-03: accepts a Target Price one cent below the Current Price", async () => {
    expect((await world.create("99.99")).created).toBe(true);
  });

  it("SC-04: the Target Price takes the currency of the Listing", async () => {
    world.listings.addListing(KEYBOARD, "USD", Price.fromDecimalString("100.00", "USD"));
    const result = await world.create("80.00", USER, KEYBOARD);
    expect(result.alert.currency).toBe("USD");
  });

  it("SC-06: an Active Price Alert for another Listing does not prevent a new one", async () => {
    world.listings.addListing(KEYBOARD, "EUR", eur("50.00"));
    await world.storeActiveAlert("40.00", USER, KEYBOARD);
    expect((await world.create("80.00")).created).toBe(true);
    expect(world.alerts.all()).toHaveLength(2);
  });

  it("SC-07: an Active Price Alert of another User does not prevent a new one", async () => {
    await world.storeActiveAlert("80.00", OTHER_USER);
    expect((await world.create("80.00")).created).toBe(true);
    expect(world.alerts.all()).toHaveLength(2);
  });
});

describe("validity of the Target Price", () => {
  it.each(["100.00", "120.00"])(
    "SC-08 / SC-09: rejects a Target Price of %s that the Current Price already reaches",
    async (target) => {
      await expect(world.create(target)).rejects.toThrow(TargetAlreadyReached);
      expect(world.alerts.all()).toEqual([]);
    },
  );

  it("SC-10: uses the Current Price at the moment of the request", async () => {
    // The User saw 100.00 but the price fell before the request.
    world.listings.setCurrentPrice(HEADPHONES, eur("75.00"));
    await expect(world.create("80.00")).rejects.toThrow(TargetAlreadyReached);
    expect(world.alerts.all()).toEqual([]);
  });

  it.each(["0.00", "-5.00"])("SC-11: rejects %s, a Target Price not greater than zero", async (target) => {
    await expect(world.create(target)).rejects.toThrow(InvalidTargetPrice);
    expect(world.alerts.all()).toEqual([]);
  });

  it("SC-12: rejects a Target Price with more decimals than the currency allows", async () => {
    await expect(world.create("79.999")).rejects.toThrow(InvalidTargetPrice);
    expect(world.alerts.all()).toEqual([]);
  });

  it.each(["NaN", "Infinity", "abc", ""])("BR-04: rejects %j, which is not a number", async (target) => {
    await expect(world.create(target)).rejects.toThrow(InvalidTargetPrice);
  });
});

describe("who and on what", () => {
  it("SC-13: rejects a Listing that does not exist", async () => {
    await expect(world.create("80.00", USER, ListingId("nonexistent"))).rejects.toThrow(ListingNotFound);
    expect(world.alerts.all()).toEqual([]);
  });
});

describe("duplicates", () => {
  it("SC-15: rejects a different Target Price when an Active Price Alert exists", async () => {
    const existing = await world.storeActiveAlert("80.00");
    await expect(world.create("70.00")).rejects.toThrow(DuplicateAlert);
    expect(world.alerts.all()).toEqual([existing]);
    expect(existing.targetPrice.toDecimalString()).toBe("80.00");
  });

  it("SC-16: repeating the same creation returns the existing Price Alert", async () => {
    const first = await world.create("80.00");
    const second = await world.create("80.00");
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.alert.id).toBe(first.alert.id);
    expect(world.alerts.all()).toHaveLength(1);
  });

  it("SC-16: the same target written differently is the same target", async () => {
    const first = await world.create("80.00");
    expect((await world.create("80.0")).alert.id).toBe(first.alert.id);
  });

  it("SC-17: a new Price Alert can be created once the previous one is Triggered", async () => {
    const previous = new PriceAlert(
      newAlertId(),
      USER,
      HEADPHONES,
      TargetPrice.fromDecimalString("80.00", "EUR"),
      AlertStatus.Triggered,
    );
    await world.alerts.add(previous);
    const result = await world.create("80.00");
    expect(result.created).toBe(true);
    expect(result.alert.id).not.toBe(previous.id);
    expect(world.alerts.all()).toHaveLength(2);
  });

  it("SC-18: repeating the creation after the price fell returns the existing Price Alert", async () => {
    const first = await world.create("80.00");
    world.listings.setCurrentPrice(HEADPHONES, eur("75.00"));
    const second = await world.create("80.00");
    expect(second.created).toBe(false);
    expect(second.alert.id).toBe(first.alert.id);
  });
});

describe("order of the checks (contract, decision 3)", () => {
  it("a Listing that does not exist comes before an invalid Target Price", async () => {
    await expect(world.create("0.00", USER, ListingId("nonexistent"))).rejects.toThrow(ListingNotFound);
  });

  it("an invalid Target Price comes before a duplicate", async () => {
    await world.storeActiveAlert("80.00");
    await expect(world.create("0.00")).rejects.toThrow(InvalidTargetPrice);
  });

  it("a duplicate comes before a Target Price already reached", async () => {
    await world.storeActiveAlert("80.00");
    world.listings.setCurrentPrice(HEADPHONES, eur("75.00"));
    await expect(world.create("90.00")).rejects.toThrow(DuplicateAlert);
  });
});

describe("concurrency (contract, decision 4)", () => {
  /** Simulates a concurrent request: the first search finds nothing even though
   * another request has just stored an Active Price Alert. */
  class StaleFirstRead extends InMemoryPriceAlertRepository {
    private searches = 0;

    constructor(private readonly concurrentTarget: string) {
      super();
    }

    override async findActive(owner: UserId, listingId: ListingId) {
      this.searches += 1;
      if (this.searches === 1) {
        await this.add(
          new PriceAlert(
            newAlertId(),
            owner,
            listingId,
            TargetPrice.fromDecimalString(this.concurrentTarget, "EUR"),
            AlertStatus.Active,
          ),
        );
        return null;
      }
      return super.findActive(owner, listingId);
    }
  }

  it("a concurrent request with the same target: the existing Price Alert is returned", async () => {
    const racing = new World(new StaleFirstRead("80.00"));
    const result = await racing.create("80.00");
    expect(result.created).toBe(false);
    expect(racing.alerts.all()).toHaveLength(1);
  });

  it("a concurrent request with another target is a duplicate", async () => {
    const racing = new World(new StaleFirstRead("80.00"));
    await expect(racing.create("70.00")).rejects.toThrow(DuplicateAlert);
    expect(racing.alerts.all()).toHaveLength(1);
  });

  it("two identical requests started together create exactly one Price Alert", async () => {
    const results = await Promise.all([world.create("80.00"), world.create("80.00")]);
    expect(results.map((r) => r.created).sort()).toEqual([false, true]);
    expect(world.alerts.all()).toHaveLength(1);
    expect(results[0].alert.id).toBe(results[1].alert.id);
  });

  it("two requests with different targets started together: one wins, the other is a duplicate", async () => {
    const outcomes = await Promise.allSettled([world.create("80.00"), world.create("70.00")]);
    expect(outcomes.map((o) => o.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(world.alerts.all()).toHaveLength(1);
  });
});

describe("failures that are not business errors (contract: internal errors)", () => {
  // They must reach the caller unchanged, so that the HTTP layer reports a 500 and
  // nobody mistakes a broken catalogue or a broken store for a mistake of the User.

  it("an unsupported currency of the catalogue is an internal error, not an invalid target", async () => {
    world.listings.addListing(KEYBOARD, "XYZ", null);
    const outcome = world.create("80.00", USER, KEYBOARD);
    await expect(outcome).rejects.toThrow(UnsupportedCurrency);
    await expect(outcome).rejects.not.toBeInstanceOf(ApplicationError);
  });

  it("a Current Price in another currency than its Listing is an internal error", async () => {
    world.listings.addListing(KEYBOARD, "EUR", Price.fromDecimalString("50.00", "USD"));
    const outcome = world.create("40.00", USER, KEYBOARD);
    await expect(outcome).rejects.toThrow(CurrencyMismatch);
    await expect(outcome).rejects.not.toBeInstanceOf(ApplicationError);
    expect(world.alerts.all()).toEqual([]);
  });

  it("a failure of the repository is not hidden or turned into a business error", async () => {
    class BrokenStore extends InMemoryPriceAlertRepository {
      override async add(): Promise<void> {
        throw new Error("the store is unavailable");
      }
    }
    const broken = new World(new BrokenStore());
    const outcome = broken.create("80.00");
    await expect(outcome).rejects.toThrow("the store is unavailable");
    await expect(outcome).rejects.not.toBeInstanceOf(ApplicationError);
  });

  it("gives up with an internal error if the uniqueness guarantee keeps failing", async () => {
    /** Claims there is no Active Price Alert yet refuses every insertion: it should never happen. */
    class AlwaysConflicting extends InMemoryPriceAlertRepository {
      attempts = 0;
      override async findActive() {
        return null;
      }
      override async add(): Promise<void> {
        this.attempts += 1;
        throw new ActiveAlertAlreadyExists();
      }
    }
    const conflicting = new AlwaysConflicting();
    const outcome = new World(conflicting).create("80.00");
    await expect(outcome).rejects.toThrow("repeated concurrent conflicts");
    await expect(outcome).rejects.not.toBeInstanceOf(ApplicationError);
    expect(conflicting.attempts).toBe(2); // one retry, as the contract says, and no more
  });
});
