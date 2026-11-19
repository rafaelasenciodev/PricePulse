/** The contract of LoginAttemptStore, as tests that any adapter must pass. */

import { beforeEach, describe, expect, it } from "vitest";
import type { LoginAttemptStore } from "../../../src/accounts/application";
import { FailedAttempts } from "../../../src/accounts/domain";

const T0 = Date.parse("2026-11-19T10:00:00Z");

/** One attempt more, with no lock: the simplest change, and one that depends on the state it is given. */
export const oneMore = (current: FailedAttempts) => FailedAttempts.of(current.count + 1, null);

/** The state of an email, without changing it. */
export async function peek(store: LoginAttemptStore, email: string): Promise<FailedAttempts> {
  return (await store.update(email, (current) => current)).before;
}

export function describeLoginAttemptStoreContract(name: string, create: () => LoginAttemptStore): void {
  describe(`LoginAttemptStore: ${name}`, () => {
    let store: LoginAttemptStore;
    beforeEach(() => {
      store = create();
    });

    it("an email without attempts has none and is not locked", async () => {
      const attempts = await peek(store, "ana@example.com");
      expect(attempts.count).toBe(0);
      expect(attempts.isLockedAt(T0)).toBe(false);
    });

    it("gives the state before and the state after the change", async () => {
      const { before, after } = await store.update("ana@example.com", oneMore);
      expect(before.count).toBe(0);
      expect(after.count).toBe(1);
    });

    it("the change is made on the current state, so successive attempts add up", async () => {
      const counts: number[][] = [];
      for (let i = 0; i < 3; i++) {
        const { before, after } = await store.update("ana@example.com", oneMore);
        counts.push([before.count, after.count]);
      }
      expect(counts).toEqual([[0, 1], [1, 2], [2, 3]]);
      expect((await peek(store, "ana@example.com")).count).toBe(3);
    });

    it("keeps the count and the lock that the change made", async () => {
      await store.update("ana@example.com", () => FailedAttempts.of(5, T0 + 900_000));
      const kept = await peek(store, "ana@example.com");
      expect(kept.count).toBe(5);
      expect(kept.lockedUntil).toBe(T0 + 900_000);
    });

    it("SC-25 / BR-06: attempts at the same time are atomic: each sees what the previous one left, and none is lost", async () => {
      const changes = await Promise.all(Array.from({ length: 50 }, () => store.update("ana@example.com", oneMore)));
      expect(changes.map((c) => c.before.count).sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i));
      expect((await peek(store, "ana@example.com")).count).toBe(50);
    });

    it("SC-12 / BR-06: clearing an email gives it no attempts", async () => {
      await store.update("ana@example.com", () => FailedAttempts.of(4, null));
      await store.clear("ana@example.com");
      expect((await peek(store, "ana@example.com")).count).toBe(0);
    });

    it("clearing an email that has no attempts is not an error", async () => {
      await expect(store.clear("ana@example.com")).resolves.toBeUndefined();
    });

    it("SC-14 / BR-06: the attempts of one email are not those of another", async () => {
      await store.update("ana@example.com", () => FailedAttempts.of(5, T0 + 900_000));
      expect((await peek(store, "luis@example.com")).count).toBe(0);
      await store.clear("luis@example.com");
      expect((await peek(store, "ana@example.com")).count).toBe(5);
    });

    it("SC-15: it keeps the attempts of any text, an email that nobody registered too", async () => {
      await store.update("not an email", () => FailedAttempts.of(3, null));
      expect((await peek(store, "not an email")).count).toBe(3);
    });
  });
}
