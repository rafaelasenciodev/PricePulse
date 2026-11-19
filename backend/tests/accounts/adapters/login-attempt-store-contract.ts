/** The contract of LoginAttemptStore, as tests that any adapter must pass. */

import { beforeEach, describe, expect, it } from "vitest";
import type { LoginAttemptStore } from "../../../src/accounts/application";
import { FailedAttempts } from "../../../src/accounts/domain";

const T0 = Date.parse("2026-11-19T10:00:00Z");

export function describeLoginAttemptStoreContract(name: string, create: () => LoginAttemptStore): void {
  describe(`LoginAttemptStore: ${name}`, () => {
    let store: LoginAttemptStore;
    beforeEach(() => {
      store = create();
    });

    it("an email without failures has none and is not locked", async () => {
      const attempts = await store.get("ana@example.com");
      expect(attempts.count).toBe(0);
      expect(attempts.isLockedAt(T0)).toBe(false);
    });

    it("keeps the count and the lock that were saved", async () => {
      const locked = FailedAttempts.none().afterFailureAt(T0);
      await store.save("ana@example.com", locked);
      expect((await store.get("ana@example.com")).count).toBe(1);

      const five = FailedAttempts.of(5, T0 + 900_000);
      await store.save("ana@example.com", five);
      const kept = await store.get("ana@example.com");
      expect(kept.count).toBe(5);
      expect(kept.lockedUntil).toBe(T0 + 900_000);
    });

    it("SC-12 / BR-06: clearing an email gives it no failures", async () => {
      await store.save("ana@example.com", FailedAttempts.of(4, null));
      await store.clear("ana@example.com");
      expect((await store.get("ana@example.com")).count).toBe(0);
    });

    it("clearing an email that has no failures is not an error", async () => {
      await expect(store.clear("ana@example.com")).resolves.toBeUndefined();
    });

    it("SC-14 / BR-06: the failures of one email are not those of another", async () => {
      await store.save("ana@example.com", FailedAttempts.of(5, T0 + 900_000));
      expect((await store.get("luis@example.com")).count).toBe(0);
      await store.clear("luis@example.com");
      expect((await store.get("ana@example.com")).count).toBe(5);
    });

    it("SC-15: it keeps the failures of any text, an email that nobody registered too", async () => {
      await store.save("not an email", FailedAttempts.of(3, null));
      expect((await store.get("not an email")).count).toBe(3);
    });
  });
}
