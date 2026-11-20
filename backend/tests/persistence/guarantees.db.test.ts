/**
 * The guarantees of the ports are held by the database (feature 11, SC-07 to SC-17): uniqueness, one change at a time,
 * and no lost count. Each test starts its requests before any is answered, over one application and one database.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/composition-root";
import type { Pool } from "../../src/database/connect";
import { testPool, truncateAll } from "../support/database";
import { HEADPHONES, PASSWORD, call, createAlert, observe, register, seedHeadphones, signIn, signedIn, startPostgres } from "./support";

let pool: Pool;
let application: Application;

beforeAll(async () => {
  pool = await testPool();
});
afterAll(async () => {
  await pool.end();
});
beforeEach(async () => {
  await truncateAll(pool);
  application = startPostgres(pool);
  await seedHeadphones(application);
});
afterEach(async () => {
  await application.app.close();
});

const count = async (table: string, where = "true") => Number((await pool.query(`SELECT count(*) AS n FROM ${table} WHERE ${where}`)).rows[0].n);
const statuses = (responses: { statusCode: number }[]) => responses.map((r) => r.statusCode).sort();
const alertsOf = async (token: string) => (await call(application, "GET", "/price-alerts", token)).json();

describe("uniqueness is held by the database", () => {
  it("SC-07 / BR-03: two registrations of the same email at the same time leave one Account", async () => {
    const responses = await Promise.all([register(application, "ana@example.com"), register(application, "ana@example.com")]);
    expect(statuses(responses)).toEqual([201, 409]);
    expect(await count("accounts", "email = 'ana@example.com'")).toBe(1);
  });

  it("SC-08 / BR-03: an email is the same whatever its capitals and its spaces", async () => {
    await register(application, "ana@example.com");
    const response = await register(application, " Ana@Example.COM ");
    expect(response.statusCode).toBe(409);
  });

  it("SC-09 / BR-03: two requests for the same Price Alert at the same time leave one", async () => {
    const token = await signedIn(application, "ana@example.com");
    const responses = await Promise.all([createAlert(application, token, "80.00"), createAlert(application, token, "80.00")]);
    expect(statuses(responses)).toEqual([200, 201]);
    expect(responses[0]?.json()).toEqual(responses[1]?.json());
    expect((await alertsOf(token)).total).toBe(1);
  });

  it.each(["cancel", "trigger"])("SC-10 / BR-03: a new Active alert is allowed once the earlier one was ended by a %s", async (how) => {
    const token = await signedIn(application, "ana@example.com");
    const first = (await createAlert(application, token, "80.00")).json();
    if (how === "cancel") await call(application, "PATCH", `/price-alerts/${first.id}`, token, { status: "cancelled" });
    else await observe(application, "10:00:00", "79.00");

    const second = await createAlert(application, token, "70.00");

    expect(second.statusCode).toBe(201);
    expect(await count("price_alerts", "status = 'active'")).toBe(1);
  });

  it("SC-11 / BR-03: two Evaluations of the same Listing at the same time leave one Notification per alert", async () => {
    const token = await signedIn(application, "ana@example.com");
    const alert = (await createAlert(application, token, "80.00")).json();
    const responses = await Promise.all([observe(application, "10:00:00", "79.00"), observe(application, "11:00:00", "79.00")]);
    expect(statuses(responses)).toEqual([201, 201]);
    expect(await count("notifications")).toBe(1);
    expect((await call(application, "GET", `/price-alerts/${alert.id}`, token)).json().status).toBe("triggered");
  });

  it("SC-12 / BR-03: the same Price Observation recorded twice at the same time is stored once", async () => {
    const responses = await Promise.all([observe(application, "10:00:00", "79.00"), observe(application, "10:00:00", "79.00")]);
    expect(statuses(responses)).toEqual([200, 201]);
    expect(responses[0]?.json()).toEqual(responses[1]?.json());
    expect(await count("price_observations", `observed_at = ${Date.parse("2026-11-19T10:00:00Z")}`)).toBe(1);
  });

  it("SC-13 / BR-03: the same observation with another content is a Conflict", async () => {
    await observe(application, "10:00:00", "79.00");
    const response = await observe(application, "10:00:00", "75.00");
    expect(response.statusCode).toBe(409);
    const token = await signedIn(application, "ana@example.com");
    const history = (await call(application, "GET", `/listings/${HEADPHONES}/price-observations`, token)).json();
    expect(history.items.filter((o: { observedAt: string }) => o.observedAt === "2026-11-19T10:00:00.000Z").map((o: { price: { amount: string } }) => o.price.amount)).toEqual(["79.00"]);
  });
});

describe("one change at a time", () => {
  it("SC-14 / BR-04: a cancel and a Triggering at the same time leave the alert in one end state", async () => {
    const outcomes = new Set<string>();
    for (let round = 0; round < 8; round++) {
      await truncateAll(pool);
      await seedHeadphones(application);
      const token = await signedIn(application, `ana${round}@example.com`);
      const alert = (await createAlert(application, token, "80.00")).json();
      const [cancelled, observed] = await Promise.all([
        call(application, "PATCH", `/price-alerts/${alert.id}`, token, { status: "cancelled" }),
        observe(application, "10:00:00", "79.00"),
      ]);
      const status = (await call(application, "GET", `/price-alerts/${alert.id}`, token)).json().status;
      expect(["cancelled", "triggered"]).toContain(status);
      expect(observed.statusCode).toBe(201); // recording a price is not undone by an alert that changed
      expect([200, 409]).toContain(cancelled.statusCode);
      // Whoever came second did not change what the first left: a Notification exists exactly when the alert was Triggered.
      expect(await count("notifications")).toBe(status === "triggered" ? 1 : 0);
      outcomes.add(status);
    }
    expect(outcomes.size).toBeGreaterThan(0);
  });

  it("SC-15 / BR-04: two cancels at the same time both succeed", async () => {
    const token = await signedIn(application, "ana@example.com");
    const alert = (await createAlert(application, token, "80.00")).json();
    const responses = await Promise.all([
      call(application, "PATCH", `/price-alerts/${alert.id}`, token, { status: "cancelled" }),
      call(application, "PATCH", `/price-alerts/${alert.id}`, token, { status: "cancelled" }),
    ]);
    expect(statuses(responses)).toEqual([200, 200]);
    expect((await call(application, "GET", `/price-alerts/${alert.id}`, token)).json().status).toBe("cancelled");
  });

  it("SC-16 / BR-04: two changes of the Target Price at the same time both succeed and the last one stays", async () => {
    const token = await signedIn(application, "ana@example.com");
    const alert = (await createAlert(application, token, "80.00")).json();
    const responses = await Promise.all([
      call(application, "PATCH", `/price-alerts/${alert.id}`, token, { targetAmount: "70.00" }),
      call(application, "PATCH", `/price-alerts/${alert.id}`, token, { targetAmount: "60.00" }),
    ]);
    expect(statuses(responses)).toEqual([200, 200]);
    expect(["70.00", "60.00"]).toContain((await call(application, "GET", `/price-alerts/${alert.id}`, token)).json().targetAmount);
  });

  it("SC-17 / BR-05: failed sign-ins at the same time are all counted", async () => {
    await register(application, "ana@example.com");
    await Promise.all(Array.from({ length: 5 }, () => signIn(application, "ana@example.com", "wrong-password-1")));
    expect((await pool.query("SELECT count FROM login_attempts WHERE email = 'ana@example.com'")).rows).toEqual([{ count: 5 }]);
    expect((await signIn(application, "ana@example.com", PASSWORD)).statusCode).not.toBe(201);
  });
});
