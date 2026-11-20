/** What the database holds, read directly, and the removal of expired Sessions (feature 11, SC-26 and SC-40). */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/composition-root";
import type { Pool } from "../../src/database/connect";
import { MutableClock } from "../accounts/support/fakes";
import { testPool, truncateAll } from "../support/database";
import { NOW, PASSWORD, call, register, signIn, startPostgres } from "./support";

let pool: Pool;
let application: Application;
let clock: MutableClock;

beforeAll(async () => {
  pool = await testPool();
});
afterAll(async () => {
  await pool.end();
});
beforeEach(async () => {
  await truncateAll(pool);
  clock = new MutableClock(NOW.getTime());
  application = startPostgres(pool, clock);
});
afterEach(async () => {
  await application.app.close();
});

const DAY = 24 * 60 * 60 * 1000;

describe("SC-26 / BR-08: a password and a token are never stored in clear", () => {
  it("SC-26 / BR-08: her password is nowhere, and her stored password is a hash", async () => {
    await register(application, "ana@example.com");
    await signIn(application, "ana@example.com");

    const everything = JSON.stringify(
      (await Promise.all(["accounts", "sessions", "login_attempts", "price_alerts", "notifications"].map((t) => pool.query(`SELECT * FROM ${t}`)))).map((r) => r.rows),
    );
    expect(everything).not.toContain(PASSWORD);
    const { rows } = await pool.query<{ password_hash: string }>("SELECT password_hash FROM accounts");
    expect(rows[0]?.password_hash).not.toBe(PASSWORD);
    expect(rows[0]?.password_hash.length).toBeGreaterThan(40);
  });

  it("SC-26 / BR-08: her token is nowhere, and her Session is found only by the hash of the token", async () => {
    await register(application, "ana@example.com");
    const token = (await signIn(application, "ana@example.com")).json().token as string;

    const dump = JSON.stringify((await pool.query("SELECT * FROM sessions")).rows);
    expect(dump).not.toContain(token);
    expect((await pool.query("SELECT 1 FROM sessions WHERE token_hash = $1", [token])).rowCount).toBe(0);
    expect((await pool.query("SELECT 1 FROM sessions")).rowCount).toBe(1);
    expect((await call(application, "GET", "/accounts/me", token)).statusCode).toBe(200);
  });
});

describe("SC-40 / BR-13: signing in removes the Sessions that expired", () => {
  it("SC-40 / BR-13: the Session that expired is no longer stored, and the one of Luis and the new one of Ana are", async () => {
    await register(application, "ana@example.com");
    await register(application, "luis@example.com");
    const old = (await signIn(application, "ana@example.com")).json().token as string;
    clock.advance(6 * DAY);
    const luis = (await signIn(application, "luis@example.com")).json().token as string;
    clock.advance(2 * DAY); // Ana's Session is 8 days old, Luis's is 2

    const fresh = (await signIn(application, "ana@example.com")).json().token as string;

    expect((await pool.query("SELECT count(*) AS n FROM sessions")).rows[0].n).toBe(2);
    expect((await call(application, "GET", "/accounts/me", old)).statusCode).toBe(401);
    expect((await call(application, "GET", "/accounts/me", luis)).statusCode).toBe(200);
    expect((await call(application, "GET", "/accounts/me", fresh)).statusCode).toBe(200);
  });
});
