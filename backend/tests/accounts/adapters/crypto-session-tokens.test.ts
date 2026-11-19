import { describe, expect, it } from "vitest";
import { CryptoSessionTokens, SystemClock } from "../../../src/accounts/adapters";
import { describeSessionTokensContract } from "./session-tokens-contract";

describeSessionTokensContract("CryptoSessionTokens", () => new CryptoSessionTokens());

describe("CryptoSessionTokens: what is specific to it", () => {
  const tokens = new CryptoSessionTokens();

  it("a token is 256 random bits written in base64url, 43 characters that can travel in a header", () => {
    for (let i = 0; i < 50; i++) expect(tokens.create()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("the hash is SHA-256 in hexadecimal", () => {
    expect(tokens.hash("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("SystemClock", () => {
  it("gives the time of the machine", () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});
