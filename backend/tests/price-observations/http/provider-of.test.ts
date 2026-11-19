import { describe, expect, it } from "vitest";
import { ProviderId } from "../../../src/price-observations/domain";
import { Unauthenticated } from "../../../src/price-observations/http";
import { providerOf } from "../../../src/price-observations/http/routes";

describe("providerOf", () => {
  it("BR-01: returns the authenticated Provider of the request", () => {
    expect(providerOf({ provider: ProviderId("simulator") })).toBe(ProviderId("simulator"));
  });

  it("BR-01: fails safe when a request reaches the handler without a Provider", () => {
    // The authentication hook should make this impossible. If a route is ever registered
    // without it, the request is refused instead of reaching the use case without a Provider.
    expect(() => providerOf({ provider: null })).toThrow(Unauthenticated);
  });
});
