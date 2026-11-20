/** The demo data of the development server is made once (feature 11, SC-38 and SC-39). */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { composeInMemoryApp, composePostgresApp, type Application } from "../../src/composition-root";
import type { Pool } from "../../src/database/connect";
import { DEMO_PROVIDER_TOKEN, seedDemoData } from "../../src/demo-data";
import { FAST_HASHER } from "../support/accounts";
import { testPool, truncateAll } from "../support/database";
import { call } from "./support";

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

/** A server start: the application over the database, with the demo data seeded, as `main.ts` does. */
async function startServer(): Promise<{ application: Application; created: boolean }> {
  const application = composePostgresApp(pool, { passwordHasher: FAST_HASHER, onEvaluation: () => {} });
  running.push(application);
  const { created } = await seedDemoData(application);
  return { application, created };
}

const count = async (table: string, where = "true") => Number((await pool.query(`SELECT count(*) AS n FROM ${table} WHERE ${where}`)).rows[0].n);
const signIn = async (application: Application, n: 1 | 2) =>
  (await call(application, "POST", "/sessions", null, { email: `demo${n}@example.com`, password: `demo-password-${n}` })).json().token as string;

describe("the demo data", () => {
  it("SC-38 / BR-12: is created once: two Accounts, six Listings, their first prices and one alert, and no more after a restart", async () => {
    const first = await startServer();
    expect(first.created).toBe(true);
    const second = await startServer();
    expect(second.created).toBe(false);
    const third = await startServer();
    expect(third.created).toBe(false);

    expect(await count("accounts")).toBe(2);
    expect(await count("listings")).toBe(6);
    expect(await count("price_observations")).toBe(6);
    expect(await count("price_observations", "price_minor_units IS NULL")).toBe(1); // the unavailable monitor
    expect(await count("price_alerts")).toBe(1);
  });

  it("SC-39 / BR-12: a restart does not undo what a person did to the demo data", async () => {
    const { application } = await startServer();
    const token = await signIn(application, 1);
    const alert = (await call(application, "GET", "/price-alerts", token)).json().items[0];
    expect((await call(application, "PATCH", `/price-alerts/${alert.id}`, token, { status: "cancelled" })).statusCode).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const recorded = await call(application, "POST", "/listings/headphones-shop-a/price-observations", DEMO_PROVIDER_TOKEN, {
      observedAt: new Date().toISOString(),
      price: { amount: "97.50", currency: "EUR" },
    });
    expect(recorded.statusCode).toBe(201);

    const { application: restarted, created } = await startServer();

    expect(created).toBe(false);
    const again = await signIn(restarted, 1);
    expect((await call(restarted, "GET", `/price-alerts/${alert.id}`, again)).json().status).toBe("cancelled");
    expect((await call(restarted, "GET", "/listings/headphones-shop-a", again)).json().currentPrice.amount).toBe("97.50");
    expect(await count("price_observations")).toBe(7);
  });

  it("gives the demo provider its token at every start, because the token is not data", async () => {
    await startServer();
    const { application } = await startServer();
    const response = await call(application, "POST", "/listings/webcam-shop-b/price-observations", DEMO_PROVIDER_TOKEN, {
      observedAt: new Date().toISOString(),
      price: { amount: "44.00", currency: "USD" },
    });
    expect(response.statusCode).toBe(201);
  });

  it("in memory it is made once per start, as it always was", async () => {
    const application = composeInMemoryApp({ passwordHasher: FAST_HASHER, onEvaluation: () => {} });
    expect((await seedDemoData(application)).created).toBe(true);
    const token = await signIn(application, 2);
    expect((await call(application, "GET", "/listings", token)).json().total).toBe(6);
    await application.app.close();
  });
});
