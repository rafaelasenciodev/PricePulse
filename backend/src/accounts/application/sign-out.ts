/** UC-03 Sign out (see the design). */

import { Unauthenticated } from "./errors";
import { findValidSession } from "./find-valid-session";
import type { Clock, SessionStore, SessionTokens } from "./ports";

export interface SignOutCommand {
  readonly token: string;
}

export class SignOut {
  constructor(
    private readonly sessions: SessionStore,
    private readonly tokens: SessionTokens,
    private readonly clock: Clock,
  ) {}

  /** Ends the Session of the token and no other (BR-09). A token that is not valid is Unauthenticated. */
  async execute(command: SignOutCommand): Promise<void> {
    const session = await findValidSession(this.sessions, this.tokens, this.clock, command.token);
    if (session === null) throw new Unauthenticated();
    await this.sessions.delete(session.tokenHash);
  }
}
