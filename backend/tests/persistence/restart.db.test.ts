/**
 * What is stored survives a restart (feature 11, SC-01 to SC-05). A restart is an application that is closed and another
 * one that is composed over the same database: nothing is carried from one to the other but what the database holds.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/composition-root";
import type { Pool } from "../../src/database/connect";
import { testPool, truncateAll } from "../support/database";
import {
  HEADPHONES,
  PASSWORD,
  call,
  createAlert,
  observe,
  register,
  seedHeadphones,
  signIn,
  signedIn,
  startMemory,
  startPostgres,
} from "./support";

let pool: Pool;
let running: Application[] = [];

beforeAll(async () => {
  pool = await testPool();
});
afterAll(async () => {
  await pool.end();
});
beforeEach(async () => {
  await truncateAll(pool);
});
afterEach(async () => {
  await Promise.all(running.map((a) => a.app.close()));
  running = [];
});

const start = () => {
  const application = startPostgres(pool);
  running.push(application);
  return application;
};
/** Stops the server and starts another one over the same database. */
const restart = async (application: Application) => {
  await application.app.close();
  return start();
};

describe("what is stored survives a restart", () => {
  it("SC-01 / BR-02: an Account and its Session survive a restart", async () => {
    const before = start();
    await seedHeadphones(before);
    const token = await signedIn(before, "ana@example.com");

    const after = await restart(before);

    expect((await call(after, "GET", "/accounts/me", token)).json().email).toBe("ana@example.com");
    expect((await signIn(after, "ana@example.com")).statusCode).toBe(201);
  });

  it("SC-02 / BR-02: a Session that ended stays ended after a restart", async () => {
    const before = start();
    const token = await signedIn(before, "ana@example.com");
    expect((await call(before, "DELETE", "/sessions/current", token)).statusCode).toBe(204);

    const after = await restart(before);

    expect((await call(after, "GET", "/accounts/me", token)).statusCode).toBe(401);
  });

  it("SC-03 / BR-02: the sign-in attempts of an email are counted across a restart", async () => {
    // What the sequence gives with no restart is the reference.
    const reference = startMemory();
    running.push(reference);
    await register(reference, "ana@example.com");
    const expected: number[] = [];
    for (let i = 0; i < 6; i++) expected.push((await signIn(reference, "ana@example.com", "wrong-password-1")).statusCode);

    const before = start();
    await register(before, "ana@example.com");
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await signIn(before, "ana@example.com", "wrong-password-1")).statusCode);
    const after = await restart(before);
    for (let i = 0; i < 2; i++) statuses.push((await signIn(after, "ana@example.com", "wrong-password-1")).statusCode);

    expect(statuses).toEqual(expected);
    expect(statuses.at(-1)).not.toBe(401); // locked: not told that the password is wrong
    // And the lock holds for the right password too.
    expect((await signIn(after, "ana@example.com", PASSWORD)).statusCode).toBe(statuses.at(-1));
  });

  it("SC-04 / BR-02: a Price Alert is found as it was left", async () => {
    const before = start();
    await seedHeadphones(before);
    const token = await signedIn(before, "ana@example.com");
    const created = (await createAlert(before, token, "80.00")).json();

    const after = await restart(before);

    expect((await call(after, "GET", `/price-alerts/${created.id}`, token)).json()).toEqual(created);
    expect((await call(after, "GET", "/price-alerts", token)).json().items).toEqual([created]);
  });

  describe("SC-05 / BR-02: Notifications, prices and the Catalogue survive a restart", () => {
    const journey = async () => {
      const before = start();
      await seedHeadphones(before);
      const token = await signedIn(before, "ana@example.com");
      const alert = (await createAlert(before, token, "80.00")).json();
      expect((await observe(before, "10:00:00", "79.00")).statusCode).toBe(201);
      const read = (application: Application) => ({
        notifications: call(application, "GET", "/notifications", token).then((r) => r.json()),
        history: call(application, "GET", `/listings/${HEADPHONES}/price-observations`, token).then((r) => r.json()),
        listing: call(application, "GET", `/listings/${HEADPHONES}`, token).then((r) => r.json()),
        alert: call(application, "GET", `/price-alerts/${alert.id}`, token).then((r) => r.json()),
      });
      const answersBefore = await Promise.all(Object.values(read(before)));
      const after = await restart(before);
      const answersAfter = await Promise.all(Object.values(read(after)));
      return { keys: Object.keys(read(after)), answersBefore, answersAfter };
    };

    it.each(["notifications", "history", "listing", "alert"])("SC-05 / BR-02: the answer about %s is as it was before", async (what) => {
      const { keys, answersBefore, answersAfter } = await journey();
      const index = keys.indexOf(what);
      expect(answersAfter[index]).toEqual(answersBefore[index]);
      expect(answersAfter[index]).toBeTruthy();
    });

    it("SC-05 / BR-02: the Notification is there, the Current Price is 79.00, the title and the Retailer are kept, and the alert is Triggered", async () => {
      const { answersAfter } = await journey();
      const [notifications, history, listing, alert] = answersAfter;
      expect(notifications.items).toHaveLength(1);
      expect(history.items.map((o: { price: { amount: string } }) => o.price.amount)).toEqual(["79.00", "100.00"]);
      expect(listing.currentPrice.amount).toBe("79.00");
      expect([listing.title, listing.retailer]).toEqual(["Wireless headphones", "Shop A"]);
      expect(alert.status).toBe("triggered");
    });
  });
});
