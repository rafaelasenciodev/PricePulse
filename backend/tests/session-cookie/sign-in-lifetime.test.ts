/** SignIn gives the seconds that the Session has left, for the life of the cookie (feature 08). */

import { describe, expect, it } from "vitest";
import { SESSION_LIFETIME_MILLISECONDS } from "../../src/accounts/domain";
import { DAY, START, buildWorld, registered } from "../accounts/support/world";

const ANA = { email: "ana@example.com", password: "first-password-1" };

describe("SignIn: the seconds that the Session has left", () => {
  it("SC-02 / BR-02: are the 7 days of the life of a Session, in whole seconds", async () => {
    const world = buildWorld();
    await registered(world);
    expect((await world.signIn.execute(ANA)).expiresInSeconds).toBe(7 * 24 * 60 * 60);
    expect((await world.signIn.execute(ANA)).expiresInSeconds).toBe(SESSION_LIFETIME_MILLISECONDS / 1000);
  });

  it("SC-02 / BR-02: are counted from the moment of signing in, so a later sign-in has the same life", async () => {
    const world = buildWorld();
    await registered(world);
    world.clock.advance(3 * DAY);
    expect((await world.signIn.execute(ANA)).expiresInSeconds).toBe(7 * 24 * 60 * 60);
  });

  it("agree with the moment when the Session ends", async () => {
    const world = buildWorld();
    await registered(world);
    const result = await world.signIn.execute(ANA);
    expect(Date.parse(result.expiresAt)).toBe(START + result.expiresInSeconds * 1000);
  });

  it("are whole seconds, whatever the milliseconds of the clock", async () => {
    const world = buildWorld();
    await registered(world);
    world.clock.advance(999);
    const result = await world.signIn.execute(ANA);
    expect(Number.isInteger(result.expiresInSeconds)).toBe(true);
    expect(result.expiresInSeconds).toBe(7 * 24 * 60 * 60);
  });
});
