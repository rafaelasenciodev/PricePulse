import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryListingReader, InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import {
  AlertConflict,
  AlertNotActive,
  AlertNotFound,
  ApplicationError,
  InvalidTargetPrice,
  ModifyTargetPrice,
  TargetAlreadyReached,
  type ListingReader,
  type PriceAlertRepository,
} from "../../../src/price-alerts/application";
import { AlertId, AlertStatus, CurrencyMismatch, PriceAlert, UserId } from "../../../src/price-alerts/domain";
import { ListingId, Price, UnsupportedCurrency } from "../../../src/shared/domain";
import { anAlert } from "../../support/alerts";

const USER = UserId("user-1");
const LISTING = ListingId("headphones-shop-a");
const eur = (amount: string) => Price.fromDecimalString(amount, "EUR");

let alerts: InMemoryPriceAlertRepository;
let listings: InMemoryListingReader;

const modify = (alertId: AlertId, targetAmount: string, owner: UserId = USER, repository: PriceAlertRepository = alerts, reader: ListingReader = listings) =>
  new ModifyTargetPrice(repository, reader).execute({ owner, alertId, targetAmount });

const stored = (alert: PriceAlert) => alerts.all().find((a) => a.id === alert.id) as PriceAlert;

/** An Active alert of the User with a Target Price of 80.00, while the Current Price is 100.00. */
async function givenActiveAlert() {
  const alert = anAlert({ owner: "user-1", listing: LISTING, target: "80.00" });
  await alerts.add(alert);
  return alert;
}

beforeEach(() => {
  alerts = new InMemoryPriceAlertRepository();
  listings = new InMemoryListingReader();
  listings.addListing(LISTING, "EUR", eur("100.00"));
});

describe("modifying the Target Price of an Active Price Alert", () => {
  it("SC-14 / BR-05: gives it the new Target Price and leaves it Active", async () => {
    const alert = await givenActiveAlert();

    const result = await modify(alert.id, "70.00");

    expect(result.changed).toBe(true);
    expect(result.alert).toMatchObject({ id: alert.id, targetAmount: "70.00", currency: "EUR", status: "active" });
    expect(stored(alert).targetPrice.toDecimalString()).toBe("70.00");
    expect(stored(alert).isActive).toBe(true);
  });

  it("SC-14 / BR-06 / BR-09: its owner, its Listing and its creation moment do not change", async () => {
    const alert = anAlert({ owner: "user-1", listing: LISTING, target: "80.00", createdAt: "2026-11-19T10:00:00Z" });
    await alerts.add(alert);

    const result = await modify(alert.id, "70.00");

    expect(result.alert.createdAt).toBe("2026-11-19T10:00:00.000Z");
    expect(result.alert.listingId).toBe(LISTING);
    expect(stored(alert).owner).toBe(USER);
    expect(stored(alert).createdAt.toIsoString()).toBe("2026-11-19T10:00:00.000Z");
  });

  it("modifies the one that was asked for, and no other of the same User", async () => {
    const first = await givenActiveAlert();
    const second = anAlert({ owner: "user-1", listing: "keyboard-shop-b", target: "45.00" });
    await alerts.add(second);
    listings.addListing(ListingId("keyboard-shop-b"), "EUR", eur("60.00"));

    await modify(second.id, "40.00");

    expect(stored(first).targetPrice.toDecimalString()).toBe("80.00");
    expect(stored(second).targetPrice.toDecimalString()).toBe("40.00");
  });

  it("the Target Price is in the currency of the Listing, whatever it is", async () => {
    const keyboard = ListingId("keyboard-shop-b");
    listings.addListing(keyboard, "USD", Price.fromDecimalString("60.00", "USD"));
    const alert = anAlert({ owner: "user-1", listing: "keyboard-shop-b", target: "45.00", currency: "USD" });
    await alerts.add(alert);

    const result = await modify(alert.id, "40.00");

    expect(result.alert).toMatchObject({ targetAmount: "40.00", currency: "USD" });
    expect(stored(alert).targetPrice.currency).toBe("USD");
  });

  it("SC-19 / BR-05: a Listing without a Current Price allows any valid Target Price", async () => {
    const alert = await givenActiveAlert();
    listings.addListing(LISTING, "EUR");
    const result = await modify(alert.id, "90.00");
    expect(result.alert.targetAmount).toBe("90.00");
  });
});

describe("a Target Price that is not valid", () => {
  it.each([
    ["0.00", "zero"],
    ["-5.00", "negative"],
    ["79.999", "with more decimals than EUR allows"],
    ["abc", "not a number"],
  ])("SC-15 / BR-05: %s (%s) is rejected and the Target Price stays", async (amount) => {
    const alert = await givenActiveAlert();
    await expect(modify(alert.id, amount)).rejects.toThrow(InvalidTargetPrice);
    expect(stored(alert).targetPrice.toDecimalString()).toBe("80.00");
  });

  it("SC-16 / BR-05: a Target Price that the Current Price already reaches is rejected", async () => {
    const alert = await givenActiveAlert();
    await expect(modify(alert.id, "100.00")).rejects.toThrow(TargetAlreadyReached);
    expect(stored(alert).targetPrice.toDecimalString()).toBe("80.00");
  });

  it("SC-16 / BR-05: one cent below the Current Price is accepted", async () => {
    const alert = await givenActiveAlert();
    await expect(modify(alert.id, "99.99")).resolves.toMatchObject({ changed: true });
  });
});

describe("only an Active Price Alert can be modified", () => {
  it.each([[AlertStatus.Triggered], [AlertStatus.Cancelled]])(
    "SC-17 / BR-05: a %s alert is rejected as not Active and keeps its Target Price",
    async (status) => {
      const alert = anAlert({ owner: "user-1", listing: LISTING, target: "80.00", status });
      await alerts.add(alert);

      const outcome = await modify(alert.id, "70.00").catch((error: unknown) => error);

      expect(outcome).toBeInstanceOf(AlertNotActive);
      expect((outcome as AlertNotActive).status).toBe(status);
      expect(stored(alert).targetPrice.toDecimalString()).toBe("80.00");
    },
  );

  it("the state is checked before the amount: a Cancelled alert is not Active whatever is asked", async () => {
    const alert = anAlert({ owner: "user-1", listing: LISTING, status: AlertStatus.Cancelled });
    await alerts.add(alert);
    await expect(modify(alert.id, "not a number")).rejects.toThrow(AlertNotActive);
  });
});

describe("the same Target Price", () => {
  it("SC-18 / BR-06: succeeds and changes nothing", async () => {
    const alert = await givenActiveAlert();
    const result = await modify(alert.id, "80.00");
    expect(result.changed).toBe(false);
    expect(result.alert.targetAmount).toBe("80.00");
    expect(stored(alert).targetPrice.toDecimalString()).toBe("80.00");
  });

  it("SC-18 / BR-06: it is read as the same number written another way: 80 and 80.000 are 80.00", async () => {
    const alert = await givenActiveAlert();
    expect((await modify(alert.id, "80")).changed).toBe(false);
    expect((await modify(alert.id, "80.000")).changed).toBe(false);
  });

  it("SC-18 / BR-06: it succeeds even if the Current Price now reaches it, as a repeated creation does", async () => {
    const alert = await givenActiveAlert();
    listings.addListing(LISTING, "EUR", eur("75.00"));
    const result = await modify(alert.id, "80.00");
    expect(result.changed).toBe(false);
  });
});

describe("whose alert it is (BR-01)", () => {
  it("SC-06: an alert of another User is not found, and nothing is changed", async () => {
    const theirs = anAlert({ owner: "user-2", listing: LISTING, target: "80.00" });
    await alerts.add(theirs);
    await expect(modify(theirs.id, "70.00", USER)).rejects.toThrow(AlertNotFound);
    expect(stored(theirs).targetPrice.toDecimalString()).toBe("80.00");
  });

  it("SC-06: an alert that does not exist is not found", async () => {
    await expect(modify(AlertId("no-such-alert"), "70.00")).rejects.toThrow(AlertNotFound);
  });
});

describe("when the alert changes while the User acts (BR-08)", () => {
  /** An Evaluation Triggers the alert between the moment the request reads it and the moment it saves it. */
  class TriggeredBeforeSave extends InMemoryPriceAlertRepository {
    override async save(alert: PriceAlert, expectedStatus: AlertStatus): Promise<void> {
      const storedAlert = this.all().find((a) => a.id === alert.id) as PriceAlert;
      await super.save(storedAlert.trigger(), AlertStatus.Active);
      return super.save(alert, expectedStatus);
    }
  }

  it("SC-20: it is rejected as a Conflict, and the alert stays Triggered with its Target Price", async () => {
    const racing = new TriggeredBeforeSave();
    const alert = anAlert({ owner: "user-1", listing: LISTING, target: "80.00" });
    await racing.add(alert);

    await expect(modify(alert.id, "70.00", USER, racing)).rejects.toThrow(AlertConflict);

    const [kept] = racing.all();
    expect(kept?.status).toBe(AlertStatus.Triggered);
    expect(kept?.targetPrice.toDecimalString()).toBe("80.00");
  });
});

describe("what the use case does and does not do (BR-07)", () => {
  it("SC-13 / BR-07: only reads the alert and the Listing and saves the alert once: it has no way to notify or evaluate", async () => {
    const alert = await givenActiveAlert();
    const calls: string[] = [];
    const spyAlerts = Object.create(alerts, {
      find: { value: async (...args: Parameters<typeof alerts.find>) => (calls.push("find"), alerts.find(...args)) },
      save: { value: async (...args: Parameters<typeof alerts.save>) => (calls.push("save"), alerts.save(...args)) },
    }) as PriceAlertRepository;

    await modify(alert.id, "70.00", USER, spyAlerts);

    expect(calls).toEqual(["find", "save"]);
  });
});

describe("inconsistent data is an internal error, not a mistake of the User", () => {
  it("an alert whose Listing no longer exists", async () => {
    const alert = anAlert({ owner: "user-1", listing: "gone", target: "80.00" });
    await alerts.add(alert);
    const outcome = await modify(alert.id, "70.00").catch((error: unknown) => error);
    expect(outcome).toBeInstanceOf(Error);
    expect(outcome).not.toBeInstanceOf(ApplicationError);
  });

  it("a Listing priced in a currency the system does not support is not an invalid Target Price", async () => {
    listings.addListing(LISTING, "XYZ");
    const alert = await givenActiveAlert();
    const outcome = await modify(alert.id, "70.00").catch((error: unknown) => error);
    expect(outcome).toBeInstanceOf(UnsupportedCurrency);
    expect(outcome).not.toBeInstanceOf(InvalidTargetPrice);
  });

  it("a failure of the store is not hidden or turned into a business error", async () => {
    class Down extends InMemoryPriceAlertRepository {
      override async save(): Promise<void> {
        throw new Error("the store is down");
      }
    }
    const down = new Down();
    const alert = anAlert({ owner: "user-1", listing: LISTING, target: "80.00" });
    await down.add(alert);

    const outcome = await modify(alert.id, "70.00", USER, down).catch((error: unknown) => error);

    expect((outcome as Error).message).toBe("the store is down");
    expect(outcome).not.toBeInstanceOf(ApplicationError);
  });

  it("an alert whose Target Price is in another currency than its Listing", async () => {
    const alert = anAlert({ owner: "user-1", listing: LISTING, target: "80.00", currency: "USD" });
    await alerts.add(alert);
    const outcome = await modify(alert.id, "70.00").catch((error: unknown) => error);
    expect(outcome).toBeInstanceOf(CurrencyMismatch);
    expect(outcome).not.toBeInstanceOf(ApplicationError);
  });
});
