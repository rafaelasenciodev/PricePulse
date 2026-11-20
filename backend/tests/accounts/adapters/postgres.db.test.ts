import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_ATTEMPT_CAPACITY, PostgresAccountRepository, PostgresLoginAttemptStore, PostgresSessionStore } from "../../../src/accounts/adapters";
import { FailedAttempts, Session } from "../../../src/accounts/domain";
import type { Pool } from "../../../src/database/connect";
import { UserId } from "../../../src/shared/domain";
import { testPool, truncateAll } from "../../support/database";
import { describeAccountRepositoryContract } from "./account-repository-contract";
import { describeLoginAttemptStoreContract, oneMore, peek } from "./login-attempt-store-contract";
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

describeLoginAttemptStoreContract("PostgresLoginAttemptStore", async () => {
  await truncateAll(pool);
  return new PostgresLoginAttemptStore(pool);
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

describe("PostgresLoginAttemptStore: the cap in size", () => {
  const failing = () => FailedAttempts.of(1, null);
  const rows = async () => Number((await pool.query("SELECT count(*) AS n FROM login_attempts")).rows[0].n);

  it("remembers at most its capacity, and drops the email that was written longest ago", async () => {
    await truncateAll(pool);
    const store = new PostgresLoginAttemptStore(pool, 3);
    for (const email of ["a", "b", "c", "d"]) await store.update(email, failing);
    expect(await rows()).toBe(3);
    expect((await peek(store, "a")).count).toBe(0);
    expect((await peek(store, "b")).count).toBe(1);
    expect((await peek(store, "d")).count).toBe(1);
  });

  it("an email that is attempted again counts as the newest, so it is not the one dropped", async () => {
    await truncateAll(pool);
    const store = new PostgresLoginAttemptStore(pool, 3);
    for (const email of ["a", "b", "c"]) await store.update(email, failing);
    await store.update("a", oneMore);
    await store.update("d", failing);
    expect((await peek(store, "a")).count).toBe(2);
    expect((await peek(store, "b")).count).toBe(0);
  });

  it("a state with no attempts takes no row, so looking at an email does not push another out", async () => {
    await truncateAll(pool);
    const store = new PostgresLoginAttemptStore(pool, 2);
    await store.update("a", failing);
    await store.update("b", failing);
    for (let i = 0; i < 20; i++) await peek(store, `nobody-${i}`);
    expect(await rows()).toBe(2);
    await store.update("a", () => FailedAttempts.none());
    expect(await rows()).toBe(1);
  });

  it("many different emails at the same time cannot make it grow beyond its capacity", async () => {
    await truncateAll(pool);
    const store = new PostgresLoginAttemptStore(pool, 20);
    await Promise.all(Array.from({ length: 200 }, (_, i) => store.update(`email-${i}`, failing)));
    expect(await rows()).toBeLessThanOrEqual(20);
    expect(await rows()).toBeGreaterThan(0);
  });

  it("attempts at the same time on an email that ends with no attempts do not fail", async () => {
    await truncateAll(pool);
    const store = new PostgresLoginAttemptStore(pool);
    await Promise.all(Array.from({ length: 30 }, () => store.update("a", () => FailedAttempts.none())));
    expect(await rows()).toBe(0);
  });

  it("has a capacity by default, and refuses one that is not a positive whole number", () => {
    expect(DEFAULT_ATTEMPT_CAPACITY).toBe(10_000);
    expect(() => new PostgresLoginAttemptStore(pool, 0)).toThrow(RangeError);
    expect(() => new PostgresLoginAttemptStore(pool, 1.5)).toThrow(RangeError);
  });
});
