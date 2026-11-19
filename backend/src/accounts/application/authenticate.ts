/** UC-05 Authenticate: who a token belongs to. The other modules reach it through their own ports. */

import type { UserId } from "../../shared/domain";
import { findValidSession } from "./find-valid-session";
import type { Clock, SessionStore, SessionTokens } from "./ports";

export class Authenticate {
  constructor(
    private readonly sessions: SessionStore,
    private readonly tokens: SessionTokens,
    private readonly clock: Clock,
  ) {}

  /** The User of the Session, or null if the token is unknown, expired or of a Session that ended (BR-08). */
  async execute(token: string): Promise<UserId | null> {
    return (await findValidSession(this.sessions, this.tokens, this.clock, token))?.userId ?? null;
  }
}
