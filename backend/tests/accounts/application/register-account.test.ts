/** Application tests of UC-01 Register. Each test names the scenario or the rule it verifies. */

import { describe, expect, it } from "vitest";
import { ApplicationError, EmailAlreadyRegistered, InvalidRegistration } from "../../../src/accounts/application";
import { buildWorld, registered } from "../support/world";

describe("RegisterAccount", () => {
  it("SC-01 / BR-01: creates the Account and answers with its identifier and its email", async () => {
    const world = buildWorld();
    const view = await registered(world);
    expect(view.email).toBe("ana@example.com");
    expect(view.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.keys(view).sort()).toEqual(["email", "id"]);
    expect(world.accounts.byEmail.size).toBe(1);
  });

  it("SC-01 / BR-04: stores the hash and never the password, and shows neither", async () => {
    const world = buildWorld();
    const view = await registered(world, "ana@example.com", "first-password-1");
    const stored = [...world.accounts.byEmail.values()][0]!;
    expect(stored.passwordHash).not.toContain("first-password-1");
    expect(stored.passwordHash).toBe("fake$1-drowssap-tsrif");
    expect(JSON.stringify(view)).not.toContain("first-password-1");
    expect(JSON.stringify(view)).not.toContain(stored.passwordHash);
  });

  it("SC-01 / Q9: does not sign the person in", async () => {
    const world = buildWorld();
    await registered(world);
    expect(world.sessions.byHash.size).toBe(0);
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
      expect(world.accounts.byEmail.size).toBe(1);
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
    const world = buildWorld();
    await registered(world);
    world.accounts.hideOnce = true; // the check does not see the Account, the store does
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
    expect(world.accounts.byEmail.size).toBe(0);
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
