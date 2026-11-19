/** Application tests of UC-03 Sign out, UC-04 Read my account and UC-05 Authenticate. */

import { describe, expect, it } from "vitest";
import { Unauthenticated } from "../../../src/accounts/application";
import { UserId } from "../../../src/shared/domain";
import { DAY, HOUR, buildWorld, registered, type World } from "../support/world";

const ANA = { email: "ana@example.com", password: "first-password-1" };

async function withSession(world: World) {
  const account = await registered(world);
  const { token } = await world.signIn.execute(ANA);
  return { account, token };
}

describe("Authenticate", () => {
  it("SC-16 / BR-08: the token of a Session is the User of its Account", async () => {
    const world = buildWorld();
    const { account, token } = await withSession(world);
    expect(await world.authenticate.execute(token)).toBe(account.id);
  });

  it.each(["", "no-such-token", "demo-token-1"])("SC-17 / BR-08: %j identifies nobody", async (token) => {
    const world = buildWorld();
    await withSession(world);
    expect(await world.authenticate.execute(token)).toBeNull();
  });

  it("SC-17: the hash of a token is not a token", async () => {
    const world = buildWorld();
    const { token } = await withSession(world);
    expect(await world.authenticate.execute(world.tokens.hash(token))).toBeNull();
  });

  it.each([
    [6 * DAY + 23 * HOUR, true, "6 days and 23 hours"],
    [7 * DAY - 1, true, "just before 7 days"],
    [7 * DAY, false, "7 days"],
  ])("SC-18 / BR-07, BR-08: after %i ms it identifies the User: %s (%s)", async (elapsed, valid) => {
    const world = buildWorld();
    const { account, token } = await withSession(world);
    world.clock.advance(elapsed);
    expect(await world.authenticate.execute(token)).toBe(valid ? account.id : null);
  });
});

describe("SignOut", () => {
  it("SC-19 / BR-09: ends the Session of the token and no other", async () => {
    const world = buildWorld();
    const { account, token: first } = await withSession(world);
    const { token: second } = await world.signIn.execute(ANA);
    await world.signOut.execute({ token: first });
    expect(await world.authenticate.execute(first)).toBeNull();
    expect(await world.authenticate.execute(second)).toBe(account.id);
    expect(world.sessions.all().length).toBe(1);
  });

  it("SC-20 / BR-09: a Session that was signed out cannot sign out again", async () => {
    const world = buildWorld();
    const { token } = await withSession(world);
    await world.signOut.execute({ token });
    await expect(world.signOut.execute({ token })).rejects.toThrow(Unauthenticated);
  });

  it.each(["no-such-token", ""])("SC-17 / BR-08: %j cannot sign out", async (token) => {
    const world = buildWorld();
    await withSession(world);
    await expect(world.signOut.execute({ token })).rejects.toThrow(Unauthenticated);
    expect(world.sessions.all().length).toBe(1);
  });

  it("BR-08: an expired Session cannot sign out", async () => {
    const world = buildWorld();
    const { token } = await withSession(world);
    world.clock.advance(7 * DAY);
    await expect(world.signOut.execute({ token })).rejects.toThrow(Unauthenticated);
  });
});

describe("ReadMyAccount", () => {
  it("SC-21 / BR-10: shows the identifier and the email, and nothing else", async () => {
    const world = buildWorld();
    const { account } = await withSession(world);
    const view = await world.readMyAccount.execute({ owner: UserId(account.id) });
    expect(view).toEqual({ id: account.id, email: "ana@example.com" });
  });

  it("SC-21 / BR-04: never has the password or its hash", async () => {
    const world = buildWorld();
    const { account } = await withSession(world);
    const view = await world.readMyAccount.execute({ owner: UserId(account.id) });
    const stored = world.accounts.all()[0]!;
    expect(JSON.stringify(view)).not.toContain(stored.passwordHash);
    expect(JSON.stringify(view)).not.toContain("first-password-1");
  });

  it("an owner without an Account is a defect and not an answer", async () => {
    const world = buildWorld();
    await expect(world.readMyAccount.execute({ owner: UserId("ghost") })).rejects.toThrow(/does not exist/);
  });
});
