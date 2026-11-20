/**
 * The contract of AccountRepository, as tests that any adapter must pass.
 * It is a function so that the in-memory adapter and, later, a database adapter run exactly the
 * same checks. (Not a *.test.ts file: it is run from the test of each adapter.)
 */

import { beforeEach, describe, expect, it } from "vitest";
import { EmailAlreadyStored, type AccountRepository } from "../../../src/accounts/application";
import { Account, Email } from "../../../src/accounts/domain";
import { UserId } from "../../../src/shared/domain";

export const accountOf = (email: string, id = `user-${email}`, hash = "hash-1") =>
  new Account(UserId(id), Email.of(email), hash);

export function describeAccountRepositoryContract(name: string, create: () => AccountRepository | Promise<AccountRepository>): void {
  describe(`AccountRepository: ${name}`, () => {
    let repository: AccountRepository;
    beforeEach(async () => {
      repository = await create();
    });

    it("finds an Account by its email and by its identifier", async () => {
      const ana = accountOf("ana@example.com", "user-1");
      await repository.add(ana);
      expect(await repository.findByEmail(Email.of("ana@example.com"))).toEqual(ana);
      expect(await repository.find(UserId("user-1"))).toEqual(ana);
    });

    it("finds nothing for an email or an identifier that is not stored", async () => {
      await repository.add(accountOf("ana@example.com", "user-1"));
      expect(await repository.findByEmail(Email.of("luis@example.com"))).toBeNull();
      expect(await repository.find(UserId("user-2"))).toBeNull();
    });

    it("BR-01: finds the Account by any way of writing its email", async () => {
      await repository.add(accountOf("ana@example.com", "user-1"));
      expect(await repository.findByEmail(Email.of("  ANA@Example.com "))).not.toBeNull();
    });

    it("keeps Accounts apart", async () => {
      await repository.add(accountOf("ana@example.com", "user-1"));
      await repository.add(accountOf("luis@example.com", "user-2"));
      expect((await repository.find(UserId("user-2")))?.email.value).toBe("luis@example.com");
    });

    it("BR-02: refuses an email that is stored, and the Account that was there is not changed", async () => {
      const first = accountOf("ana@example.com", "user-1", "hash-first");
      await repository.add(first);
      await expect(repository.add(accountOf("ana@example.com", "user-2", "hash-second"))).rejects.toThrow(
        EmailAlreadyStored,
      );
      expect(await repository.findByEmail(Email.of("ana@example.com"))).toEqual(first);
      expect(await repository.find(UserId("user-2"))).toBeNull();
    });

    it("BR-02: of two registrations of the same email at once, exactly one is stored", async () => {
      const results = await Promise.allSettled([
        repository.add(accountOf("ana@example.com", "user-1")),
        repository.add(accountOf("ana@example.com", "user-2")),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    });
  });
}
