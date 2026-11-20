import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "../../../src/database/connect";
import { PostgresNotificationRepository, PostgresPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { AlertStatus, newAlertId } from "../../../src/price-alerts/domain";
import { UserId } from "../../../src/shared/domain";
import { testPool, truncateAll } from "../../support/database";
import { anAlert } from "../../support/alerts";
import { aNotification } from "../../support/notifications";
import { describeAlertRepositoryEvaluationContract } from "../evaluation/alert-repository-contract";
import { describeNotificationRepositoryContract } from "../evaluation/notification-repository-contract";
import { describeAlertRepositoryReadsContract } from "../management/alert-repository-reads-contract";
import { describeNotificationRepositoryReadsContract } from "../notifications/notification-repository-reads-contract";
import { describeAlertRepositoryBaseContract } from "./alert-repository-contract";

let pool: Pool;
beforeAll(async () => {
  pool = await testPool();
});
afterAll(async () => {
  await pool.end();
});

const alerts = async () => {
  await truncateAll(pool);
  return new PostgresPriceAlertRepository(pool);
};
const notifications = async () => {
  await truncateAll(pool);
  return new PostgresNotificationRepository(pool);
};

describeAlertRepositoryBaseContract("PostgresPriceAlertRepository", alerts);
describeAlertRepositoryEvaluationContract("PostgresPriceAlertRepository", alerts);
describeAlertRepositoryReadsContract("PostgresPriceAlertRepository", alerts);
describeNotificationRepositoryContract("PostgresNotificationRepository", notifications);
describeNotificationRepositoryReadsContract("PostgresNotificationRepository", notifications);

describe("PostgresPriceAlertRepository: what is specific to this adapter", () => {
  it.each(["0.01", "80.00", "90071992547409.91"])("SC-24: the Target Price %s comes back with the text it was given", async (amount) => {
    const repository = await alerts();
    const alert = anAlert({ target: amount });
    await repository.add(alert);
    expect((await repository.find(alert.owner, alert.id))?.targetPrice.toDecimalString()).toBe(amount);
  });

  it("a change of the Target Price is stored and the rest of the alert stays", async () => {
    const repository = await alerts();
    const alert = anAlert({ target: "80.00", createdAt: "2026-11-19T10:00:00.123Z" });
    await repository.add(alert);
    await repository.save(alert.changeTargetPrice(anAlert({ target: "70.00" }).targetPrice, null), AlertStatus.Active);
    const stored = await repository.find(alert.owner, alert.id);
    expect(stored?.targetPrice.toDecimalString()).toBe("70.00");
    expect(stored?.createdAt.toIsoString()).toBe("2026-11-19T10:00:00.123Z");
    expect(stored?.status).toBe(AlertStatus.Active);
  });

  it("refuses to rebuild a row with a status that is not known", async () => {
    const repository = await alerts();
    // The CHECK of the table forbids it, so it is lifted for this one test of the defence.
    await pool.query("ALTER TABLE price_alerts DROP CONSTRAINT price_alerts_status_known");
    try {
      await pool.query("INSERT INTO price_alerts VALUES ('a-1', 'user-1', 'l-1', 8000, 'EUR', 'weird', 1000)");
      await expect(repository.find(UserId("user-1"), "a-1" as never)).rejects.toThrow("unknown status");
    } finally {
      await pool.query("DELETE FROM price_alerts");
      await pool.query("ALTER TABLE price_alerts ADD CONSTRAINT price_alerts_status_known CHECK (status IN ('active', 'triggered', 'cancelled'))");
    }
  });

  it("the table itself refuses a target that is not positive and a status that is not known", async () => {
    await alerts();
    await expect(pool.query("INSERT INTO price_alerts VALUES ('a-1', 'u', 'l', 0, 'EUR', 'active', 1)")).rejects.toThrow();
    await expect(pool.query("INSERT INTO price_alerts VALUES ('a-2', 'u', 'l', 100, 'EUR', 'weird', 1)")).rejects.toThrow();
  });

  it("two cancellations at the same time both succeed, and the alert is Cancelled", async () => {
    const repository = await alerts();
    const alert = anAlert();
    await repository.add(alert);
    await Promise.all([repository.save(alert.cancel(), AlertStatus.Active), repository.save(alert.cancel(), AlertStatus.Active)]);
    expect((await repository.find(alert.owner, alert.id))?.status).toBe(AlertStatus.Cancelled);
  });
});

describe("PostgresNotificationRepository: what is specific to this adapter", () => {
  it.each(["0.01", "75.00", "90071992547409.91"])("SC-24: the prices %s of a Notification come back with the text they were given", async (amount) => {
    const repository = await notifications();
    const notification = aNotification({ target: amount, price: amount });
    await repository.add(notification);
    const found = await repository.findByAlert(notification.alertId);
    expect(found?.targetPrice.toDecimalString()).toBe(amount);
    expect(found?.currentPrice.toDecimalString()).toBe(amount);
  });

  it("SC-25: the moment comes back to the millisecond", async () => {
    const repository = await notifications();
    const notification = aNotification({ observedAt: "2026-11-19T10:00:00.123Z" });
    await repository.add(notification);
    expect((await repository.findByAlert(notification.alertId))?.observedAt.toIsoString()).toBe("2026-11-19T10:00:00.123Z");
  });

  it("refuses to rebuild a stored Notification whose Current Price does not reach its Target Price", async () => {
    const repository = await notifications();
    const id = newAlertId();
    await pool.query("INSERT INTO notifications VALUES ($1, 'user-1', 'l-1', 'EUR', 8000, 9000, 1000)", [id]);
    await expect(repository.findByAlert(id)).rejects.toThrow("does not reach");
  });
});
