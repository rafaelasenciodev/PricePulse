import { describe, expect, it } from "vitest";
import { Email, InvalidEmail } from "../../../src/accounts/domain";
import { InvalidValue } from "../../../src/shared/domain";

describe("Email", () => {
  it.each(["ANA@example.com", "Ana@Example.COM", "  ana@example.com  "])(
    "SC-02 / BR-01: %j is the same email as ana@example.com",
    (text) => {
      expect(Email.of(text).value).toBe("ana@example.com");
      expect(Email.of(text).equals(Email.of("ana@example.com"))).toBe(true);
    },
  );

  it("two different emails are not equal", () => {
    expect(Email.of("ana@example.com").equals(Email.of("luis@example.com"))).toBe(false);
  });

  it.each(["", "   ", "ana", "@example.com", "ana@", "ana@@example.com", "a@b@c.com", "an a@example.com"])(
    "SC-06 / BR-01: rejects %j, which is not shaped like an email",
    (text) => {
      expect(() => Email.of(text)).toThrow(InvalidEmail);
    },
  );

  it("BR-01: accepts 254 characters and rejects 255", () => {
    const withLength = (n: number) => `${"a".repeat(n - "@b.co".length)}@b.co`;
    expect(Email.of(withLength(254)).value).toHaveLength(254);
    expect(() => Email.of(withLength(255))).toThrow(InvalidEmail);
  });

  it("the error is a mistake of the caller and does not repeat the text", () => {
    const error = (() => {
      try {
        Email.of("secret text");
      } catch (e) {
        return e as Error;
      }
    })();
    expect(error).toBeInstanceOf(InvalidValue);
    expect(error?.message).not.toContain("secret");
  });

  it("SC-08 / SC-15: any text has a normal form, valid or not", () => {
    expect(Email.normalize("  GHOST@Example.com ")).toBe("ghost@example.com");
    expect(Email.normalize(" Not An Email ")).toBe("not an email");
  });
});
