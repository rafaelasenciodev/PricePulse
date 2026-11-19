/** UC-02 Sign in (see the design). */

import { InvalidValue } from "../../shared/domain";
import { Email, Session } from "../domain";
import { toView, type AccountView } from "./account-view";
import { InvalidCredentials, TooManyAttempts } from "./errors";
import type { AccountRepository, Clock, LoginAttemptStore, PasswordHasher, SessionStore, SessionTokens } from "./ports";

export interface SignInCommand {
  readonly email: string;
  readonly password: string;
}

export interface SignInResult {
  /** The token, given once. Only its hash is kept. */
  readonly token: string;
  /** In UTC, such as "2026-11-26T10:00:00.000Z". */
  readonly expiresAt: string;
  readonly account: AccountView;
}

export class SignIn {
  /** A hash to check when there is no Account, so that the time does not tell (BR-05). */
  private readonly fallbackHash: Promise<string>;

  constructor(
    private readonly accounts: AccountRepository,
    private readonly sessions: SessionStore,
    private readonly attempts: LoginAttemptStore,
    private readonly hasher: PasswordHasher,
    private readonly tokens: SessionTokens,
    private readonly clock: Clock,
  ) {
    // The password of the fallback is random, so no one can match it. Started now so that the
    // first unknown email does not pay for it. A failure is raised when it is awaited.
    this.fallbackHash = hasher.hash(tokens.create());
    this.fallbackHash.catch(() => {});
  }

  async execute(command: SignInCommand): Promise<SignInResult> {
    const now = this.clock.now().getTime();
    const key = Email.normalize(command.email);

    // 1. The attempt is counted at once, before the password is checked, in one atomic step: attempts
    //    that arrive together cannot all see the same count (BR-06, SC-25). A locked email is
    //    refused without looking at the password.
    const { before } = await this.attempts.update(key, (current) => current.afterAttemptAt(now));
    if (before.isLockedAt(now)) throw new TooManyAttempts(before.secondsToWaitAt(now));

    // 2. A hash is always checked, so the time is the same for an unknown email (BR-05).
    //    A text that cannot be an email is an unknown one.
    const account = await this.findAccount(command.email);
    const hash = account?.passwordHash ?? (await this.fallbackHash);
    const matches = await this.hasher.verify(command.password, hash);

    // 3. The attempt was already counted, and the answer does not say what failed (BR-05, BR-06)
    if (account === null || !matches) throw new InvalidCredentials();

    // 4. The count is cleared and a Session is created (BR-05, BR-06, BR-07)
    await this.attempts.clear(key);
    const token = this.tokens.create();
    const session = Session.start(this.tokens.hash(token), account.id, now);
    await this.sessions.add(session);
    return {
      token,
      expiresAt: new Date(session.expiresAt).toISOString(),
      account: toView(account),
    };
  }

  private async findAccount(text: string) {
    try {
      return await this.accounts.findByEmail(Email.of(text));
    } catch (error) {
      if (error instanceof InvalidValue) return null;
      throw error;
    }
  }
}
