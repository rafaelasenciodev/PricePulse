import type { ProviderId } from "../domain";
import type { ProviderAuthenticator } from "./authenticator";

/**
 * Implements ProviderAuthenticator over a table of tokens that the caller fills.
 * Only for development and tests: real authentication of Providers is not decided yet.
 */
export class InMemoryProviderAuthenticator implements ProviderAuthenticator {
  private readonly providers = new Map<string, ProviderId>();

  addProvider(token: string, providerId: ProviderId): void {
    this.providers.set(token, providerId);
  }

  async authenticate(token: string): Promise<ProviderId | null> {
    return this.providers.get(token) ?? null;
  }
}
