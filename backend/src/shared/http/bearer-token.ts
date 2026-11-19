const BEARER = /^Bearer\s+(.+)$/i;

/**
 * The token of an `Authorization: Bearer <token>` header, or null if the header is missing, is
 * not of that kind or has nothing after the word. The word is read in any case, as the standard says.
 *
 * Every route that identifies someone reads its token with this function, so they all read it
 * the same way. It only reads the header: whether the token is valid is another question.
 */
export function bearerTokenOf(header: string | undefined): string | null {
  const token = BEARER.exec(header ?? "")?.[1]?.trim();
  return token ? token : null;
}
