import { describe, expect, it } from "vitest";
import {
  Email,
  PasswordIsEmail,
  PasswordTooLong,
  PasswordTooShort,
  assertValidPassword,
} from "../../../src/accounts/domain";
import { InvalidValue } from "../../../src/shared/domain";

const ana = Email.of("ana-garcia@example.com");

describe("assertValidPassword", () => {
  it.each([
    [9, PasswordTooShort],
    [129, PasswordTooLong],
  ])("SC-04 / BR-03: rejects %i characters", (length, error) => {
    expect(() => assertValidPassword("x".repeat(length), ana)).toThrow(error);
  });

  it.each([10, 11, 127, 128])("SC-04 / BR-03: accepts %i characters", (length) => {
    expect(() => assertValidPassword("x".repeat(length), ana)).not.toThrow();
  });

  it("BR-03: counts characters and not bytes, so ten emoji are valid and nine are not", () => {
    expect(() => assertValidPassword("🔑".repeat(10), ana)).not.toThrow();
    expect(() => assertValidPassword("🔑".repeat(9), ana)).toThrow(PasswordTooShort);
    expect(() => assertValidPassword("🔑".repeat(129), ana)).toThrow(PasswordTooLong);
  });

  it.each(["ana-garcia@example.com", "ANA-GARCIA@example.com", " ana-garcia@example.com "])(
    "SC-05 / BR-03: rejects %j, which is the email",
    (password) => {
      expect(() => assertValidPassword(password, ana)).toThrow(PasswordIsEmail);
    },
  );

  it("BR-03: has no rules of composition", () => {
    expect(() => assertValidPassword("aaaaaaaaaa", ana)).not.toThrow();
    expect(() => assertValidPassword("          ", ana)).not.toThrow();
  });

  it("the errors are mistakes of the caller", () => {
    expect(new PasswordTooShort(10)).toBeInstanceOf(InvalidValue);
    expect(new PasswordTooLong(128)).toBeInstanceOf(InvalidValue);
    expect(new PasswordIsEmail()).toBeInstanceOf(InvalidValue);
  });
});
