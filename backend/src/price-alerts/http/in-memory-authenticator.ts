import type { Authenticator } from "./authenticator";
import type { UserId } from "../../shared/domain";

/**
 * Implements Authenticator over a table of tokens that the caller fills.
 * Only for development and tests: real authentication comes with the accounts feature.
 */
export class InMemoryAuthenticator implements Authenticator {
  private readonly users = new Map<string, UserId>();

  addUser(token: string, userId: UserId): void {
    this.users.set(token, userId);
  }

  async authenticate(token: string): Promise<UserId | null> {
    return this.users.get(token) ?? null;
  }
}
