/** The contract of SessionStore, as tests that any adapter must pass. */

import { beforeEach, describe, expect, it } from "vitest";
import type { SessionStore } from "../../../src/accounts/application";
import { Session } from "../../../src/accounts/domain";
import { UserId } from "../../../src/shared/domain";

const NOW = Date.parse("2026-11-19T10:00:00Z");
export const sessionOf = (tokenHash: string, user = "user-1") => Session.start(tokenHash, UserId(user), NOW);

export function describeSessionStoreContract(name: string, create: () => SessionStore): void {
  describe(`SessionStore: ${name}`, () => {
    let store: SessionStore;
    beforeEach(() => {
      store = create();
    });

    it("finds a Session by the hash of its token", async () => {
      const session = sessionOf("hash-1");
      await store.add(session);
      expect(await store.findByTokenHash("hash-1")).toEqual(session);
    });

    it("finds nothing for a hash that is not stored", async () => {
      await store.add(sessionOf("hash-1"));
      expect(await store.findByTokenHash("hash-2")).toBeNull();
      expect(await store.findByTokenHash("")).toBeNull();
    });

    it("SC-10 / BR-07: an Account can have several Sessions, each found by its own hash", async () => {
      await store.add(sessionOf("hash-1", "user-1"));
      await store.add(sessionOf("hash-2", "user-1"));
      expect((await store.findByTokenHash("hash-1"))?.tokenHash).toBe("hash-1");
      expect((await store.findByTokenHash("hash-2"))?.tokenHash).toBe("hash-2");
    });

    it("SC-19 / BR-09: deleting a Session leaves the others", async () => {
      await store.add(sessionOf("hash-1"));
      await store.add(sessionOf("hash-2"));
      await store.delete("hash-1");
      expect(await store.findByTokenHash("hash-1")).toBeNull();
      expect(await store.findByTokenHash("hash-2")).not.toBeNull();
    });

    it("deleting a Session that is not stored is not an error", async () => {
      await expect(store.delete("hash-1")).resolves.toBeUndefined();
    });

    it("keeps the expiry of the Session as it was stored", async () => {
      const session = sessionOf("hash-1");
      await store.add(session);
      const found = await store.findByTokenHash("hash-1");
      expect(found?.expiresAt).toBe(session.expiresAt);
      expect(found?.userId).toBe(session.userId);
    });
  });
}
