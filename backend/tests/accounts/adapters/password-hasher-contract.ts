/** The contract of PasswordHasher, as tests that any adapter that really hashes must pass. */

import { describe, expect, it } from "vitest";
import type { PasswordHasher } from "../../../src/accounts/application";

export function describePasswordHasherContract(name: string, create: () => PasswordHasher): void {
  describe(`PasswordHasher: ${name}`, () => {
    it("BR-04: the hash is not the password and does not contain it", async () => {
      const hash = await create().hash("first-password-1");
      expect(hash).not.toBe("first-password-1");
      expect(hash).not.toContain("first-password-1");
    });

    it("SC-07: the right password matches its hash", async () => {
      const hasher = create();
      expect(await hasher.verify("first-password-1", await hasher.hash("first-password-1"))).toBe(true);
    });

    it("SC-09: a wrong password does not match, nor one that differs in a single character", async () => {
      const hasher = create();
      const hash = await hasher.hash("first-password-1");
      expect(await hasher.verify("wrong-password-0", hash)).toBe(false);
      expect(await hasher.verify("first-password-2", hash)).toBe(false);
      expect(await hasher.verify("First-password-1", hash)).toBe(false);
      expect(await hasher.verify("", hash)).toBe(false);
    });

    it("the same password gives a different hash each time, and each one matches", async () => {
      const hasher = create();
      const [first, second] = [await hasher.hash("first-password-1"), await hasher.hash("first-password-1")];
      expect(first).not.toBe(second);
      expect(await hasher.verify("first-password-1", first)).toBe(true);
      expect(await hasher.verify("first-password-1", second)).toBe(true);
    });

    it("a hash of one password does not match the password of another hash", async () => {
      const hasher = create();
      const other = await hasher.hash("second-password-2");
      expect(await hasher.verify("first-password-1", other)).toBe(false);
    });

    it("BR-03: works with any character, not only ASCII", async () => {
      const hasher = create();
      const password = "contraseña-🔑-密码-ñandú";
      const hash = await hasher.hash(password);
      expect(await hasher.verify(password, hash)).toBe(true);
      expect(await hasher.verify("contrasena-🔑-密码-nandu", hash)).toBe(false);
    });

    it.each(["", "garbage", "$$$$$$$", "not-a-hash-at-all-but-long-enough"])(
      "a text that is not a hash, %j, does not match and does not throw",
      async (text) => {
        expect(await create().verify("first-password-1", text)).toBe(false);
      },
    );
  });
}
