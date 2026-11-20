import type { ProviderId } from "../domain";

/**
 * Identifies the Provider that makes a request from the credential it carries.
 *
 * It belongs to the HTTP boundary: the use case never sees it, it only receives the
 * identified Provider (contract, decision 1). It is not the Authenticator of Users: a
 * token of a User is not a credential of a Provider, so it is not valid here. Real
 * authentication of Providers is a later decision; until then an in-memory adapter stands in.
 */
export interface ProviderAuthenticator {
  /** The Provider the token belongs to, or null if the token is not valid. */
  authenticate(token: string): Promise<ProviderId | null>;
}
