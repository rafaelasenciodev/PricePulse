/** PostgreSQL implementations of the stores of Accounts (feature 11, ADR-0006). The schema is in `database/migrations`. */

import type { Pool } from "pg";
import { EmailAlreadyStored, type AccountRepository, type AttemptChange, type LoginAttemptStore, type SessionStore } from "../application";
import { Account, Email, FailedAttempts, Session } from "../domain";
import { DEFAULT_ATTEMPT_CAPACITY } from "./in-memory";
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

/** How many times an update starts again when the row it was going to change was removed by another one. */
const UPDATE_ATTEMPTS = 5;

/**
 * Taken, until the end of the transaction, before the oldest rows are removed. Without it each transaction would trim
 * without seeing the rows that others have written and not committed, and the table could stay above its capacity.
 */
const TRIM_LOCK_KEY = 5_160_012;

/**
 * Implements LoginAttemptStore. An update is one transaction that locks the row of the email, so that attempts at the
 * same time each see what the previous one left (BR-06). `change` may therefore run more than once, which its contract
 * allows. The store keeps the newest `capacity` emails by the order of writing, as the in-memory one does.
 */
export class PostgresLoginAttemptStore implements LoginAttemptStore {
  constructor(
    private readonly pool: Pool,
    private readonly capacity: number = DEFAULT_ATTEMPT_CAPACITY,
  ) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError("The capacity must be at least 1");
  }

  async update(email: string, change: (current: FailedAttempts) => FailedAttempts): Promise<AttemptChange> {
    for (let attempt = 0; attempt < UPDATE_ATTEMPTS; attempt++) {
      const result = await this.tryUpdate(email, change);
      if (result !== null) return result;
    }
    throw new Error("The sign-in attempts could not be updated: the row kept being removed by others");
  }

  async clear(email: string): Promise<void> {
    await this.pool.query("DELETE FROM login_attempts WHERE email = $1", [email]);
  }

  /** One try. Null when the row was removed by a transaction that committed first, and the caller must start again. */
  private async tryUpdate(email: string, change: (current: FailedAttempts) => FailedAttempts): Promise<AttemptChange | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Makes sure there is a row to lock. The count is 0: it is the state of an email with no attempts.
      await client.query("INSERT INTO login_attempts (email, count, locked_until) VALUES ($1, 0, NULL) ON CONFLICT DO NOTHING", [email]);
      const { rows } = await client.query<{ count: number; locked_until: number | null }>(
        "SELECT count, locked_until FROM login_attempts WHERE email = $1 FOR UPDATE",
        [email],
      );
      const row = rows[0];
      if (row === undefined) {
        await client.query("ROLLBACK");
        return null;
      }
      const before = row.count === 0 && row.locked_until === null ? FailedAttempts.none() : FailedAttempts.of(row.count, row.locked_until);
      const after = change(before);
      // A state with no attempts is what an email that is not stored has, so it takes no row.
      if (after.count > 0 || after.lockedUntil !== null) {
        await client.query("UPDATE login_attempts SET count = $2, locked_until = $3, written = nextval('login_attempts_written_seq') WHERE email = $1", [
          email,
          after.count,
          after.lockedUntil,
        ]);
        await client.query("SELECT pg_advisory_xact_lock($1)", [TRIM_LOCK_KEY]);
        // The oldest beyond the capacity go. Rows that another transaction holds are left to it, so two do not wait on each other.
        await client.query(
          `DELETE FROM login_attempts WHERE email IN (
             SELECT email FROM login_attempts
              WHERE written <= (SELECT written FROM login_attempts ORDER BY written DESC OFFSET $1 LIMIT 1)
                FOR UPDATE SKIP LOCKED)`,
          [this.capacity],
        );
      } else {
        await client.query("DELETE FROM login_attempts WHERE email = $1", [email]);
      }
      await client.query("COMMIT");
      return { before, after };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
