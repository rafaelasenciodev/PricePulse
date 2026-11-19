import { describe, expect, it } from "vitest";
import { bearerTokenOf } from "../../../src/shared/http";

describe("bearerTokenOf", () => {
  it.each([
    ["Bearer abc", "abc"],
    ["bearer abc", "abc"],
    ["BEARER abc", "abc"],
    ["Bearer   abc", "abc"],
    ["Bearer abc   ", "abc"],
    ["Bearer a.b-c_d~e+f/g=", "a.b-c_d~e+f/g="],
  ])("reads %j as the token %j", (header, token) => {
    expect(bearerTokenOf(header)).toBe(token);
  });

  it.each([undefined, "", "Bearer", "Bearer ", "Bearer    ", "Basic abc", "abc", "Token abc", "xBearer abc", " Bearer abc"])(
    "reads %j as no token",
    (header) => {
      expect(bearerTokenOf(header)).toBeNull();
    },
  );
});
