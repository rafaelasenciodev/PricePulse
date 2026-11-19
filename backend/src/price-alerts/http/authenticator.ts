import type { UserId } from "../../shared/domain";

/**
 * Identifies the User who makes a request from the credential it carries.
 *
 * It belongs to the HTTP boundary: the use case never sees it, it only receives the
 * identified User (contract, decision 1). Registration and login are a separate
 * feature; until it exists, an in-memory adapter stands in for it.
 */
export interface Authenticator {
  /** The User the token belongs to, or null if the token is not valid. */
  authenticate(token: string): Promise<UserId | null>;
}
