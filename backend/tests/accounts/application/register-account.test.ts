/** Application tests of UC-01 Register. Each test names the scenario or the rule it verifies. */

import { describe, expect, it } from "vitest";
import { InMemoryAccountRepository } from "../../../src/accounts/adapters";
import type { Email } from "../../../src/accounts/domain";
import { ApplicationError, EmailAlreadyRegistered, InvalidRegistration } from "../../../src/accounts/application";
import { buildWorld, registered } from "../support/world";

/** A repository whose lookup by email misses once, as it does when another registration is still to come. */
class BlindOnce extends InMemoryAccountRepository {
  blind = false;
  override async findByEmail(email: Email) {
    if (this.blind) {
      this.blind = false;
      return null;
    }
    return super.findByEmail(email);
  }
}

describe("RegisterAccount", () => {
  it("SC-01 / BR-01: creates the Account and answers with its identifier and its email", async () => {
    const world = buildWorld();
    const view = await registered(world);
    expect(view.email).toBe("ana@example.com");
    expect(view.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.keys(view).sort()).toEqual(["email", "id"]);
    expect(world.accounts.all().length).toBe(1);
  });

  it("SC-01 / BR-04: stores the hash and never the password, and shows neither", async () => {
    const world = buildWorld();
    const view = await registered(world, "ana@example.com", "first-password-1");
    const stored = world.accounts.all()[0]!;
    expect(stored.passwordHash).not.toContain("first-password-1");
    expect(stored.passwordHash).toBe("fake$1-drowssap-tsrif");
    expect(JSON.stringify(view)).not.toContain("first-password-1");
    expect(JSON.stringify(view)).not.toContain(stored.passwordHash);
  });

  it("SC-01 / Q9: does not sign the person in", async () => {
    const world = buildWorld();
    await registered(world);
    expect(world.sessions.all().length).toBe(0);
  });

  it("BR-01: stores the email in its normal form", async () => {
    const world = buildWorld();
    const view = await registered(world, "  Ana@Example.COM ");
    expect(view.email).toBe("ana@example.com");
  });

  it.each(["ANA@example.com", "Ana@Example.COM", "  ana@example.com  "])(
    "SC-02 / BR-02: %j is rejected as already registered and nothing is created",
    async (email) => {
      const world = buildWorld();
      await registered(world);
      await expect(world.register.execute({ email, password: "another-password-2" })).rejects.toThrow(
        EmailAlreadyRegistered,
      );
      expect(world.accounts.all().length).toBe(1);
    },
  );

  it("SC-03 / BR-02: a rejected registration leaves the Account as it was", async () => {
    const world = buildWorld();
    await registered(world, "ana@example.com", "first-password-1");
    await world.register.execute({ email: "ana@example.com", password: "second-password-2" }).catch(() => {});
    await expect(world.signIn.execute({ email: "ana@example.com", password: "first-password-1" })).resolves.toBeDefined();
    await expect(world.signIn.execute({ email: "ana@example.com", password: "second-password-2" })).rejects.toThrow();
  });

  it("BR-02: if another registration wins between the check and the store, it is the same error", async () => {
    const world = buildWorld(new BlindOnce());
    await registered(world);
    (world.accounts as BlindOnce).blind = true; // the check does not see the Account, the store does
    await expect(world.register.execute({ email: "ana@example.com", password: "another-password-2" })).rejects.toThrow(
      EmailAlreadyRegistered,
    );
  });

  it.each([
    ["SC-04", "ana@example.com", "x".repeat(9)],
    ["SC-04", "ana@example.com", "x".repeat(129)],
    ["SC-05", "ana-garcia@example.com", "ana-garcia@example.com"],
    ["SC-06", "", "valid-password-1"],
    ["SC-06", "ana", "valid-password-1"],
    ["SC-06", "ana@@example.com", "valid-password-1"],
  ])("%s / BR-01, BR-03: rejects %j with %j as an invalid registration", async (_sc, email, password) => {
    const world = buildWorld();
    const error = await world.register.execute({ email, password }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvalidRegistration);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(world.accounts.all().length).toBe(0);
  });

  it.each([10, 128])("SC-04 / BR-03: accepts %i characters", async (length) => {
    const world = buildWorld();
    await expect(world.register.execute({ email: "ana@example.com", password: "x".repeat(length) })).resolves.toBeDefined();
  });

  it("the error says what is wrong with the registration and keeps the cause", async () => {
    const world = buildWorld();
    const error = (await world.register
      .execute({ email: "ana@example.com", password: "short" })
      .catch((e: unknown) => e)) as InvalidRegistration;
    expect(error.message).toContain("at least 10");
    expect(error.cause).toBeDefined();
  });

  it("does not spend a slow hash on a registration that is not valid or is repeated", async () => {
    const world = buildWorld();
    await registered(world);
    const before = world.hasher.hashes;
    await world.register.execute({ email: "ana@example.com", password: "another-password-2" }).catch(() => {});
    await world.register.execute({ email: "bad", password: "another-password-2" }).catch(() => {});
    expect(world.hasher.hashes).toBe(before);
  });
});

describe("RegisterAccount: what is wrong with a registration (feature 09, BR-04)", () => {
  const problemOf = async (email: string, password: string) => {
    const error = await buildWorld().register.execute({ email, password }).catch((e: unknown) => e);
    return error instanceof InvalidRegistration ? error.problem : error;
  };

  it.each([
    ["an empty email", "", "valid-password-1", "EMAIL_NOT_VALID"],
    ["an email that has no domain", "ana@", "valid-password-1", "EMAIL_NOT_VALID"],
    ["an email with two at signs", "ana@@example.com", "valid-password-1", "EMAIL_NOT_VALID"],
    ["a password of 9 characters", "ana@example.com", "x".repeat(9), "PASSWORD_TOO_SHORT"],
    ["a password of 129 characters", "ana@example.com", "x".repeat(129), "PASSWORD_TOO_LONG"],
    ["a password that is the email", "ana-garcia@example.com", "ana-garcia@example.com", "PASSWORD_IS_EMAIL"],
  ])("SC-04 / SC-05 / SC-06 / BR-01 / BR-03: %s is the problem %s", async (_what, email, password, problem) => {
    expect(await problemOf(email, password)).toBe(problem);
  });

  it("the email is checked before the password, and the length of the password before it being the email", async () => {
    expect(await problemOf("ana", "short")).toBe("EMAIL_NOT_VALID");
    expect(await problemOf("a@b.co", "a@b.co")).toBe("PASSWORD_TOO_SHORT");
  });

  it("keeps the message in words, and the cause", async () => {
    const error = (await buildWorld().register.execute({ email: "ana@example.com", password: "short" }).catch((e: unknown) => e)) as InvalidRegistration;
    expect(error.message).toContain("at least 10");
    expect(error.cause).toBeDefined();
  });
});

