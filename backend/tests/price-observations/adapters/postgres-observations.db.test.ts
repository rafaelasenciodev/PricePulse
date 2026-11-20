import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "../../../src/database/connect";
import { PostgresPriceObservationRepository } from "../../../src/price-observations/adapters";
import { ProviderId } from "../../../src/price-observations/domain";
import { ListingId, ObservedAt } from "../../../src/shared/domain";
import { anObservation } from "../../support/observations";
import { testPool, truncateAll } from "../../support/database";
import { describePriceHistoryContract } from "../history/price-history-contract";
import { describeRepositoryContract } from "./repository-contract";

let pool: Pool;
beforeAll(async () => {
  pool = await testPool();
});
afterAll(async () => {
  await pool.end();
});

const repositoryOver = async () => {
  await truncateAll(pool);
  return new PostgresPriceObservationRepository(pool);
};

describeRepositoryContract("PostgresPriceObservationRepository", repositoryOver);
describePriceHistoryContract("PostgresPriceObservationRepository", repositoryOver);

describe("PostgresPriceObservationRepository: what is specific to this adapter", () => {
  const SIMULATOR = ProviderId("simulator");
  const LISTING = ListingId("headphones-shop-a");

  it("SC-25: the moment comes back to the millisecond", async () => {
    const repository = await repositoryOver();
    const at = ObservedAt.fromIsoString("2026-11-19T10:00:00.123Z");
    await repository.add(anObservation({ observedAt: "2026-11-19T10:00:00.123Z" }));
    expect((await repository.find(SIMULATOR, LISTING, at))?.observedAt.toIsoString()).toBe("2026-11-19T10:00:00.123Z");
  });

  it.each(["0.01", "59.99", "90071992547409.91"])("SC-24: the price %s comes back with the text it was given", async (price) => {
    const repository = await repositoryOver();
    await repository.add(anObservation({ price }));
    expect((await repository.findLatest(LISTING))?.price?.toDecimalString()).toBe(price);
  });

  it("the table refuses an amount without a currency, and the reverse", async () => {
    await repositoryOver();
    await expect(pool.query("INSERT INTO price_observations VALUES ('p', 'l', 1, 100, NULL)")).rejects.toThrow();
    await expect(pool.query("INSERT INTO price_observations VALUES ('p', 'l', 2, NULL, 'EUR')")).rejects.toThrow();
  });

  it("refuses to rebuild a stored observation with a negative price", async () => {
    const repository = await repositoryOver();
    await pool.query("INSERT INTO price_observations VALUES ('simulator', 'headphones-shop-a', 1000, -5, 'EUR')");
    await expect(repository.findLatest(LISTING)).rejects.toThrow();
  });

  it("two equal observations added at the same time leave exactly one", async () => {
    const repository = await repositoryOver();
    const results = await Promise.allSettled([repository.add(anObservation()), repository.add(anObservation())]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
  });
});
