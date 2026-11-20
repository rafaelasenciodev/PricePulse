/** PostgreSQL implementations of the stores of Accounts (feature 11, ADR-0006). The schema is in `database/migrations`. */

import type { Pool } from "pg";
import { EmailAlreadyStored, type AccountRepository, type SessionStore } from "../application";
import { Account, Email, Session } from "../domain";
import { isUniqueViolation } from "../../shared/database-errors";
import { UserId } from "../../shared/domain";

interface AccountRow {
  id: string;
  email: string;
  password_hash: string;
}

/** Rebuilds an Account with the checks that the Email makes: a stored email that is not valid is an error, not a guess. */
const toAccount = (row: AccountRow): Account => new Account(UserId(row.id), Email.of(row.email), row.password_hash);

/** Implements AccountRepository. The uniqueness of the email is a constraint of the table, not a check before the insert. */
export class PostgresAccountRepository implements AccountRepository {
  constructor(private readonly pool: Pool) {}

  async add(account: Account): Promise<void> {
    try {
      await this.pool.query("INSERT INTO accounts (id, email, password_hash) VALUES ($1, $2, $3)", [
        account.id,
        account.email.value,
        account.passwordHash,
      ]);
    } catch (error) {
      if (isUniqueViolation(error, "accounts_email_key")) throw new EmailAlreadyStored();
      throw error;
    }
  }

  async findByEmail(email: Email): Promise<Account | null> {
    const { rows } = await this.pool.query<AccountRow>("SELECT id, email, password_hash FROM accounts WHERE email = $1", [email.value]);
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async find(id: UserId): Promise<Account | null> {
    const { rows } = await this.pool.query<AccountRow>("SELECT id, email, password_hash FROM accounts WHERE id = $1", [id]);
    return rows[0] ? toAccount(rows[0]) : null;
  }
}

/** Implements SessionStore. Only the hash of the token is stored (ADR-0004). */
export class PostgresSessionStore implements SessionStore {
  constructor(private readonly pool: Pool) {}

  async add(session: Session): Promise<void> {
    // One statement: the Sessions that had expired when this one was created are removed (BR-13), and this one is stored.
    await this.pool.query(
      `WITH expired AS (DELETE FROM sessions WHERE expires_at <= $3)
       INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)`,
      [session.tokenHash, session.userId, session.createdAt, session.expiresAt],
    );
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const { rows } = await this.pool.query<{ token_hash: string; user_id: string; created_at: number; expires_at: number }>(
      "SELECT token_hash, user_id, created_at, expires_at FROM sessions WHERE token_hash = $1",
      [tokenHash],
    );
    const row = rows[0];
    return row ? Session.restore(row.token_hash, UserId(row.user_id), row.created_at, row.expires_at) : null;
  }

  async delete(tokenHash: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  }
}
