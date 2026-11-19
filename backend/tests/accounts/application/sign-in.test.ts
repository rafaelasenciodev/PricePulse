/** Application tests of UC-02 Sign in. Each test names the scenario or the rule it verifies. */

import { describe, expect, it } from "vitest";
import { InvalidCredentials, TooManyAttempts } from "../../../src/accounts/application";
import { DAY, MINUTE, START, buildWorld, failTimes, registered } from "../support/world";

const ANA = { email: "ana@example.com", password: "first-password-1" };

describe("SignIn", () => {
  it("SC-07 / BR-05: creates a Session and gives its token", async () => {
    const world = buildWorld();
    const { id } = await registered(world);
    const result = await world.signIn.execute(ANA);
    expect(result.token).toBe("token-2"); // token-1 was spent on the fallback of the use case
    expect(result.account).toEqual({ id, email: "ana@example.com" });
    expect(world.sessions.byHash.size).toBe(1);
  });

  it("SC-07 / BR-07: the Session expires 7 days from now and the answer says when", async () => {
    const world = buildWorld();
    await registered(world);
    const result = await world.signIn.execute(ANA);
    expect(result.expiresAt).toBe(new Date(START + 7 * DAY).toISOString());
  });

  it("SC-07: only the hash of the token is kept", async () => {
    const world = buildWorld();
    await registered(world);
    const { token } = await world.signIn.execute(ANA);
    expect(JSON.stringify([...world.sessions.byHash.values()])).not.toContain(`"${token}"`);
    expect([...world.sessions.byHash.keys()]).toEqual([world.tokens.hash(token)]);
  });

  it("SC-08 / BR-01: reads the email the same way as registering", async () => {
    const world = buildWorld();
    await registered(world);
    await expect(world.signIn.execute({ email: "  ANA@Example.com ", password: ANA.password })).resolves.toBeDefined();
  });

  it("SC-10 / BR-07: each sign-in is a Session of its own", async () => {
    const world = buildWorld();
    await registered(world);
    const first = await world.signIn.execute(ANA);
    const second = await world.signIn.execute(ANA);
    expect(first.token).not.toBe(second.token);
    expect(world.sessions.byHash.size).toBe(2);
    expect(await world.authenticate.execute(first.token)).toBe(first.account.id);
    expect(await world.authenticate.execute(second.token)).toBe(first.account.id);
  });

  describe("a failed sign-in (SC-09 / BR-05)", () => {
    const cases: [string, { email: string; password: string }][] = [
      ["a wrong password", { email: "ana@example.com", password: "wrong-password-0" }],
      ["an email that nobody registered", { email: "ghost@example.com", password: "first-password-1" }],
      ["a text that is not an email", { email: "not an email", password: "first-password-1" }],
    ];

    it.each(cases)("is refused with %s, with the same error and message", async (_what, credentials) => {
      const world = buildWorld();
      await registered(world);
      const error = (await world.signIn.execute(credentials).catch((e: unknown) => e)) as Error;
      expect(error).toBeInstanceOf(InvalidCredentials);
      expect(error.message).toBe(new InvalidCredentials().message);
      expect(world.sessions.byHash.size).toBe(0);
    });

    it.each(cases)("checks a hash with %s, so the time does not tell which it was", async (_what, credentials) => {
      const world = buildWorld();
      await registered(world);
      const before = world.hasher.verifications.length;
      await world.signIn.execute(credentials).catch(() => {});
      expect(world.hasher.verifications.length).toBe(before + 1);
    });

    it("checks the password against a hash that is not of any Account when there is none", async () => {
      const world = buildWorld();
      await registered(world);
      await world.signIn.execute({ email: "ghost@example.com", password: "first-password-1" }).catch(() => {});
      const last = world.hasher.verifications.at(-1)!;
      expect([...world.accounts.byEmail.values()].map((a) => a.passwordHash)).not.toContain(last.hash);
      // A real hash, as slow to check as any other: an empty text would be checked at once.
      expect(world.hasher.produced.has(last.hash)).toBe(true);
    });

    it("never signs in an unknown email, whatever the password", async () => {
      const world = buildWorld();
      // The fallback is the hash of a random token: the password that a guess would need is not guessable.
      await expect(world.signIn.execute({ email: "ghost@example.com", password: "token-1" })).rejects.toThrow(
        InvalidCredentials,
      );
    });
  });

  describe("repeated attempts (BR-06)", () => {
    it("SC-11: after 5 failures in a row the email is refused, with the right password too, and it says how long", async () => {
      const world = buildWorld();
      await registered(world);
      await failTimes(world, 5);
      const error = (await world.signIn.execute(ANA).catch((e: unknown) => e)) as TooManyAttempts;
      expect(error).toBeInstanceOf(TooManyAttempts);
      expect(error.secondsToWait).toBe(15 * 60);
    });

    it("SC-11: the fifth failure itself is answered as invalid credentials, and the sixth attempt is the first refused", async () => {
      const world = buildWorld();
      await registered(world);
      await failTimes(world, 4);
      await expect(world.signIn.execute({ ...ANA, password: "wrong-password-0" })).rejects.toThrow(InvalidCredentials);
      await expect(world.signIn.execute({ ...ANA, password: "wrong-password-0" })).rejects.toThrow(TooManyAttempts);
    });

    it("SC-11: a refused attempt does not look at the password and does not extend the lock", async () => {
      const world = buildWorld();
      await registered(world);
      await failTimes(world, 5);
      const verifications = world.hasher.verifications.length;
      world.clock.advance(5 * MINUTE);
      const error = (await world.signIn.execute(ANA).catch((e: unknown) => e)) as TooManyAttempts;
      expect(world.hasher.verifications.length).toBe(verifications);
      expect(error.secondsToWait).toBe(10 * 60);
    });

    it("SC-12: a success resets the count", async () => {
      const world = buildWorld();
      await registered(world);
      await failTimes(world, 4);
      await world.signIn.execute(ANA);
      await failTimes(world, 4);
      await expect(world.signIn.execute(ANA)).resolves.toBeDefined();
    });

    it("SC-13: 15 minutes after the fifth failure the email can sign in again", async () => {
      const world = buildWorld();
      await registered(world);
      await failTimes(world, 5);
      world.clock.advance(15 * MINUTE - 1);
      await expect(world.signIn.execute(ANA)).rejects.toThrow(TooManyAttempts);
      world.clock.advance(1);
      await expect(world.signIn.execute(ANA)).resolves.toBeDefined();
    });

    it("SC-14: the failures of one email do not affect another", async () => {
      const world = buildWorld();
      await registered(world, "ana@example.com");
      await registered(world, "luis@example.com", "luis-password-1");
      await failTimes(world, 5, "ana@example.com");
      await expect(world.signIn.execute({ email: "luis@example.com", password: "luis-password-1" })).resolves.toBeDefined();
    });

    it("SC-15: an email that nobody registered is limited in the same way", async () => {
      const world = buildWorld();
      await failTimes(world, 5, "ghost@example.com");
      await expect(world.signIn.execute({ email: "ghost@example.com", password: "whatever-pass-1" })).rejects.toThrow(
        TooManyAttempts,
      );
    });

    it("SC-15: the count is by the normal form of the email, so changing the case does not escape it", async () => {
      const world = buildWorld();
      await registered(world);
      await failTimes(world, 3, "ana@example.com");
      await failTimes(world, 2, "  ANA@Example.com ");
      await expect(world.signIn.execute(ANA)).rejects.toThrow(TooManyAttempts);
    });

    it("SC-15: a text that is not an email is counted by its normal form too", async () => {
      const world = buildWorld();
      await failTimes(world, 5, "Not An Email");
      await expect(world.signIn.execute({ email: " not an email ", password: "whatever-pass-1" })).rejects.toThrow(
        TooManyAttempts,
      );
    });
  });
});
