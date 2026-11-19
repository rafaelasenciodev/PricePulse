import { describe, expect, it } from "vitest";
import { SESSION_LIFETIME_MILLISECONDS, Session } from "../../../src/accounts/domain";
import { UserId } from "../../../src/shared/domain";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-11-19T10:00:00Z");

describe("Session", () => {
  const session = Session.start("hash-1", UserId("user-1"), NOW);

  it("BR-07: starts at the moment it is given and expires 7 days later", () => {
    expect(session.createdAt).toBe(NOW);
    expect(session.expiresAt).toBe(NOW + 7 * DAY);
    expect(SESSION_LIFETIME_MILLISECONDS).toBe(7 * DAY);
  });

  it("holds the hash of the token and the Account, and nothing else that identifies it", () => {
    expect(session.tokenHash).toBe("hash-1");
    expect(session.userId).toBe("user-1");
  });

  it.each([
    [0, true],
    [6 * DAY + 23 * HOUR, true],
    [7 * DAY - 1, true],
    [7 * DAY, false],
    [7 * DAY + 1, false],
  ])("SC-18 / BR-08: %i ms after its creation it is valid: %s", (elapsed, valid) => {
    expect(session.isValidAt(NOW + elapsed)).toBe(valid);
  });
});
