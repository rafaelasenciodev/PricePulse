import { describe, expect, it } from "vitest";
import { Session } from "../../../src/accounts/domain";
import { UserId } from "../../../src/shared/domain";

describe("Session.restore", () => {
  it("rebuilds a stored Session as it was", () => {
    const session = Session.restore("hash", UserId("user-1"), 1000, 2000);
    expect([session.tokenHash, session.userId, session.createdAt, session.expiresAt]).toEqual(["hash", "user-1", 1000, 2000]);
  });

  it.each([
    ["an expiry equal to the creation", 1000, 1000],
    ["an expiry before the creation", 2000, 1000],
    ["an instant that is not an integer", 1000.5, 2000],
    ["an instant that is not safe", 1000, 2 ** 53],
  ])("refuses stored data with %s", (_name, createdAt, expiresAt) => {
    expect(() => Session.restore("hash", UserId("user-1"), createdAt, expiresAt)).toThrow(RangeError);
  });
});
