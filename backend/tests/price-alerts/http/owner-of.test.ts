import { describe, expect, it } from "vitest";
import { Unauthenticated } from "../../../src/price-alerts/http";
import { ownerOf } from "../../../src/price-alerts/http/routes";
import { UserId } from "../../../src/shared/domain";

describe("ownerOf", () => {
  it("BR-01: returns the authenticated User of the request", () => {
    expect(ownerOf({ owner: UserId("user-1") })).toBe(UserId("user-1"));
  });

  it("BR-01: fails safe when a request reaches the handler without an owner", () => {
    // The authentication hook should make this impossible. If a route is ever registered
    // without it, the request is refused instead of reaching the use case without an owner.
    expect(() => ownerOf({ owner: null })).toThrow(Unauthenticated);
  });
});
