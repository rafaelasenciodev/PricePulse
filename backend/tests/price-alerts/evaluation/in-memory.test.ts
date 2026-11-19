import { describe, expect, it } from "vitest";
import {
  InMemoryCurrentPriceSource,
  InMemoryNotificationRepository,
  InMemoryPriceAlertRepository,
} from "../../../src/price-alerts/adapters";
import { AlertStatus, PriceAlert, TargetPrice, UserId, newAlertId } from "../../../src/price-alerts/domain";
import { ListingId, ObservedAt, Price } from "../../../src/shared/domain";
import { describeAlertRepositoryEvaluationContract } from "./alert-repository-contract";
import { describeNotificationRepositoryContract, notificationOf, reachedAlert } from "./notification-repository-contract";
import { CREATED_AT } from "../../support/created-at";

describeNotificationRepositoryContract("InMemoryNotificationRepository", () => new InMemoryNotificationRepository());
describeAlertRepositoryEvaluationContract("InMemoryPriceAlertRepository", () => new InMemoryPriceAlertRepository());

describe("InMemoryNotificationRepository: what is specific to this adapter", () => {
  it("all() lists every stored Notification and cannot be used to change the store", async () => {
    const repository = new InMemoryNotificationRepository();
    const alert = reachedAlert();
    await repository.add(notificationOf(alert));
    const listed = repository.all();
    expect(listed).toHaveLength(1);
    listed.pop();
    expect(repository.all()).toHaveLength(1);
  });
});

describe("InMemoryPriceAlertRepository: the conditional save", () => {
  const alertOf = () =>
    new PriceAlert(newAlertId(), UserId("user-1"), ListingId("headphones-shop-a"), TargetPrice.fromDecimalString("80.00", "EUR"), AlertStatus.Active, CREATED_AT);

  it("a refused save leaves the stored alert as it was", async () => {
    const repository = new InMemoryPriceAlertRepository();
    const alert = alertOf();
    await repository.add(alert);
    await repository.save(alert.cancel(), AlertStatus.Active);
    await repository.save(alert.trigger(), AlertStatus.Active).catch(() => undefined);
    expect(repository.all().map((a) => a.status)).toEqual([AlertStatus.Cancelled]);
  });

  it("a change of the Target Price replaces the alert and keeps the rest", async () => {
    const repository = new InMemoryPriceAlertRepository();
    const alert = alertOf();
    await repository.add(alert);
    await repository.save(alert.changeTargetPrice(TargetPrice.fromDecimalString("70.00", "EUR"), null), AlertStatus.Active);
    const [stored] = repository.all();
    expect(repository.all()).toHaveLength(1);
    expect(stored?.targetPrice.toDecimalString()).toBe("70.00");
    expect(stored?.status).toBe(AlertStatus.Active);
    expect(stored?.createdAt.equals(CREATED_AT)).toBe(true);
  });
});

describe("InMemoryPriceAlertRepository: what is specific to this adapter", () => {
  it("save replaces the stored alert and keeps its data: only the state changes", async () => {
    const repository = new InMemoryPriceAlertRepository();
    const alert = new PriceAlert(newAlertId(), UserId("user-1"), ListingId("headphones-shop-a"), TargetPrice.fromDecimalString("80.00", "EUR"), AlertStatus.Active, CREATED_AT);
    await repository.add(alert);
    await repository.save(alert.trigger(), AlertStatus.Active);
    const [kept] = repository.all();
    expect(repository.all()).toHaveLength(1);
    expect(kept?.status).toBe(AlertStatus.Triggered);
    expect(kept?.id).toBe(alert.id);
    expect(kept?.owner).toBe(alert.owner);
    expect(kept?.targetPrice.equals(alert.targetPrice)).toBe(true);
  });
});

describe("InMemoryCurrentPriceSource (contract of CurrentPriceSource)", () => {
  const LISTING = ListingId("headphones-shop-a");
  const current = (amount: string) => ({
    price: Price.fromDecimalString(amount, "EUR"),
    observedAt: ObservedAt.fromIsoString("2026-11-19T10:00:00Z"),
  });

  it("BR-03: a Listing that was never given a price has no Current Price", async () => {
    expect(await new InMemoryCurrentPriceSource().currentPriceOf(LISTING)).toBeNull();
  });

  it("returns the Price and the Observed At together", async () => {
    const source = new InMemoryCurrentPriceSource();
    source.set(LISTING, current("79.90"));
    const found = await source.currentPriceOf(LISTING);
    expect(found?.price.toDecimalString()).toBe("79.90");
    expect(found?.observedAt.toIsoString()).toBe("2026-11-19T10:00:00.000Z");
  });

  it("answers only for the Listing asked for", async () => {
    const source = new InMemoryCurrentPriceSource();
    source.set(LISTING, current("79.90"));
    expect(await source.currentPriceOf(ListingId("keyboard-shop-b"))).toBeNull();
  });

  it("giving the Listing none removes its Current Price: it is unavailable", async () => {
    const source = new InMemoryCurrentPriceSource();
    source.set(LISTING, current("79.90"));
    source.set(LISTING, null);
    expect(await source.currentPriceOf(LISTING)).toBeNull();
  });
});
