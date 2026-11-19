import { FAST_SCRYPT_PARAMETERS, ScryptPasswordHasher } from "../../src/accounts/adapters";
import type { InMemoryApplication } from "../../src/composition-root";
import { UserId } from "../../src/shared/domain";

/** A hash with no cost, so a test that makes Users does not spend its time on the protection of passwords. */
export const FAST_HASHER = new ScryptPasswordHasher(FAST_SCRYPT_PARAMETERS);

const PASSWORD = "test-password-1";

/**
 * Makes a User the way a person does: registers an Account and signs in. Gives the token of its
 * Session, to send in `Authorization: Bearer`, and its identifier.
 */
export async function signedInUser(
  application: Pick<InMemoryApplication, "registerAccount" | "signIn">,
  email: string,
): Promise<{ token: string; userId: UserId }> {
  const account = await application.registerAccount.execute({ email, password: PASSWORD });
  const { token } = await application.signIn.execute({ email, password: PASSWORD });
  return { token, userId: UserId(account.id) };
}
