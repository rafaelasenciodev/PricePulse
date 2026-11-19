/** The contract of SessionTokens, as tests that any adapter must pass. */

import { describe, expect, it } from "vitest";
import type { SessionTokens } from "../../../src/accounts/application";

export function describeSessionTokensContract(name: string, create: () => SessionTokens): void {
  describe(`SessionTokens: ${name}`, () => {
    it("every token is different", () => {
      const tokens = create();
      const created = new Set(Array.from({ length: 1000 }, () => tokens.create()));
      expect(created.size).toBe(1000);
    });

    it("the same token always has the same hash, and two tokens do not", () => {
      const tokens = create();
      const [a, b] = [tokens.create(), tokens.create()];
      expect(tokens.hash(a)).toBe(tokens.hash(a));
      expect(tokens.hash(a)).not.toBe(tokens.hash(b));
    });

    it("ADR-0004: the hash is not the token and does not contain it", () => {
      const tokens = create();
      const token = tokens.create();
      expect(tokens.hash(token)).not.toBe(token);
      expect(tokens.hash(token)).not.toContain(token);
    });

    it("the hash of a hash is not the hash, so a stored hash is not a token that works", () => {
      const tokens = create();
      const token = tokens.create();
      expect(tokens.hash(tokens.hash(token))).not.toBe(tokens.hash(token));
    });
  });
}
