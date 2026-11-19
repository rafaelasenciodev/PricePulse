import { describe, expect, it } from "vitest";
import {
  DEFAULT_ATTEMPT_CAPACITY,
  InMemoryAccountRepository,
  InMemoryLoginAttemptStore,
  InMemorySessionStore,
} from "../../../src/accounts/adapters";
import { FailedAttempts } from "../../../src/accounts/domain";
import { accountOf, describeAccountRepositoryContract } from "./account-repository-contract";
import { describeLoginAttemptStoreContract, oneMore, peek } from "./login-attempt-store-contract";
import { describeSessionStoreContract, sessionOf } from "./session-store-contract";

describeAccountRepositoryContract("InMemoryAccountRepository", () => new InMemoryAccountRepository());
describeSessionStoreContract("InMemorySessionStore", () => new InMemorySessionStore());
describeLoginAttemptStoreContract("InMemoryLoginAttemptStore", () => new InMemoryLoginAttemptStore());

describe("the in-memory stores: what is specific to them", () => {
  it("all() lists what is stored and cannot be used to change the store", async () => {
    const accounts = new InMemoryAccountRepository();
    await accounts.add(accountOf("ana@example.com"));
    accounts.all().pop();
    expect(accounts.all()).toHaveLength(1);

    const sessions = new InMemorySessionStore();
    await sessions.add(sessionOf("hash-1"));
    sessions.all().pop();
    expect(sessions.all()).toHaveLength(1);
  });

  describe("InMemoryLoginAttemptStore: the cap in size", () => {
    const failing = () => FailedAttempts.of(1, null);

    it("remembers at most its capacity, and drops the email that was written longest ago", async () => {
      const store = new InMemoryLoginAttemptStore(3);
      for (const email of ["a", "b", "c", "d"]) await store.update(email, failing);
      expect(store.size()).toBe(3);
      expect((await peek(store, "a")).count).toBe(0);
      expect((await peek(store, "b")).count).toBe(1);
      expect((await peek(store, "d")).count).toBe(1);
    });

    it("an email that is attempted again counts as the newest, so it is not the one dropped", async () => {
      const store = new InMemoryLoginAttemptStore(3);
      for (const email of ["a", "b", "c"]) await store.update(email, failing);
      await store.update("a", oneMore);
      await store.update("d", failing);
      expect((await peek(store, "a")).count).toBe(2);
      expect((await peek(store, "b")).count).toBe(0);
    });

    it("a state with no attempts takes no room, so looking at an email does not push another out", async () => {
      const store = new InMemoryLoginAttemptStore(2);
      await store.update("a", failing);
      await store.update("b", failing);
      for (let i = 0; i < 20; i++) await peek(store, `nobody-${i}`);
      expect(store.size()).toBe(2);
      await store.update("a", () => FailedAttempts.none());
      expect(store.size()).toBe(1);
    });

    it("changing an email that is already there does not make it grow", async () => {
      const store = new InMemoryLoginAttemptStore(2);
      for (let i = 0; i < 10; i++) await store.update("a", oneMore);
      expect(store.size()).toBe(1);
    });

    it("thousands of different emails cannot make it grow beyond its capacity", async () => {
      const store = new InMemoryLoginAttemptStore(100);
      for (let i = 0; i < 5000; i++) await store.update(`email-${i}`, failing);
      expect(store.size()).toBe(100);
    });

    it("has a capacity by default, and refuses one that is not a positive whole number", () => {
      expect(DEFAULT_ATTEMPT_CAPACITY).toBe(10_000);
      expect(() => new InMemoryLoginAttemptStore(0)).toThrow(RangeError);
      expect(() => new InMemoryLoginAttemptStore(1.5)).toThrow(RangeError);
    });
  });
});
