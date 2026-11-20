import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresAccountRepository, PostgresSessionStore } from "../../../src/accounts/adapters";
import { Session } from "../../../src/accounts/domain";
import type { Pool } from "../../../src/database/connect";
import { UserId } from "../../../src/shared/domain";
import { testPool, truncateAll } from "../../support/database";
import { describeAccountRepositoryContract } from "./account-repository-contract";
import { describeSessionStoreContract, sessionOf } from "./session-store-contract";

let pool: Pool;
beforeAll(async () => {
  pool = await testPool();
});
afterAll(async () => {
  await pool.end();
});

describeAccountRepositoryContract("PostgresAccountRepository", async () => {
  await truncateAll(pool);
  return new PostgresAccountRepository(pool);
});

describeSessionStoreContract("PostgresSessionStore", async () => {
  await truncateAll(pool);
  return new PostgresSessionStore(pool);
});

describe("PostgresSessionStore: what is specific to this adapter", () => {
  it("refuses a stored Session whose expiry is not after its creation, instead of rebuilding it", async () => {
    await truncateAll(pool);
    await pool.query("INSERT INTO sessions VALUES ('bad', 'user-1', 2000, 1000)");
    await expect(new PostgresSessionStore(pool).findByTokenHash("bad")).rejects.toThrow(RangeError);
  });

  it("refuses an integer that is not safe instead of changing it in silence", async () => {
    await truncateAll(pool);
    await pool.query("INSERT INTO sessions VALUES ('huge', 'user-1', 1000, 9007199254740993)");
    await expect(new PostgresSessionStore(pool).findByTokenHash("huge")).rejects.toThrow("not a safe integer");
  });

  it("two Sessions added at the same time are both stored", async () => {
    await truncateAll(pool);
    const store = new PostgresSessionStore(pool);
    await Promise.all([store.add(sessionOf("hash-1")), store.add(Session.start("hash-2", UserId("user-2"), Date.parse("2026-11-19T10:00:00Z")))]);
    expect(await store.findByTokenHash("hash-1")).not.toBeNull();
    expect(await store.findByTokenHash("hash-2")).not.toBeNull();
  });
});
