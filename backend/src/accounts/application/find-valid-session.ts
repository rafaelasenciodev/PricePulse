import type { Session } from "../domain";
import type { Clock, SessionStore, SessionTokens } from "./ports";

/** The Session of a token if it exists and is valid at this moment (BR-08), otherwise null. */
export async function findValidSession(
  sessions: SessionStore,
  tokens: SessionTokens,
  clock: Clock,
  token: string,
): Promise<Session | null> {
  const session = await sessions.findByTokenHash(tokens.hash(token));
  return session !== null && session.isValidAt(clock.now().getTime()) ? session : null;
}
