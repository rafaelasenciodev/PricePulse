import { createHash, randomBytes } from "node:crypto";
import type { SessionTokens } from "../application";

const TOKEN_BYTES = 32;

/**
 * Implements SessionTokens with the cryptographic random generator of the platform (ADR-0004).
 *
 * A token is 256 random bits, so it cannot be guessed and its hash needs no salt or slow
 * algorithm: a plain SHA-256 is enough to keep the token itself out of the store.
 */
export class CryptoSessionTokens implements SessionTokens {
  create(): string {
    return randomBytes(TOKEN_BYTES).toString("base64url");
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
