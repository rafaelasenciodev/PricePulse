/** The reset of the demo against a database (feature 12, SC-15, SC-16, and that nothing is changed when it refuses). */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { composePostgresApp, type Application } from "../../src/composition-root";
import type { Pool } from "../../src/database/connect";
import { truncateData } from "../../src/database/truncate";
import { DEMO_PROVIDER_TOKEN, seedDemoData } from "../../src/demo-data";
import { resetDemo, ResetRefused } from "../../src/reset-demo";
import { TEST_DATABASE_URL, testPool, truncateAll } from "../support/database";
import { call } from "../persistence/support";

const environment = { DEMO_MODE: "true", DATABASE_URL: TEST_DATABASE_URL };
const quiet = { info: () => {} };

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

/** The application of a server that is running over the database: its demo Provider has its token. */
async function startServer(): Promise<Application> {
  const application = composePostgresApp(pool, { onEvaluation: () => {} });
  running.push(application);
  await seedDemoData(application);
  return application;
}

const count = async (table: string, where = "true") => Number((await pool.query(`SELECT count(*) AS n FROM ${table} WHERE ${where}`)).rows[0].n);
const signIn = async (application: Application, email: string, password: string) =>
  call(application, "POST", "/sessions", null, { email, password });

/** What a Reviewer does: registers, signs in, creates an alert and makes the price fall. Gives their token. */
async function reviewerPlays(application: Application): Promise<string> {
  await call(application, "POST", "/accounts", null, { email: "rev@example.com", password: "reviewer-password-1" });
  const token = (await signIn(application, "rev@example.com", "reviewer-password-1")).json().token as string;
  expect((await call(application, "POST", "/listings/headphones-shop-a/price-alerts", token, { targetAmount: "80.00" })).statusCode).toBe(201);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const recorded = await call(application, "POST", "/listings/headphones-shop-a/price-observations", DEMO_PROVIDER_TOKEN, {
    observedAt: new Date().toISOString(),
    price: { amount: "79.00", currency: "EUR" },
  });
  expect(recorded.statusCode).toBe(201);
  return token;
}

describe("the reset of the demo", () => {
  it("SC-15 / BR-08: on an empty database it creates the demo data", async () => {
    await resetDemo(environment, quiet);
    expect(await count("accounts")).toBe(2);
    expect(await count("listings")).toBe(6);
    expect(await count("price_observations")).toBe(6);
    expect(await count("price_alerts")).toBe(1);
  });

  it("SC-15 / BR-08: it returns the data to the first state of the demo", async () => {
    await resetDemo(environment, quiet);
    const before = await startServer();
    await reviewerPlays(before);
    expect(await count("accounts")).toBe(3);
    expect(await count("notifications")).toBeGreaterThan(0);

    await resetDemo(environment, quiet);

    expect(await count("accounts", "email = 'rev@example.com'")).toBe(0);
    expect(await count("accounts")).toBe(2);
    expect(await count("price_observations")).toBe(6);
    expect(await count("notifications")).toBe(0);
    const after = await startServer();
    const demo1 = (await signIn(after, "demo1@example.com", "demo-password-1")).json().token as string;
    const alerts = (await call(after, "GET", "/price-alerts", demo1)).json();
    expect(alerts.total).toBe(1);
    expect(alerts.items[0]).toMatchObject({ listingId: "headphones-shop-a", targetAmount: "80.00", status: "active" });
    expect((await call(after, "GET", "/listings/headphones-shop-a", demo1)).json().currentPrice.amount).toBe("100.00");
    expect((await call(after, "GET", "/notifications", demo1)).json().total).toBe(0);
  });

  it("SC-16 / BR-08: a Session that existed before the reset does not identify anyone after it", async () => {
    await resetDemo(environment, quiet);
    const before = await startServer();
    const token = await reviewerPlays(before);
    expect((await call(before, "GET", "/price-alerts", token)).statusCode).toBe(200);

    await resetDemo(environment, quiet);

    const after = await startServer();
    expect((await call(after, "GET", "/price-alerts", token)).statusCode).toBe(401);
  });

  it("BR-08: the schema and the record of its migrations stay", async () => {
    await resetDemo(environment, quiet);
    const recorded = await count("schema_migrations");
    expect(recorded).toBeGreaterThan(0);
    await resetDemo(environment, quiet);
    expect(await count("schema_migrations")).toBe(recorded);
  });

  it("BR-08: the sign-in attempts of an email start again", async () => {
    await resetDemo(environment, quiet);
    const application = await startServer();
    for (let i = 0; i < 5; i += 1) await signIn(application, "demo1@example.com", "wrong-password");
    expect(await count("login_attempts")).toBe(1);
    await resetDemo(environment, quiet);
    expect(await count("login_attempts")).toBe(0);
  });

  it("BR-08: refused without the demo mode, it changes nothing", async () => {
    await resetDemo(environment, quiet);
    const application = await startServer();
    await reviewerPlays(application);
    const accounts = await count("accounts");
    const observations = await count("price_observations");

    const error = await resetDemo({ DATABASE_URL: TEST_DATABASE_URL }, quiet).catch((e) => e);

    expect(error).toBeInstanceOf(ResetRefused);
    expect(await count("accounts")).toBe(accounts);
    expect(await count("price_observations")).toBe(observations);
  });
});

describe("truncateData", () => {
  it("empties what is stored, restarts the sequences, and does not touch the record of the migrations", async () => {
    await resetDemo(environment, quiet);
    const recorded = await count("schema_migrations");
    await truncateData(pool);
    for (const table of ["accounts", "sessions", "listings", "price_alerts", "notifications", "price_observations", "login_attempts"]) {
      expect(await count(table)).toBe(0);
    }
    expect(await count("schema_migrations")).toBe(recorded);
  });
});
