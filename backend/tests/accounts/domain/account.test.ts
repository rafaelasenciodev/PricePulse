import { describe, expect, it } from "vitest";
import { Account, Email } from "../../../src/accounts/domain";
import { UserId } from "../../../src/shared/domain";

describe("Account", () => {
  it("SC-01 / BR-04: holds the identifier, the email and the hash, and no password", () => {
    const account = new Account(UserId("user-1"), Email.of("ana@example.com"), "scrypt$hash");
    expect(account.id).toBe("user-1");
    expect(account.email.value).toBe("ana@example.com");
    expect(account.passwordHash).toBe("scrypt$hash");
    expect(Object.keys(account).sort()).toEqual(["email", "id", "passwordHash"]);
  });
});
