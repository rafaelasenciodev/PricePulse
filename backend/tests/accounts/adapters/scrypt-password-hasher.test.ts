import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCRYPT_PARAMETERS,
  FAST_SCRYPT_PARAMETERS,
  ScryptPasswordHasher,
} from "../../../src/accounts/adapters";
import { describePasswordHasherContract } from "./password-hasher-contract";

// The cost is the lowest possible, so the tests take no time: it checks the logic, not the protection.
describePasswordHasherContract("ScryptPasswordHasher (fast parameters)", () => new ScryptPasswordHasher(FAST_SCRYPT_PARAMETERS));

describe("ScryptPasswordHasher: what is specific to it", () => {
  const fast = new ScryptPasswordHasher(FAST_SCRYPT_PARAMETERS);

  it("ADR-0004: the stored text carries its format, its version, its parameters, a salt and a key", async () => {
    const parts = (await fast.hash("first-password-1")).split("$");
    expect(parts.slice(0, 5)).toEqual(["scrypt", "v1", "16", "8", "1"]);
    expect(Buffer.from(parts[5]!, "base64")).toHaveLength(16);
    expect(Buffer.from(parts[6]!, "base64")).toHaveLength(32);
  });

  it("the parameters of production are 2^16, 8 and 2, about 64 MiB", () => {
    expect(DEFAULT_SCRYPT_PARAMETERS).toEqual({ N: 65536, r: 8, p: 2 });
    expect(128 * DEFAULT_SCRYPT_PARAMETERS.N * DEFAULT_SCRYPT_PARAMETERS.r).toBe(64 * 1024 * 1024);
  });

  it("ADR-0004: a hash is checked with the parameters it carries, not with those of the hasher", async () => {
    const old = await new ScryptPasswordHasher({ N: 2 ** 5, r: 8, p: 1 }).hash("first-password-1");
    expect(await fast.verify("first-password-1", old)).toBe(true);
    expect(await fast.verify("wrong-password-0", old)).toBe(false);
  });

  it("works with the parameters of production", async () => {
    const hasher = new ScryptPasswordHasher();
    const hash = await hasher.hash("first-password-1");
    expect(hash.startsWith("scrypt$v1$65536$8$2$")).toBe(true);
    expect(await hasher.verify("first-password-1", hash)).toBe(true);
    expect(await hasher.verify("wrong-password-0", hash)).toBe(false);
  });

  it("is slower with the parameters of production than with the fast ones, which is the point", async () => {
    const time = async (hasher: ScryptPasswordHasher) => {
      const start = performance.now();
      await hasher.hash("first-password-1");
      return performance.now() - start;
    };
    expect(await time(new ScryptPasswordHasher())).toBeGreaterThan(5 * (await time(fast)));
  });

  describe("a stored text that was tampered with does not match, even with the right password, and does not throw", () => {
    // Made from a real hash, so each change is the only reason it does not match. Node reads r = 0 and p = 0
    // as its defaults, so without the checks of the format those two would match.
    const make = async () => {
      const hash = await fast.hash("first-password-1");
      return hash.split("$");
    };

    it("the real hash matches, so that the cases below fail only because of the change", async () => {
      expect(await fast.verify("first-password-1", (await make()).join("$"))).toBe(true);
    });

    it.each([
      ["another format", (p: string[]) => { p[0] = "bcrypt"; }],
      ["another version", (p: string[]) => { p[1] = "v2"; }],
      ["N that is not a power of two", (p: string[]) => { p[2] = "15"; }],
      ["N that is not a number", (p: string[]) => { p[2] = "abc"; }],
      ["N of zero", (p: string[]) => { p[2] = "0"; }],
      ["N of one", (p: string[]) => { p[2] = "1"; }],
      ["r of zero", (p: string[]) => { p[3] = "0"; }],
      ["r that is not a number", (p: string[]) => { p[3] = "x"; }],
      ["p of zero", (p: string[]) => { p[4] = "0"; }],
      ["p that is not a number", (p: string[]) => { p[4] = "x"; }],
      ["a missing part", (p: string[]) => { p.pop(); }],
      ["an extra part", (p: string[]) => { p.push("extra"); }],
      ["an empty salt", (p: string[]) => { p[5] = ""; }],
      ["an empty key", (p: string[]) => { p[6] = ""; }],
    ])("%s", async (_what, tamper) => {
      const parts = await make();
      tamper(parts);
      expect(await fast.verify("first-password-1", parts.join("$"))).toBe(false);
    });
  });
});
